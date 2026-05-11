import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { FunnelChart } from "@/components/dashboard/funnel-chart";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

import { createAgency } from "./agency-actions";
import { CreateAgencyForm } from "./create-agency-form";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let agencies: { id: string; name: string; slug: string }[] = [];
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("agencies")
      .select("id,name,slug")
      .order("created_at", { ascending: false });
    agencies = data ?? [];
  }

  const activeAgency = agencies[0];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">
            Intelligence overview
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed md:text-base">
            Centralize revenue, pipeline, content, and team signals. Phase 1
            ships the shell, auth, tenant model, and visualization-ready
            analytics.
          </p>
        </div>
        {activeAgency ? (
          <div className="glass-panel rounded-xl border border-border/50 px-4 py-3 text-sm">
            <p className="text-muted-foreground text-xs uppercase tracking-wider">
              Active workspace
            </p>
            <p className="font-medium tracking-tight">{activeAgency.name}</p>
          </div>
        ) : null}
      </div>

      {!isSupabaseConfigured() ? (
        <Card className="glass-panel border-amber-500/30 bg-amber-500/5">
          <CardHeader>
            <CardTitle>Finish Supabase setup</CardTitle>
            <CardDescription>
              Add keys to <code className="text-xs">.env.local</code> to enable
              auth, RLS-backed queries, and agency creation.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : agencies.length === 0 ? (
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
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="MRR"
          value="$128.4k"
          subtitle="Normalized demo metric"
          trend={{ label: "+6.4% vs last month", positive: true }}
          delay={0}
        />
        <KpiCard
          title="Cash collected (MTD)"
          value="$94.2k"
          trend={{ label: "On pace vs forecast", positive: true }}
          delay={0.05}
        />
        <KpiCard
          title="Active clients"
          value={activeAgency ? "24" : "—"}
          subtitle={activeAgency ? "Across pipelines" : "Create an agency to track"}
          delay={0.1}
        />
        <KpiCard
          title="Pipeline value"
          value="$512k"
          trend={{ label: "Weighted across stages", positive: true }}
          delay={0.15}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="min-h-0 lg:col-span-2">
          <RevenueChart />
        </div>
        <div className="min-h-0">
          <FunnelChart />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2 lg:grid-cols-2">
          <KpiCard
            title="Show rate"
            value="68%"
            trend={{ label: "+3 pts vs trailing 30d", positive: true }}
            delay={0}
          />
          <KpiCard
            title="Close rate"
            value="29%"
            trend={{ label: "Setter-assisted deals", positive: true }}
            delay={0.05}
          />
          <KpiCard
            title="Conversion rate"
            value="4.8%"
            subtitle="Lead → booked call"
            delay={0.1}
          />
          <KpiCard
            title="Active students"
            value="312"
            subtitle="Programs in delivery"
            delay={0.15}
          />
        </div>
        <ActivityFeed />
      </div>
    </div>
  );
}
