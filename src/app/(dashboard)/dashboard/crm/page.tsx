import Link from "next/link";

import { CrmWorkspace } from "@/components/crm/crm-workspace";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getActiveAgency } from "@/lib/auth/agency-context";
import { requireSession } from "@/lib/auth/session";
import { fetchCrmBoard } from "@/lib/crm/queries";
import { isSupabaseConfigured } from "@/lib/env";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CrmPage({
  searchParams,
}: {
  searchParams?: Promise<{ pipeline?: string }>;
}) {
  if (!isSupabaseConfigured()) {
    return (
      <Card className="glass-panel border-amber-500/30 bg-amber-500/5">
        <CardHeader>
          <CardTitle>Supabase not configured</CardTitle>
          <CardDescription>
            Configure Supabase to load pipelines and leads under RLS.
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
          <CardTitle>No active workspace</CardTitle>
          <CardDescription>
            Create an agency from the dashboard first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/dashboard"
            className="text-primary text-sm font-medium underline-offset-4 hover:underline"
          >
            Go to dashboard
          </Link>
        </CardContent>
      </Card>
    );
  }

  const params = searchParams ? await searchParams : {};
  const board = await fetchCrmBoard({
    supabase: agencyCtx.supabase,
    agencyId: agencyCtx.agencyId,
  });

  if (board.pipelines.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            CRM board
          </h1>
          <p className="text-muted-foreground mt-2 max-w-3xl text-sm leading-relaxed md:text-base">
            Kanban columns mirror internal stages. Pipelines and opportunities sync
            from GoHighLevel.
          </p>
        </div>
        <Card className="glass-panel border-border/50">
          <CardHeader>
            <CardTitle>No pipelines yet</CardTitle>
            <CardDescription>
              Connect GoHighLevel and run a full sync to create pipeline rows and
              leads for this workspace.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/dashboard/integrations"
              className="text-primary text-sm font-medium underline-offset-4 hover:underline"
            >
              Open integrations
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const requested = params.pipeline;
  const pipelineId =
    requested && board.pipelines.some((p) => p.id === requested)
      ? requested
      : board.pipelines[0]!.id;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            CRM board
          </h1>
          <p className="text-muted-foreground mt-2 max-w-3xl text-sm leading-relaxed md:text-base">
            Real leads from Supabase for{" "}
            <span className="text-foreground font-medium">
              {agencyCtx.agency.name}
            </span>
            . Drag cards to change stage; updates persist with optimistic UI.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {board.pipelines.map((p) => {
          const active = p.id === pipelineId;
          return (
            <Link key={p.id} href={`/dashboard/crm?pipeline=${p.id}`} scroll={false}>
              <Badge
                variant={active ? "default" : "outline"}
                className={cn(
                  "cursor-pointer px-3 py-1.5 text-xs font-medium transition",
                  !active && "hover:bg-muted/60",
                )}
              >
                {p.name}
              </Badge>
            </Link>
          );
        })}
      </div>

      <CrmWorkspace
        agencyId={agencyCtx.agencyId}
        pipelineId={pipelineId}
        initialLeads={board.leads}
      />
    </div>
  );
}
