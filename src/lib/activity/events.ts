import type { SupabaseClient } from "@supabase/supabase-js";

export type ActivityEventInput = {
  agency_id: string;
  actor_id?: string | null;
  type: string;
  title: string;
  body?: string | null;
  metadata?: Record<string, unknown>;
  entity_type?: string | null;
  entity_id?: string | null;
};

export async function insertActivityEvent(
  db: SupabaseClient,
  input: ActivityEventInput,
) {
  const { error } = await db.from("activity_events").insert({
    agency_id: input.agency_id,
    actor_id: input.actor_id ?? null,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    metadata: input.metadata ?? {},
    entity_type: input.entity_type ?? null,
    entity_id: input.entity_id ?? null,
  });
  if (error) throw error;
}
