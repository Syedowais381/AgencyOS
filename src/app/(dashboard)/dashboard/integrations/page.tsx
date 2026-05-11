import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { listIntegrations } from "@/lib/integrations/registry";

export default function IntegrationsPage() {
  const items = listIntegrations();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Integrations
        </h1>
        <p className="text-muted-foreground mt-2 max-w-3xl text-sm leading-relaxed md:text-base">
          Provider registry for the Agency OS. Each integration gets a typed
          adapter, encrypted credentials on the server, and a row in the
          `integrations` table for health monitoring.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((i) => (
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
  );
}
