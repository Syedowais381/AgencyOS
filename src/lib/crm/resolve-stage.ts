import type { SupabaseClient } from "@supabase/supabase-js";

import {
  guessInternalStageFromGhlStageName,
  mapGhlOpportunityStatusToStage,
  type LeadStage,
} from "@/lib/crm/guess-internal-stage";

export async function resolveLeadStageForGhlOpportunity(opts: {
  supabase: SupabaseClient;
  agencyId: string;
  externalPipelineId: string | undefined;
  externalStageId: string | undefined;
  stageNameHint?: string;
  opportunityStatus?: string;
}): Promise<LeadStage> {
  const {
    supabase,
    agencyId,
    externalPipelineId,
    externalStageId,
    stageNameHint,
    opportunityStatus,
  } = opts;

  if (externalStageId) {
    let q = supabase
      .from("crm_stage_map")
      .select("internal_stage")
      .eq("agency_id", agencyId)
      .eq("external_stage_id", externalStageId);
    if (externalPipelineId) {
      q = q.eq("external_pipeline_id", externalPipelineId);
    }
    const { data } = await q.maybeSingle();
    if (data?.internal_stage) {
      return data.internal_stage as LeadStage;
    }
  }

  const guessedFromName = stageNameHint
    ? guessInternalStageFromGhlStageName(stageNameHint)
    : "new";
  return mapGhlOpportunityStatusToStage(opportunityStatus, guessedFromName);
}
