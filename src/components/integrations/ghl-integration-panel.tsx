"use client";

import { useActionState, useMemo, useState } from "react";
import { Check, Copy, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { AgencyMemberRole } from "@/lib/auth/agency-context";
import {
  connectGoHighLevel,
  disconnectGoHighLevel,
  type GhlConnectState,
  type GhlDisconnectState,
} from "@/server/actions/ghl-integration";
import {
  triggerGhlCrmSync,
  type CrmSyncState,
} from "@/server/actions/crm-sync";

export type GhlIntegrationRow = {
  id: string;
  provider: string;
  status: string;
  health_status: string | null;
  last_sync_at: string | null;
  last_error: string | null;
  token_expires_at: string | null;
  external_location_id: string | null;
};

export type SyncRunRow = {
  id: string;
  status: string;
  mode: string;
  started_at: string;
  finished_at: string | null;
};

function formatIsoUtc(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toISOString().replace("T", " ").replace("Z", " UTC");
}

function healthBadgeVariant(
  health: string | null,
): "default" | "secondary" | "destructive" | "outline" {
  if (health === "healthy") return "default";
  if (health === "degraded" || health === "warning") return "secondary";
  if (health === "error" || health === "unhealthy") return "destructive";
  return "outline";
}

export function GhlIntegrationPanel({
  agencyId,
  memberRole,
  webhookEndpointUrl,
  encryptionReady,
  serviceRoleReady,
  integration,
  recentSyncRuns,
}: {
  agencyId: string;
  memberRole: AgencyMemberRole;
  webhookEndpointUrl: string;
  encryptionReady: boolean;
  serviceRoleReady: boolean;
  integration: GhlIntegrationRow | null;
  recentSyncRuns: SyncRunRow[];
}) {
  const canAdmin = memberRole === "owner" || memberRole === "admin";
  const [connectState, connectAction, connectPending] = useActionState<
    GhlConnectState,
    FormData
  >(connectGoHighLevel, {});
  const [fullState, fullAction, fullPending] = useActionState<
    CrmSyncState,
    FormData
  >(triggerGhlCrmSync, {});
  const [incrState, incrAction, incrPending] = useActionState<
    CrmSyncState,
    FormData
  >(triggerGhlCrmSync, {});
  const [copied, setCopied] = useState(false);
  const [disconnectState, disconnectAction, disconnectPending] = useActionState<
    GhlDisconnectState,
    FormData
  >(disconnectGoHighLevel, {});

  const syncPending = fullPending || incrPending || disconnectPending;

  const connectError = useMemo(() => {
    if (connectState.success) return null;
    return connectState.error ?? null;
  }, [connectState.error, connectState.success]);

  const syncMessage = useMemo(() => {
    if (fullState.error) return fullState.error;
    if (incrState.error) return incrState.error;
    if (fullState.success && fullState.stats) return fullState.stats;
    if (incrState.success && incrState.stats) return incrState.stats;
    return null;
  }, [fullState, incrState]);

  async function copyWebhook() {
    try {
      await navigator.clipboard.writeText(webhookEndpointUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Card className="glass-panel border-border/50">
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-lg font-semibold tracking-tight">
            GoHighLevel
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="capitalize">
              {integration?.status ?? "not connected"}
            </Badge>
            {integration ? (
              <Badge variant={healthBadgeVariant(integration.health_status)}>
                {integration.health_status ?? "unknown"}
              </Badge>
            ) : null}
          </div>
        </div>
        <CardDescription>
          Credentials are validated server-side, encrypted with AES-256-GCM, and
          stored in <span className="font-mono text-xs">integration_credentials</span>
          (RLS blocks direct reads). Webhooks are verified and deduplicated before
          writes.
        </CardDescription>
        <ol className="text-muted-foreground list-decimal space-y-1.5 pl-5 text-xs leading-relaxed">
          <li>
            Set server env:{" "}
            <code className="font-mono text-[11px]">INTEGRATION_ENCRYPTION_KEY</code>,{" "}
            <code className="font-mono text-[11px]">SUPABASE_SERVICE_ROLE_KEY</code>
            (local <span className="font-mono text-[11px]">.env.local</span> or Vercel
            project settings).
          </li>
          <li>
            In GHL: create a Private Integration token (PIT) with scopes that include
            opportunities/pipelines for your sub-account.
          </li>
          <li>
            Paste <span className="text-foreground font-medium">Location ID</span> and
            token below, then <span className="text-foreground font-medium">Validate &amp; save</span>.
          </li>
          <li>
            Copy the webhook URL into GHL (production needs a public HTTPS URL), then
            run <span className="text-foreground font-medium">Full CRM sync</span>.
          </li>
        </ol>
      </CardHeader>
      <CardContent className="space-y-6 text-sm">
        {!encryptionReady ? (
          <p className="text-destructive text-sm">
            Set <code className="font-mono text-xs">INTEGRATION_ENCRYPTION_KEY</code>{" "}
            on the server to connect or sync.
          </p>
        ) : null}
        {!serviceRoleReady ? (
          <p className="text-amber-600 text-sm dark:text-amber-400">
            <code className="font-mono text-xs">SUPABASE_SERVICE_ROLE_KEY</code> is
            required for credential persistence and verified webhook processing.
          </p>
        ) : null}

        <div className="space-y-2">
          <Label>Inbound webhook URL</Label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="bg-muted/60 max-w-full flex-1 truncate rounded-md border px-2 py-1.5 text-xs">
              {webhookEndpointUrl}
            </code>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="shrink-0"
              onClick={() => void copyWebhook()}
            >
              {copied ? (
                <>
                  <Check className="mr-1 size-4" /> Copied
                </>
              ) : (
                <>
                  <Copy className="mr-1 size-4" /> Copy
                </>
              )}
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            HighLevel signs deliveries with their published keys; this route verifies
            the signature, applies replay protection, then processes the payload
            asynchronously.
          </p>
        </div>

        {integration ? (
          <div className="text-muted-foreground grid gap-1 text-xs sm:grid-cols-2">
            <p>
              <span className="text-foreground font-medium">Location</span>:{" "}
              {integration.external_location_id ?? "—"}
            </p>
            <p>
              <span className="text-foreground font-medium">Last sync</span>:{" "}
              {formatIsoUtc(integration.last_sync_at)}
            </p>
            <p className="sm:col-span-2">
              <span className="text-foreground font-medium">Token expiry</span>:{" "}
              {formatIsoUtc(integration.token_expires_at)}
            </p>
            {integration.last_error ? (
              <p className="text-destructive sm:col-span-2">
                Last error: {integration.last_error}
              </p>
            ) : null}
          </div>
        ) : null}

        {integration && canAdmin ? (
          <div className="flex flex-wrap gap-2">
            <form action={fullAction} className="inline">
              <input type="hidden" name="agencyId" value={agencyId} />
              <input type="hidden" name="integrationId" value={integration.id} />
              <input type="hidden" name="mode" value="full" />
              <Button type="submit" disabled={syncPending || !encryptionReady}>
                {fullPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Full CRM sync"
                )}
              </Button>
            </form>
            <form action={incrAction} className="inline">
              <input type="hidden" name="agencyId" value={agencyId} />
              <input type="hidden" name="integrationId" value={integration.id} />
              <input type="hidden" name="mode" value="incremental" />
              <Button
                type="submit"
                variant="secondary"
                disabled={syncPending || !encryptionReady}
              >
                {incrPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Incremental sync"
                )}
              </Button>
            </form>
          </div>
        ) : null}

        {syncMessage ? (
          <p className="text-foreground text-sm font-medium">{syncMessage}</p>
        ) : null}

        {recentSyncRuns.length > 0 ? (
          <div>
            <p className="mb-2 font-medium">Recent sync runs</p>
            <ul className="text-muted-foreground max-h-40 space-y-1 overflow-auto text-xs">
              {recentSyncRuns.map((r) => (
                <li
                  key={r.id}
                  className="flex justify-between gap-2 border-b border-border/40 py-1 last:border-0"
                >
                  <span className="capitalize">
                    {r.mode} · {r.status}
                  </span>
                  <span>{formatIsoUtc(r.started_at)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {canAdmin ? (
          <div className="border-border/60 space-y-4 border-t pt-4">
            <p className="font-medium">Connect or rotate token</p>
            <form action={connectAction} className="grid max-w-lg gap-3">
              <input type="hidden" name="agencyId" value={agencyId} />
              <div className="grid gap-2">
                <Label htmlFor="ghl-location">Location ID</Label>
                <Input
                  id="ghl-location"
                  name="locationId"
                  placeholder="Sub-account location id"
                  required
                  autoComplete="off"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ghl-token">Access token (PIT or OAuth access)</Label>
                <Input
                  id="ghl-token"
                  name="accessToken"
                  type="password"
                  required
                  autoComplete="off"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ghl-token-kind">Token type</Label>
                <select
                  id="ghl-token-kind"
                  name="tokenKind"
                  defaultValue="pit"
                  aria-label="GoHighLevel token type"
                  className={cn(
                    "border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none",
                  )}
                >
                  <option value="pit">Private integration token</option>
                  <option value="oauth">OAuth access token</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ghl-refresh">Refresh token (OAuth only)</Label>
                <Input
                  id="ghl-refresh"
                  name="refreshToken"
                  autoComplete="off"
                  placeholder="Optional"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ghl-exp">Access token expiry (ISO, OAuth)</Label>
                <Input
                  id="ghl-exp"
                  name="expiresAt"
                  placeholder="2026-01-01T00:00:00.000Z"
                  autoComplete="off"
                />
              </div>
              {connectError ? (
                <p className="text-destructive text-sm">{connectError}</p>
              ) : null}
              {connectState.success ? (
                <p className="text-primary text-sm font-medium">
                  Connected. Run a CRM sync to hydrate pipelines.
                </p>
              ) : null}
              <Button type="submit" disabled={connectPending || !encryptionReady}>
                {connectPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Validate & save"
                )}
              </Button>
            </form>

            {integration ? (
              <form
                action={disconnectAction}
                className="pt-2"
                onSubmit={(e) => {
                  const ok = window.confirm(
                    "Disconnect GoHighLevel and remove encrypted credentials for this workspace?",
                  );
                  if (!ok) e.preventDefault();
                }}
              >
                <input type="hidden" name="agencyId" value={agencyId} />
                <input type="hidden" name="integrationId" value={integration.id} />
                <Button
                  type="submit"
                  variant="destructive"
                  size="sm"
                  disabled={disconnectPending}
                >
                  {disconnectPending ? (
                    <>
                      <Loader2 className="mr-1 size-4 animate-spin" />
                      Disconnecting...
                    </>
                  ) : (
                    "Disconnect & remove secrets"
                  )}
                </Button>
                {disconnectState.error ? (
                  <p className="text-destructive mt-2 text-xs">{disconnectState.error}</p>
                ) : null}
                {disconnectState.success ? (
                  <p className="text-primary mt-2 text-xs">
                    Integration disconnected and credentials removed.
                  </p>
                ) : null}
              </form>
            ) : null}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            Only workspace owners and admins can manage integration credentials.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
