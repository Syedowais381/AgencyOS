import "server-only";

import { createHash } from "crypto";

import { insertActivityEvent } from "@/lib/activity/events";
import { upsertGhlOpportunityAsLead } from "@/lib/integrations/gohighlevel/apply-opportunity";
import type { GhlOpportunity } from "@/lib/integrations/gohighlevel/types";
import { createAdminClient } from "@/lib/supabase/admin";

function stableEventId(payload: Record<string, unknown>, type: string) {
  const wh = payload.webhookId;
  if (typeof wh === "string" && wh.length > 0) return wh;
  const digest = createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
  return `${type}:${digest}`;
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function normalizeOpportunityFromWebhook(
  root: Record<string, unknown>,
): GhlOpportunity | null {
  const data = asRecord(root.data ?? root);
  const id = String(data.id ?? root.id ?? "");
  if (!id) return null;
  return {
    id,
    name: String(data.name ?? root.name ?? "Opportunity"),
    monetaryValue: Number(data.monetaryValue ?? root.monetaryValue ?? 0),
    pipelineId: (data.pipelineId ?? root.pipelineId) as string | undefined,
    pipelineStageId: (data.pipelineStageId ?? root.pipelineStageId) as
      | string
      | undefined,
    status: (data.status ?? root.status) as GhlOpportunity["status"],
    contactId: (data.contactId ?? root.contactId) as string | undefined,
    updatedAt: (data.updatedAt ?? root.updatedAt) as string | undefined,
    createdAt: (data.createdAt ?? root.createdAt) as string | undefined,
  };
}

async function deleteMirroredOpportunity(opts: {
  admin: ReturnType<typeof createAdminClient>;
  agencyId: string;
  opportunityId: string;
}) {
  const { admin, agencyId, opportunityId } = opts;
  const { data: rows, error: leadErr } = await admin
    .from("leads")
    .select("id, pipeline_id")
    .eq("external_id", opportunityId);
  if (leadErr) throw leadErr;
  if (!rows?.length) return;

  const pipelineIds = rows.map((r) => r.pipeline_id);
  const { data: pipelines, error: pErr } = await admin
    .from("pipelines")
    .select("id")
    .eq("agency_id", agencyId)
    .in("id", pipelineIds);
  if (pErr) throw pErr;
  const owned = new Set((pipelines ?? []).map((p) => p.id));
  const leadIdsToDelete = rows.filter((r) => owned.has(r.pipeline_id)).map((r) => r.id);
  if (!leadIdsToDelete.length) return;

  const { error: delErr } = await admin.from("leads").delete().in("id", leadIdsToDelete);
  if (delErr) throw delErr;
}

function extractLocationId(root: Record<string, unknown>): string {
  const data = asRecord(root.data ?? root);
  return String(
    data.locationId ??
      data.location_id ??
      root.locationId ??
      root.location_id ??
      "",
  );
}

export async function processGhlWebhookDelivery(opts: {
  rawBody: string;
  payload: Record<string, unknown>;
}) {
  const admin = createAdminClient();
  const { payload } = opts;
  const type = String(payload.type ?? payload.event ?? "");
  const eventId = stableEventId(payload, type || "unknown");

  const { error: insErr } = await admin.from("webhook_events").insert({
    provider: "gohighlevel",
    event_id: eventId,
    payload,
    status: "received",
  });

  if (insErr) {
    if (insErr.code === "23505") {
      return { duplicate: true as const };
    }
    throw insErr;
  }

  const locationId = extractLocationId(payload);
  if (!locationId) {
    await admin
      .from("webhook_events")
      .update({
        status: "failed",
        error: "missing_location_id",
        processed_at: new Date().toISOString(),
      })
      .eq("provider", "gohighlevel")
      .eq("event_id", eventId);
    return { ok: false as const, reason: "missing_location_id" };
  }

  const { data: integration, error: intErr } = await admin
    .from("integrations")
    .select("id, agency_id")
    .eq("provider", "gohighlevel")
    .eq("external_location_id", locationId)
    .maybeSingle();

  if (intErr) throw intErr;
  if (!integration?.agency_id) {
    await admin
      .from("webhook_events")
      .update({
        status: "failed",
        error: "unknown_location",
        agency_id: null,
        integration_id: null,
        processed_at: new Date().toISOString(),
      })
      .eq("provider", "gohighlevel")
      .eq("event_id", eventId);
    return { ok: false as const, reason: "unknown_location" };
  }

  await admin
    .from("webhook_events")
    .update({
      integration_id: integration.id,
      agency_id: integration.agency_id,
    })
    .eq("provider", "gohighlevel")
    .eq("event_id", eventId);

  try {
    if (type === "OpportunityDelete") {
      const opp = normalizeOpportunityFromWebhook(payload);
      if (opp?.id) {
        await deleteMirroredOpportunity({
          admin,
          agencyId: integration.agency_id,
          opportunityId: opp.id,
        });
      }
      await insertActivityEvent(admin, {
        agency_id: integration.agency_id,
        actor_id: null,
        type: "webhook_opportunity_delete",
        title: "Opportunity deleted in GoHighLevel",
        body: opp?.name ?? opp?.id ?? "Opportunity",
        metadata: { webhookType: type, opportunityId: opp?.id ?? null },
        entity_type: "lead",
        entity_id: null,
      });
    } else if (
      type.includes("Opportunity") ||
      type === "OpportunityCreate" ||
      type === "OpportunityUpdate"
    ) {
      const opp = normalizeOpportunityFromWebhook(payload);
      if (!opp?.pipelineId) {
        throw new Error("Opportunity webhook missing pipelineId");
      }
      await upsertGhlOpportunityAsLead({
        supabase: admin,
        agencyId: integration.agency_id,
        externalPipelineId: opp.pipelineId,
        opportunity: opp,
      });

      await insertActivityEvent(admin, {
        agency_id: integration.agency_id,
        actor_id: null,
        type: "webhook_opportunity",
        title: "Opportunity updated from GoHighLevel",
        body: opp.name,
        metadata: { webhookType: type, opportunityId: opp.id },
        entity_type: "lead",
        entity_id: null,
      });
    } else if (type.includes("Contact")) {
      await insertActivityEvent(admin, {
        agency_id: integration.agency_id,
        actor_id: null,
        type: "webhook_contact",
        title: "Contact event received",
        body: type,
        metadata: { webhookType: type },
        entity_type: "integration",
        entity_id: integration.id,
      });
    } else {
      await insertActivityEvent(admin, {
        agency_id: integration.agency_id,
        actor_id: null,
        type: "webhook_misc",
        title: "Webhook received",
        body: type || "unknown",
        metadata: { webhookType: type },
        entity_type: "integration",
        entity_id: integration.id,
      });
    }

    await admin
      .from("webhook_events")
      .update({
        status: "processed",
        processed_at: new Date().toISOString(),
      })
      .eq("provider", "gohighlevel")
      .eq("event_id", eventId);

    return { ok: true as const };
  } catch (e) {
    const message = e instanceof Error ? e.message : "processing_error";
    await admin
      .from("webhook_events")
      .update({
        status: "failed",
        error: message,
        processed_at: new Date().toISOString(),
      })
      .eq("provider", "gohighlevel")
      .eq("event_id", eventId);

    await insertActivityEvent(admin, {
      agency_id: integration.agency_id,
      actor_id: null,
      type: "webhook_failed",
      title: "Webhook processing failed",
      body: message,
      metadata: { webhookType: type },
      entity_type: "integration",
      entity_id: integration.id,
    });

    throw e;
  }
}
