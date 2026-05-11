import { DashboardActivityFeed } from "@/components/dashboard/dashboard-activity-feed";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { StageFunnelChart } from "@/components/dashboard/stage-funnel-chart";
import { TrendChart } from "@/components/dashboard/trend-chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getActiveAgency } from "@/lib/auth/agency-context";
import { requireSession } from "@/lib/auth/session";
import { getDashboardSnapshot } from "@/lib/analytics/dashboard";
import { formatUsdFromCents } from "@/lib/format";
import { isSupabaseConfigured } from "@/lib/env";

import { createAgency } from "./agency-actions";
import { CreateAgencyForm } from "./create-agency-form";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  if (!isSupabaseConfigured()) {
    return (
      <Card className="glass-panel border-amber-500/30 bg-amber-500/5">
        <CardHeader>
          <CardTitle>Finish Supabase setup</CardTitle>
          <CardDescription>
            Add keys to <code className="text-xs">.env.local</code> to enable
            auth, RLS-backed queries, and agency creation.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const ctx = await requireSession();
  const agencyCtx = await getActiveAgency(ctx);

  if (!agencyCtx) {
    return (
      <Card className="glass-panel border-border/50">
        <CardHeader>
          <CardTitle>Create your first agency</CardTitle>
          <CardDescription>
            Multi-tenant isolation is enforced with Row Level Security. You
            will be added as owner automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateAgencyForm action={createAgency} />
        </CardContent>
      </Card>
    );
  }

  const snapshot = await getDashboardSnapshot({
    supabase: agencyCtx.supabase,
    agencyId: agencyCtx.agencyId,
  });

  const funnelChartData = snapshot.series.funnel.map((f) => ({
    stage: f.stage.replaceAll("_", " "),
    count: f.count,
  }));

  const callsSeries = snapshot.series.callsOverTime.map((p) => ({
    date: p.date.slice(5),
    count: p.count,
  }));

  const contentSeries = snapshot.series.contentOverTime.map((p) => ({
    date: p.date.slice(5),
    count: p.views + Math.floor(p.engagement / 1000),
  }));

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">
            Intelligence overview
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed md:text-base">
            Live metrics for <span className="text-foreground font-medium">{agencyCtx.agency.name}</span>.
            Connect GoHighLevel and run a sync to populate CRM charts; webhooks keep the board fresh.
          </p>
        </div>
        <div className="glass-panel rounded-xl border border-border/50 px-4 py-3 text-sm">
          <p className="text-muted-foreground text-xs uppercase tracking-wider">
            Active workspace
          </p>
          <p className="font-medium tracking-tight">{agencyCtx.agency.name}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          title="Total leads"
          value={String(snapshot.kpis.totalLeads)}
          subtitle="Across mirrored pipelines"
          delay={0}
        />
        <KpiCard
          title="Pipeline value"
          value={formatUsdFromCents(snapshot.kpis.pipelineValueCents)}
          subtitle="Sum of opportunity values"
          delay={0.05}
        />
        <KpiCard
          title="Active clients"
          value={String(snapshot.kpis.activeClients)}
          subtitle="status = active"
          delay={0.1}
        />
        <KpiCard
          title="Tasks due"
          value={String(snapshot.kpis.tasksDue)}
          subtitle="Open tasks past due date"
          delay={0.15}
        />
        <KpiCard
          title="Calls logged"
          value={String(snapshot.kpis.callsCompleted)}
          subtitle="Sales calls with a timestamp"
          delay={0.2}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="min-h-0 lg:col-span-2">
          <TrendChart
            title="New leads (14 days)"
            subtitle="Created timestamps across all pipelines in this agency."
            points={snapshot.series.leadsOverTime.map((p) => ({
              date: p.date.slice(5),
              count: p.count,
            }))}
            valueLabel="Leads"
            gradientId="leadsFill"
          />
        </div>
        <div className="min-h-0">
          <StageFunnelChart
            title="Pipeline funnel"
            subtitle="Counts by internal stage for this agency."
            data={funnelChartData}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="min-h-0 lg:col-span-2">
          <TrendChart
            title="Sales calls (14 days)"
            subtitle="Calls with a started_at timestamp."
            points={callsSeries}
            valueLabel="Calls"
            gradientId="callsFill"
          />
        </div>
        <div className="min-h-0">
          <TrendChart
            title="Content performance (14 days)"
            subtitle="Views + engagement/1000 across client-linked analytics rows."
            points={contentSeries}
            valueLabel="Index"
            gradientId="contentFill"
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className="glass-panel border-border/50">
            <CardHeader>
              <CardTitle>Upcoming / overdue tasks</CardTitle>
              <CardDescription>
                Open tasks with due_at in the past (first 8 shown).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {snapshot.feed.tasksSample.length === 0 ? (
                <p className="text-muted-foreground text-sm">No overdue open tasks.</p>
              ) : (
                <ul className="text-sm">
                  {snapshot.feed.tasksSample.map((t) => (
                    <li
                      key={t.id}
                      className="border-border/50 flex justify-between border-b py-2 last:border-0"
                    >
                      <span>{t.title}</span>
                      <span className="text-muted-foreground text-xs">
                        {t.due_at ? new Date(t.due_at).toLocaleString() : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
        <DashboardActivityFeed items={snapshot.feed.items} />
      </div>
    </div>
  );
}
