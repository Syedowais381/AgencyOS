"use client";

import { motion } from "framer-motion";
import { Activity, Webhook, Wrench } from "lucide-react";

import { formatIsoUtc } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

export type DashboardFeedItem = {
  id: string;
  kind: "activity" | "sync" | "webhook";
  title: string;
  body: string;
  created_at: string;
};

function iconFor(kind: DashboardFeedItem["kind"]) {
  if (kind === "webhook") return Webhook;
  if (kind === "sync") return Wrench;
  return Activity;
}

export function DashboardActivityFeed({ items }: { items: DashboardFeedItem[] }) {
  return (
    <Card className="glass-panel border-border/50 flex max-h-[420px] flex-col">
      <CardHeader>
        <CardTitle className="text-base font-semibold tracking-tight">
          Operations feed
        </CardTitle>
        <p className="text-muted-foreground text-sm">
          Activity, sync runs, and webhook deliveries for this workspace.
        </p>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 pt-0">
        <ScrollArea className="h-[300px] pr-3">
          <div className="space-y-4">
            {items.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No activity yet. Run a CRM sync or connect GoHighLevel webhooks.
              </p>
            ) : (
              items.map((item, i) => {
                const Icon = iconFor(item.kind);
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.02 * i }}
                    className="flex gap-3"
                  >
                    <div className="bg-primary/12 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-primary/20">
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-none">{item.title}</p>
                        <span className="text-muted-foreground shrink-0 text-xs">
                          {formatIsoUtc(item.created_at)}
                        </span>
                      </div>
                      <p className="text-muted-foreground text-sm leading-snug">
                        {item.body}
                      </p>
                      <Separator className="mt-3 bg-border/50" />
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
