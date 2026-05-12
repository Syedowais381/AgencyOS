import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { insertActivityEvent } from "@/lib/activity/events";
import { guessInternalStageFromGhlStageName } from "@/lib/crm/guess-internal-stage";
import { decryptJson, type EncryptedPayload } from "@/lib/crypto/integration-secrets";
import { upsertGhlOpportunityAsLead } from "@/lib/integrations/gohighlevel/apply-opportunity";
import { GhlClient } from "@/lib/integrations/gohighlevel/client";
import { GhlApiError } from "@/lib/integrations/gohighlevel/errors";
import type { GhlStoredCredential } from "@/lib/integrations/gohighlevel/types";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeSyncError(err: unknown): string {
  if (err instanceof GhlApiError) {
    const requestId = err.requestId ? ` (request_id: ${err.requestId})` : "";
    const body = err.body?.trim();
    if (body) {
      return `${err.message}${requestId}: ${body}`;
    }
    return `${err.message}${requestId}`;
  }
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const maybe = err as {
      message?: unknown;
      error_description?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
      status?: unknown;
    };
    const msg =
      typeof maybe.message === "string"
        ? maybe.message
        : typeof maybe.error_description === "string"
          ? maybe.error_description
          : null;
    const extra = [maybe.code, maybe.details, maybe.hint, maybe.status]
      .filter((v) => typeof v === "string" || typeof v === "number")
      .map((v) => String(v))
      .join(" | ");
    if (msg && extra) return `${msg} (${extra})`;
    if (msg) return msg;
    try {
      return JSON.stringify(err);
    } catch {
      return "Unexpected sync error";
    }
  }
  return "Unknown sync error";
}

function toEncryptedPayload(row: {
  ciphertext: string;
  iv: string;
  auth_tag: string;
  key_version: number | null;
}): EncryptedPayload {
  return {
    ciphertext: row.ciphertext,
    iv: row.iv,
    authTag: row.auth_tag,
    keyVersion: row.key_version ?? 1,
  };
}

export async function loadGhlCredential(
  admin: SupabaseClient,
  integrationId: string,
): Promise<GhlStoredCredential> {
  const { data, error } = await admin
    .from("integration_credentials")
    .select("ciphertext, iv, auth_tag, key_version")
    .eq("integration_id", integrationId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error("GoHighLevel is connected but credentials are missing");
  }

  return decryptJson<GhlStoredCredential>(toEncryptedPayload(data));
}

export async function persistRotatedCredential(
  admin: SupabaseClient,
  integrationId: string,
  cred: GhlStoredCredential,
  encrypt: (c: GhlStoredCredential) => EncryptedPayload,
) {
  const enc = encrypt(cred);
  const { error } = await admin.from("integration_credentials").upsert({
    integration_id: integrationId,
    ciphertext: enc.ciphertext,
    iv: enc.iv,
    auth_tag: enc.authTag,
    key_version: enc.keyVersion,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;

  const { error: intErr } = await admin
    .from("integrations")
    .update({
      token_expires_at: cred.expiresAt ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", integrationId);
  if (intErr) throw intErr;
}

export async function runGhlCrmSync(opts: {
  supabaseUser: SupabaseClient;
  admin: SupabaseClient;
  integrationId: string;
  agencyId: string;
  actorUserId: string;
  mode: "full" | "incremental";
  encryptForPersist: (c: GhlStoredCredential) => EncryptedPayload;
  oauthClientId?: string;
  oauthClientSecret?: string;
}): Promise<{ pipelinesUpserted: number; leadsUpserted: number }> {
  const {
    supabaseUser,
    admin,
    integrationId,
    agencyId,
    actorUserId,
    mode,
    encryptForPersist,
    oauthClientId,
    oauthClientSecret,
  } = opts;

  const { data: runRow, error: runErr } = await supabaseUser
    .from("integration_sync_runs")
    .insert({
      integration_id: integrationId,
      agency_id: agencyId,
      mode,
      status: "running",
      stats: {},
    })
    .select("id")
    .single();
  if (runErr || !runRow) throw runErr ?? new Error("Failed to start sync run");

  const markIntegration = async (patch: Record<string, unknown>) => {
    await supabaseUser
      .from("integrations")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", integrationId);
  };

  let pipelinesUpserted = 0;
  let leadsUpserted = 0;

  try {
    await markIntegration({ health_status: "syncing", last_error: null });

    const cred = await loadGhlCredential(admin, integrationId);
    const ghl = new GhlClient({
      credential: cred,
      clientId: oauthClientId,
      clientSecret: oauthClientSecret,
      onCredentialRotated: async (next) => {
        await persistRotatedCredential(admin, integrationId, next, encryptForPersist);
      },
    });

    const pipelines = await ghl.getPipelines();
    for (const p of pipelines) {
      const { error: pErr } = await supabaseUser.from("pipelines").upsert(
        {
          agency_id: agencyId,
          name: p.name,
          external_id: p.id,
          external_source: "gohighlevel",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "agency_id,external_id" },
      );
      if (pErr) throw pErr;
      pipelinesUpserted += 1;

      for (const st of p.stages ?? []) {
        const { error: mErr } = await supabaseUser.from("crm_stage_map").upsert(
          {
            agency_id: agencyId,
            external_pipeline_id: p.id,
            external_stage_id: st.id,
            internal_stage: guessInternalStageFromGhlStageName(st.name ?? ""),
            label: st.name ?? st.id,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "agency_id,external_pipeline_id,external_stage_id",
          },
        );
        if (mErr) throw mErr;
      }

      const syncStatus = mode === "incremental" ? "open" : "all";
      for await (const batch of ghl.searchAllOpportunities({
        pipelineId: p.id,
        status: syncStatus,
      })) {
        for (const opp of batch) {
          await upsertGhlOpportunityAsLead({
            supabase: supabaseUser,
            agencyId,
            externalPipelineId: p.id,
            opportunity: opp,
          });
          leadsUpserted += 1;
        }
        await sleep(120);
      }
    }

    await supabaseUser
      .from("integration_sync_runs")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        stats: { pipelinesUpserted, leadsUpserted, mode },
      })
      .eq("id", runRow.id);

    await markIntegration({
      health_status: "healthy",
      last_sync_at: new Date().toISOString(),
      last_error: null,
    });

    await insertActivityEvent(supabaseUser, {
      agency_id: agencyId,
      actor_id: actorUserId,
      type: "crm_sync",
      title: "CRM sync completed",
      body: `GoHighLevel ${mode} sync finished (${pipelinesUpserted} pipelines, ${leadsUpserted} lead writes).`,
      metadata: { integrationId, mode, pipelinesUpserted, leadsUpserted },
      entity_type: "integration",
      entity_id: integrationId,
    });

    return { pipelinesUpserted, leadsUpserted };
  } catch (e) {
    const message = normalizeSyncError(e);
    await supabaseUser
      .from("integration_sync_runs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error: message,
        stats: { pipelinesUpserted, leadsUpserted, mode },
      })
      .eq("id", runRow.id);

    await markIntegration({
      health_status: "error",
      last_error: message,
    });

    await insertActivityEvent(supabaseUser, {
      agency_id: agencyId,
      actor_id: actorUserId,
      type: "crm_sync_failed",
      title: "CRM sync failed",
      body: message,
      metadata: { integrationId, mode },
      entity_type: "integration",
      entity_id: integrationId,
    });

    throw e;
  }
}
