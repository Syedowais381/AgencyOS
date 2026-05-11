import Link from "next/link";

import { GhlIntegrationPanel } from "@/components/integrations/ghl-integration-panel";
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
import {
  isIntegrationEncryptionConfigured,
  isServiceRoleConfigured,
} from "@/lib/env.server";
import { isSupabaseConfigured } from "@/lib/env";
import { listIntegrations } from "@/lib/integrations/registry";

export const dynamic = "force-dynamic";

function webhookBaseUrl() {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (site) return site;
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  }
  return "";
}

export default async function IntegrationsPage() {
  const registry = listIntegrations();

  if (!isSupabaseConfigured()) {
    return (
      <Card className="glass-panel border-amber-500/30 bg-amber-500/5">
        <CardHeader>
          <CardTitle>Supabase not configured</CardTitle>
          <CardDescription>
            Add public Supabase keys to enable authenticated integration management.
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
          <CardTitle>Select a workspace</CardTitle>
          <CardDescription>
            Create an agency from the dashboard, then return here to connect
            GoHighLevel.
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

  const base = webhookBaseUrl();
  const webhookEndpointUrl = base
    ? `${base}/api/webhooks/gohighlevel`
    : "https://YOUR_DOMAIN/api/webhooks/gohighlevel";

  const { data: ghlRows } = await agencyCtx.supabase
    .from("integrations")
    .select(
      "id, provider, status, health_status, last_sync_at, last_error, token_expires_at, external_location_id",
    )
    .eq("agency_id", agencyCtx.agencyId)
    .eq("provider", "gohighlevel")
    .limit(1);

  const ghlIntegration = ghlRows?.[0] ?? null;

  const { data: recentSyncRuns } = await agencyCtx.supabase
    .from("integration_sync_runs")
    .select("id, status, mode, started_at, finished_at")
    .eq("agency_id", agencyCtx.agencyId)
    .order("started_at", { ascending: false })
    .limit(8);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Integrations
        </h1>
        <p className="text-muted-foreground mt-2 max-w-3xl text-sm leading-relaxed md:text-base">
          Provider adapters run on the server. Secrets never reach the browser;
          health and sync history are stored per agency for observability.
        </p>
      </div>

      <GhlIntegrationPanel
        agencyId={agencyCtx.agencyId}
        memberRole={agencyCtx.memberRole}
        webhookEndpointUrl={webhookEndpointUrl}
        encryptionReady={isIntegrationEncryptionConfigured()}
        serviceRoleReady={isServiceRoleConfigured()}
        integration={ghlIntegration}
        recentSyncRuns={recentSyncRuns ?? []}
      />

      <div>
        <h2 className="mb-3 text-lg font-semibold tracking-tight">Roadmap registry</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {registry.map((i) => (
            <Card key={i.id} className="glass-panel border-border/50">
              <CardHeader className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base font-semibold tracking-tight">
                    {i.displayName}
                  </CardTitle>
                  <Badge variant="outline" className="capitalize">
                    {i.category}
                  </Badge>
                </div>
                <CardDescription className="font-mono text-xs">
                  {i.id}
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm">
                {i.docsUrl ? (
                  <Link
                    href={i.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary font-medium underline-offset-4 hover:underline"
                  >
                    Provider documentation
                  </Link>
                ) : (
                  <p className="text-muted-foreground">Docs link coming soon.</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <p className="text-muted-foreground text-sm">
        After connecting GHL, open the{" "}
        <Link href="/dashboard/crm" className="text-primary font-medium underline-offset-4 hover:underline">
          CRM board
        </Link>{" "}
        to work mirrored leads.
      </p>
    </div>
  );
}
