"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { insertActivityEvent } from "@/lib/activity/events";
import { requireAgencyMember } from "@/lib/auth/agency-context";
import { requireSession } from "@/lib/auth/session";
import { encryptJson } from "@/lib/crypto/integration-secrets";
import { GhlClient } from "@/lib/integrations/gohighlevel/client";
import { loadGhlCredential, persistRotatedCredential } from "@/lib/integrations/gohighlevel/sync";
import { getServerEnv } from "@/lib/env.server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { LeadStage } from "@/lib/crm/guess-internal-stage";

const stages: z.ZodType<LeadStage> = z.enum([
  "new",
  "contacted",
  "qualified",
  "appointment_set",
  "showed",
  "won",
  "lost",
]);

const moveSchema = z.object({
  agencyId: z.string().uuid(),
  leadId: z.string().uuid(),
  toStage: stages,
});

export async function moveLeadToStage(formData: FormData) {
  const parsed = moveSchema.safeParse({
    agencyId: String(formData.get("agencyId") ?? ""),
    leadId: String(formData.get("leadId") ?? ""),
    toStage: String(formData.get("toStage") ?? ""),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.message);
  }

  const ctx = await requireSession();
  await requireAgencyMember(ctx, parsed.data.agencyId);

  const { data: lead, error: lErr } = await ctx.supabase
    .from("leads")
    .select(
      "id, stage, external_id, pipeline_id, pipelines!inner(agency_id, external_id)",
    )
    .eq("id", parsed.data.leadId)
    .maybeSingle();

  if (lErr || !lead) throw new Error("Lead not found");
  const pipeline = lead.pipelines as unknown as {
    agency_id: string;
    external_id: string | null;
  };
  if (pipeline.agency_id !== parsed.data.agencyId) {
    throw new Error("Lead not in workspace");
  }

  const fromStage = lead.stage as LeadStage;

  const { error: uErr } = await ctx.supabase
    .from("leads")
    .update({
      stage: parsed.data.toStage,
      updated_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.leadId);
  if (uErr) throw new Error(uErr.message);

  await ctx.supabase.from("lead_activities").insert({
    lead_id: parsed.data.leadId,
    source: "app",
    kind: "stage_change",
    payload: { from: fromStage, to: parsed.data.toStage },
  });

  await insertActivityEvent(ctx.supabase, {
    agency_id: parsed.data.agencyId,
    actor_id: ctx.user.id,
    type: "lead_stage_change",
    title: "Lead stage updated",
    body: `${fromStage} → ${parsed.data.toStage}`,
    metadata: { leadId: parsed.data.leadId },
    entity_type: "lead",
    entity_id: parsed.data.leadId,
  });

  const { data: integ } = await ctx.supabase
    .from("integrations")
    .select("id")
    .eq("agency_id", parsed.data.agencyId)
    .eq("provider", "gohighlevel")
    .eq("status", "connected")
    .maybeSingle();

  if (integ?.id && lead.external_id && pipeline.external_id) {
    const { data: extStage } = await ctx.supabase
      .from("crm_stage_map")
      .select("external_stage_id")
      .eq("agency_id", parsed.data.agencyId)
      .eq("external_pipeline_id", pipeline.external_id)
      .eq("internal_stage", parsed.data.toStage)
      .maybeSingle();

    if (extStage?.external_stage_id) {
      const admin = createAdminClient();
      const cred = await loadGhlCredential(admin, integ.id);
      const env = getServerEnv();
      const ghl = new GhlClient({
        credential: cred,
        clientId: env.GHL_OAUTH_CLIENT_ID,
        clientSecret: env.GHL_OAUTH_CLIENT_SECRET,
        onCredentialRotated: async (next) => {
          await persistRotatedCredential(admin, integ.id, next, (c) => encryptJson(c));
        },
      });
      try {
        await ghl.updateOpportunity(lead.external_id, {
          pipelineStageId: extStage.external_stage_id,
        });
      } catch (e) {
        console.error("[ghl] push stage failed", e);
      }
    }
  }

  revalidatePath("/dashboard/crm");
}

const noteSchema = z.object({
  agencyId: z.string().uuid(),
  leadId: z.string().uuid(),
  body: z.string().min(1).max(8000),
});

export async function addLeadNote(formData: FormData) {
  const parsed = noteSchema.safeParse({
    agencyId: String(formData.get("agencyId") ?? ""),
    leadId: String(formData.get("leadId") ?? ""),
    body: String(formData.get("body") ?? ""),
  });
  if (!parsed.success) throw new Error("Invalid note");

  const ctx = await requireSession();
  await requireAgencyMember(ctx, parsed.data.agencyId);

  const { data: lead, error: lErr } = await ctx.supabase
    .from("leads")
    .select("id, pipelines!inner(agency_id)")
    .eq("id", parsed.data.leadId)
    .maybeSingle();
  if (lErr || !lead) throw new Error("Lead not found");
  const p = lead.pipelines as unknown as { agency_id: string };
  if (p.agency_id !== parsed.data.agencyId) throw new Error("Forbidden");

  const { error } = await ctx.supabase.from("lead_notes").insert({
    lead_id: parsed.data.leadId,
    author_id: ctx.user.id,
    body: parsed.data.body,
  });
  if (error) throw new Error(error.message);

  await insertActivityEvent(ctx.supabase, {
    agency_id: parsed.data.agencyId,
    actor_id: ctx.user.id,
    type: "lead_note",
    title: "Lead note added",
    metadata: { leadId: parsed.data.leadId },
    entity_type: "lead",
    entity_id: parsed.data.leadId,
  });

  revalidatePath("/dashboard/crm");
}

export async function getLeadWorkspaceBundle(opts: {
  agencyId: string;
  leadId: string;
}) {
  const ctx = await requireSession();
  await requireAgencyMember(ctx, opts.agencyId);

  const { data: lead, error: lErr } = await ctx.supabase
    .from("leads")
    .select(
      "id, name, email, phone, stage, value_cents, score, metadata, created_at, updated_at, external_id, pipeline_id, pipelines!inner(id, name, agency_id, external_id)",
    )
    .eq("id", opts.leadId)
    .maybeSingle();

  if (lErr || !lead) return null;
  const pipe = lead.pipelines as unknown as { agency_id: string };
  if (pipe.agency_id !== opts.agencyId) return null;

  const [{ data: notes }, { data: activities }] = await Promise.all([
    ctx.supabase
      .from("lead_notes")
      .select("id, body, created_at, author_id")
      .eq("lead_id", opts.leadId)
      .order("created_at", { ascending: false })
      .limit(50),
    ctx.supabase
      .from("lead_activities")
      .select("id, kind, payload, created_at, source")
      .eq("lead_id", opts.leadId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return { lead, notes: notes ?? [], activities: activities ?? [] };
}
