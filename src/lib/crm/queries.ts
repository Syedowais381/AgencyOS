import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { LeadStage } from "@/lib/crm/guess-internal-stage";

export type LeadRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  stage: LeadStage;
  value_cents: number;
  score: number;
  pipeline_id: string;
  external_id: string | null;
  updated_at: string | null;
};

export type PipelineRow = {
  id: string;
  name: string;
  external_id: string | null;
};

export async function fetchCrmBoard(opts: {
  supabase: SupabaseClient;
  agencyId: string;
}): Promise<{ pipelines: PipelineRow[]; leads: LeadRow[] }> {
  const { supabase, agencyId } = opts;

  const { data: pipelines, error: pErr } = await supabase
    .from("pipelines")
    .select("id, name, external_id")
    .eq("agency_id", agencyId)
    .order("name", { ascending: true });

  if (pErr) throw pErr;

  const plist = (pipelines ?? []) as PipelineRow[];
  const ids = plist.map((p) => p.id);
  if (ids.length === 0) {
    return { pipelines: [], leads: [] };
  }

  const { data: leads, error: lErr } = await supabase
    .from("leads")
    .select(
      "id, name, email, phone, stage, value_cents, score, pipeline_id, external_id, updated_at",
    )
    .in("pipeline_id", ids)
    .order("updated_at", { ascending: false });

  if (lErr) throw lErr;

  return { pipelines: plist, leads: (leads ?? []) as LeadRow[] };
}
