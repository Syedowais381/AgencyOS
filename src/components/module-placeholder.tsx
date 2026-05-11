import { Sparkles } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function ModulePlaceholder({
  title,
  description,
  phase,
}: {
  title: string;
  description: string;
  phase?: number;
}) {
  return (
    <Card className="glass-panel border-border/50 overflow-hidden">
      <CardHeader className="flex flex-row items-start gap-3 space-y-0">
        <div className="bg-primary/15 text-primary flex size-10 items-center justify-center rounded-xl ring-1 ring-primary/25">
          <Sparkles className="size-5" />
        </div>
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-lg font-semibold tracking-tight">
              {title}
            </CardTitle>
            {phase ? (
              <Badge variant="outline" className="border-primary/30 text-primary">
                Phase {phase}
              </Badge>
            ) : null}
          </div>
          <CardDescription className="text-sm leading-relaxed">
            {description}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm leading-relaxed">
          This module is scaffolded for the roadmap. Phase 1 ships auth,
          multi-tenant data, dashboard analytics, and CRM visualization. Later
          phases add deeper AI, automations, and channel integrations.
        </p>
      </CardContent>
    </Card>
  );
}
