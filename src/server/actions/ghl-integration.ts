"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { insertActivityEvent } from "@/lib/activity/events";
import { encryptJson } from "@/lib/crypto/integration-secrets";
import { requireAgencyAdmin } from "@/lib/auth/agency-context";
import { requireSession } from "@/lib/auth/session";
import { GhlClient } from "@/lib/integrations/gohighlevel/client";
import type { GhlStoredCredential } from "@/lib/integrations/gohighlevel/types";
import { getServerEnv, isIntegrationEncryptionConfigured } from "@/lib/env.server";
import { createAdminClient } from "@/lib/supabase/admin";

const connectSchema = z.object({
  agencyId: z.string().uuid(),
  locationId: z.string().min(3),
  accessToken: z.string().min(10),
  tokenKind: z.enum(["pit", "oauth"]).default("pit"),
  refreshToken: z.string().optional(),
  expiresAt: z.string().optional(),
});

export type GhlConnectState = { error?: string; success?: boolean };
export type GhlDisconnectState = { error?: string; success?: boolean };

export async function connectGoHighLevel(
  _prev: GhlConnectState,
  formData: FormData,
): Promise<GhlConnectState> {
  const parsed = connectSchema.safeParse({
    agencyId: String(formData.get("agencyId") ?? ""),
    locationId: String(formData.get("locationId") ?? "").trim(),
    accessToken: String(formData.get("accessToken") ?? "").trim(),
    tokenKind: (String(formData.get("tokenKind") ?? "pit") || "pit") as "pit" | "oauth",
    refreshToken: String(formData.get("refreshToken") ?? "").trim() || undefined,
    expiresAt: String(formData.get("expiresAt") ?? "").trim() || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  if (!isIntegrationEncryptionConfigured()) {
    return {
      error:
        "Server misconfiguration: set INTEGRATION_ENCRYPTION_KEY (32-byte hex or base64) in the server environment.",
    };
  }

  const ctx = await requireSession();
  await requireAgencyAdmin(ctx, parsed.data.agencyId);

  const cred: GhlStoredCredential =
    parsed.data.tokenKind === "oauth"
      ? {
          kind: "oauth",
          accessToken: parsed.data.accessToken,
          refreshToken: parsed.data.refreshToken,
          expiresAt: parsed.data.expiresAt,
          locationId: parsed.data.locationId,
        }
      : {
          kind: "pit",
          accessToken: parsed.data.accessToken,
          locationId: parsed.data.locationId,
        };

  const testClient = new GhlClient({
    credential: cred,
    clientId: getServerEnv().GHL_OAUTH_CLIENT_ID,
    clientSecret: getServerEnv().GHL_OAUTH_CLIENT_SECRET,
  });

  try {
    await testClient.getPipelines();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Token validation failed";
    return { error: msg };
  }

  const { data: integration, error: intErr } = await ctx.supabase
    .from("integrations")
    .upsert(
      {
        agency_id: parsed.data.agencyId,
        provider: "gohighlevel",
        status: "connected",
        health_status: "healthy",
        external_location_id: parsed.data.locationId,
        config: {
          locationId: parsed.data.locationId,
          tokenType: parsed.data.tokenKind,
        },
        last_error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "agency_id,provider" },
    )
    .select("id")
    .single();

  if (intErr || !integration) {
    return { error: intErr?.message ?? "Failed to save integration row" };
  }

  const enc = encryptJson(cred);
  const admin = createAdminClient();
  const { error: credErr } = await admin.from("integration_credentials").upsert({
    integration_id: integration.id,
    ciphertext: enc.ciphertext,
    iv: enc.iv,
    auth_tag: enc.authTag,
    key_version: enc.keyVersion,
    updated_at: new Date().toISOString(),
  });

  if (credErr) {
    return { error: credErr.message };
  }

  await insertActivityEvent(ctx.supabase, {
    agency_id: parsed.data.agencyId,
    actor_id: ctx.user.id,
    type: "integration_connected",
    title: "GoHighLevel connected",
    body: `Location ${parsed.data.locationId}`,
    metadata: { integrationId: integration.id },
    entity_type: "integration",
    entity_id: integration.id,
  });

  revalidatePath("/dashboard/integrations");
  revalidatePath("/dashboard");
  return { success: true };
}

const disconnectSchema = z.object({
  agencyId: z.string().uuid(),
  integrationId: z.string().uuid(),
});

export async function disconnectGoHighLevel(
  _prev: GhlDisconnectState,
  formData: FormData,
): Promise<GhlDisconnectState> {
  try {
    const parsed = disconnectSchema.safeParse({
      agencyId: String(formData.get("agencyId") ?? ""),
      integrationId: String(formData.get("integrationId") ?? ""),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues.map((i) => i.message).join(", ") };
    }

    const ctx = await requireSession();
    await requireAgencyAdmin(ctx, parsed.data.agencyId);

    const admin = createAdminClient();
    const { error: credErr } = await admin
      .from("integration_credentials")
      .delete()
      .eq("integration_id", parsed.data.integrationId);
    if (credErr) {
      return { error: credErr.message };
    }

    const { error } = await admin
      .from("integrations")
      .update({
        status: "disconnected",
        health_status: "unknown",
        external_location_id: null,
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", parsed.data.integrationId)
      .eq("agency_id", parsed.data.agencyId);

    if (error) {
      return { error: error.message };
    }

    // Remove mirrored CRM rows from this provider so disconnected workspaces
    // don't keep showing stale GHL data in Dashboard/CRM pages.
    const { error: pipelineDeleteErr } = await admin
      .from("pipelines")
      .delete()
      .eq("agency_id", parsed.data.agencyId)
      .eq("external_source", "gohighlevel");
    if (pipelineDeleteErr) {
      return { error: pipelineDeleteErr.message };
    }

    const { error: stageMapDeleteErr } = await admin
      .from("crm_stage_map")
      .delete()
      .eq("agency_id", parsed.data.agencyId);
    if (stageMapDeleteErr) {
      return { error: stageMapDeleteErr.message };
    }

    // Non-critical logging should never block disconnect UX.
    try {
      await insertActivityEvent(ctx.supabase, {
        agency_id: parsed.data.agencyId,
        actor_id: ctx.user.id,
        type: "integration_disconnected",
        title: "GoHighLevel disconnected",
        body: "Credentials removed and sync disabled.",
        metadata: { integrationId: parsed.data.integrationId },
        entity_type: "integration",
        entity_id: parsed.data.integrationId,
      });
    } catch (e) {
      console.error("[ghl-disconnect] activity log failed", e);
    }

    revalidatePath("/dashboard/integrations");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/crm");
    return { success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to disconnect integration";
    return { error: message };
  }
}
