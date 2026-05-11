import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { LeadStage } from "@/lib/crm/guess-internal-stage";

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function lastNDaysKeys(n: number) {
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    keys.push(dayKey(d));
  }
  return keys;
}

function bucketCounts(
  dates: (string | null | undefined)[],
  keys: string[],
): { date: string; count: number }[] {
  const map = new Map<string, number>();
  for (const k of keys) map.set(k, 0);
  for (const dt of dates) {
    if (!dt) continue;
    const k = dt.slice(0, 10);
    if (map.has(k)) map.set(k, (map.get(k) ?? 0) + 1);
  }
  return keys.map((date) => ({ date, count: map.get(date) ?? 0 }));
}

export async function getDashboardSnapshot(opts: {
  supabase: SupabaseClient;
  agencyId: string;
}) {
  const { supabase, agencyId } = opts;

  const { data: pipelines } = await supabase
    .from("pipelines")
    .select("id")
    .eq("agency_id", agencyId);
  const pipelineIds = (pipelines ?? []).map((p) => p.id);

  const [
    leadsRes,
    clientsRes,
    tasksRes,
    callsRes,
    syncRes,
    webhookRes,
    activityRes,
  ] = await Promise.all([
    pipelineIds.length
      ? supabase
          .from("leads")
          .select("id, value_cents, created_at, updated_at, stage")
          .in("pipeline_id", pipelineIds)
      : Promise.resolve({
          data: [] as {
            id: string;
            value_cents: number;
            created_at: string;
            updated_at: string;
            stage: string;
          }[],
          error: null,
        }),
    supabase
      .from("clients")
      .select("id, status")
      .eq("agency_id", agencyId)
      .eq("status", "active"),
    supabase
      .from("tasks")
      .select("id, title, due_at, status")
      .eq("agency_id", agencyId)
      .lte("due_at", new Date().toISOString())
      .eq("status", "open"),
    supabase
      .from("sales_calls")
      .select("id, started_at")
      .eq("agency_id", agencyId)
      .not("started_at", "is", null),
    supabase
      .from("integration_sync_runs")
      .select("id, status, started_at, finished_at, mode, integration_id")
      .eq("agency_id", agencyId)
      .order("started_at", { ascending: false })
      .limit(15),
    supabase
      .from("webhook_events")
      .select("id, status, created_at, event_id")
      .eq("agency_id", agencyId)
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("activity_events")
      .select("id, type, title, body, created_at, metadata")
      .eq("agency_id", agencyId)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const leads = leadsRes.data ?? [];
  const totalLeads = leads.length;
  const pipelineValueCents = leads.reduce((s, l) => s + (l.value_cents ?? 0), 0);
  const activeClients = (clientsRes.data ?? []).length;
  const tasksDue = (tasksRes.data ?? []).length;
  const callsCompleted = (callsRes.data ?? []).length;

  const keys = lastNDaysKeys(14);
  const leadsOverTime = bucketCounts(
    leads.map((l) => l.created_at),
    keys,
  );

  const { data: calls } = await supabase
    .from("sales_calls")
    .select("started_at")
    .eq("agency_id", agencyId)
    .gte(
      "started_at",
      new Date(Date.now() - 14 * 86400_000).toISOString(),
    );

  const callsOverTime = bucketCounts(
    (calls ?? []).map((c) => c.started_at),
    keys,
  );

  const { data: clientsForContent } = await supabase
    .from("clients")
    .select("id")
    .eq("agency_id", agencyId);
  const clientIds = (clientsForContent ?? []).map((c) => c.id);

  let contentOverTime = keys.map((date) => ({
    date,
    views: 0,
    engagement: 0,
  }));

  if (clientIds.length > 0) {
    const { data: ca } = await supabase
      .from("content_analytics")
      .select("metric_date, views, engagement")
      .in("client_id", clientIds)
      .gte(
        "metric_date",
        keys[0] ?? new Date().toISOString().slice(0, 10),
      );
    const byDay = new Map<string, { views: number; engagement: number }>();
    for (const k of keys) byDay.set(k, { views: 0, engagement: 0 });
    for (const row of ca ?? []) {
      const k = row.metric_date;
      const cur = byDay.get(k) ?? { views: 0, engagement: 0 };
      cur.views += Number(row.views ?? 0);
      cur.engagement += Number(row.engagement ?? 0);
      byDay.set(k, cur);
    }
    contentOverTime = keys.map((date) => ({
      date,
      views: byDay.get(date)?.views ?? 0,
      engagement: byDay.get(date)?.engagement ?? 0,
    }));
  }

  const integrations = await supabase
    .from("integrations")
    .select(
      "id, provider, status, health_status, last_sync_at, last_error, token_expires_at, external_location_id",
    )
    .eq("agency_id", agencyId);

  type FeedItem = {
    id: string;
    kind: "activity" | "sync" | "webhook";
    title: string;
    body: string;
    created_at: string;
  };

  const feedItems: FeedItem[] = [];
  for (const a of activityRes.data ?? []) {
    feedItems.push({
      id: `a-${a.id}`,
      kind: "activity",
      title: a.title,
      body: a.body ?? a.type,
      created_at: a.created_at,
    });
  }
  for (const s of syncRes.data ?? []) {
    feedItems.push({
      id: `s-${s.id}`,
      kind: "sync",
      title: `CRM sync · ${s.mode}`,
      body: `Status: ${s.status}`,
      created_at: s.started_at,
    });
  }
  for (const w of webhookRes.data ?? []) {
    feedItems.push({
      id: `w-${w.id}`,
      kind: "webhook",
      title: `Webhook · ${w.event_id}`,
      body: `Status: ${w.status}`,
      created_at: w.created_at,
    });
  }
  feedItems.sort((x, y) => y.created_at.localeCompare(x.created_at));
  const feedMerged = feedItems.slice(0, 40);

  const funnelStages: LeadStage[] = [
    "new",
    "contacted",
    "qualified",
    "appointment_set",
    "showed",
    "won",
    "lost",
  ];
  const funnel = funnelStages.map((stage) => ({
    stage,
    count: leads.filter((l) => l.stage === stage).length,
  }));

  return {
    kpis: {
      totalLeads,
      pipelineValueCents,
      activeClients,
      tasksDue,
      callsCompleted,
    },
    series: {
      leadsOverTime,
      callsOverTime,
      contentOverTime,
      funnel,
    },
    feed: {
      items: feedMerged,
      tasksSample: (tasksRes.data ?? []).slice(0, 8),
    },
    integrations: integrations.data ?? [],
  };
}
