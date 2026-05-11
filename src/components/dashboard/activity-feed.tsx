"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, Radio, Zap } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

const items = [
  {
    title: "Pipeline sync",
    body: "GoHighLevel webhook received · 24 leads updated",
    time: "2m ago",
    icon: Radio,
  },
  {
    title: "Setter handoff",
    body: "Jordan qualified Acme Co. for strategy call",
    time: "18m ago",
    icon: Zap,
  },
  {
    title: "Revenue pulse",
    body: "Cash collected crossed weekly target in Mountain TZ",
    time: "1h ago",
    icon: ArrowUpRight,
  },
  {
    title: "Content burst",
    body: "YouTube short crossed 100k views in 6 hours",
    time: "3h ago",
    icon: Radio,
  },
];

export function ActivityFeed() {
  return (
    <Card className="glass-panel border-border/50 flex max-h-[420px] flex-col">
      <CardHeader>
        <CardTitle className="text-base font-semibold tracking-tight">
          Live activity
        </CardTitle>
        <p className="text-muted-foreground text-sm">
          Supabase Realtime will stream operational events here.
        </p>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 pt-0">
        <ScrollArea className="h-[300px] pr-3">
          <div className="space-y-4">
            {items.map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 * i }}
                className="flex gap-3"
              >
                <div className="bg-primary/12 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-primary/20">
                  <item.icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-none">{item.title}</p>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {item.time}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-sm leading-snug">{item.body}</p>
                  <Separator className="mt-3 bg-border/50" />
                </div>
              </motion.div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
