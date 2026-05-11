import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveLeadStageForGhlOpportunity } from "@/lib/crm/resolve-stage";
import type { GhlOpportunity } from "@/lib/integrations/gohighlevel/types";

export async function upsertGhlOpportunityAsLead(opts: {
  supabase: SupabaseClient;
  agencyId: string;
  externalPipelineId: string;
  opportunity: GhlOpportunity;
}) {
  const { supabase, agencyId, externalPipelineId, opportunity } = opts;

  const { data: pipe, error: pErr } = await supabase
    .from("pipelines")
    .select("id")
    .eq("agency_id", agencyId)
    .eq("external_id", externalPipelineId)
    .maybeSingle();

  if (pErr) throw pErr;
  if (!pipe) {
    throw new Error(
      `Pipeline ${externalPipelineId} is not mirrored yet — run a CRM sync.`,
    );
  }

  const stage = await resolveLeadStageForGhlOpportunity({
    supabase,
    agencyId,
    externalPipelineId,
    externalStageId: opportunity.pipelineStageId,
    opportunityStatus: opportunity.status,
  });

  const valueCents = Math.round((opportunity.monetaryValue ?? 0) * 100);
  const externalUpdatedAt = opportunity.updatedAt
    ? new Date(opportunity.updatedAt).toISOString()
    : null;

  const { error } = await supabase.from("leads").upsert(
    {
      pipeline_id: pipe.id,
      external_id: opportunity.id,
      name: opportunity.name ?? "Untitled opportunity",
      email: null,
      stage,
      value_cents: valueCents,
      score: 0,
      attribution: {},
      metadata: { ghl: opportunity },
      external_updated_at: externalUpdatedAt,
      last_activity_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "pipeline_id,external_id" },
  );
  if (error) throw error;
}
