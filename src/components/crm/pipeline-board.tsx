"use client";

import { motion } from "framer-motion";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { LeadStage } from "@/lib/types/crm";

export type PipelineCard = {
  id: string;
  title: string;
  subtitle?: string;
  value?: string;
  score?: number;
};

const stages: { id: LeadStage; label: string; cards: PipelineCard[] }[] = [
  {
    id: "new",
    label: "New",
    cards: [
      { id: "1", title: "Lumen Skincare", subtitle: "IG inbound", value: "$4.2k" },
      { id: "2", title: "Atlas SaaS", subtitle: "Webinar", value: "$18k" },
    ],
  },
  {
    id: "contacted",
    label: "Contacted",
    cards: [
      { id: "3", title: "Northwind Coaches", subtitle: "Cold outbound", score: 82 },
    ],
  },
  {
    id: "qualified",
    label: "Qualified",
    cards: [
      { id: "4", title: "Pulse Fitness", subtitle: "Setter: Ava", value: "$9k", score: 91 },
    ],
  },
  {
    id: "appointment_set",
    label: "Appt set",
    cards: [{ id: "5", title: "Vertex AI Lab", subtitle: "Closer: Marcus", value: "$22k" }],
  },
  {
    id: "showed",
    label: "Showed",
    cards: [{ id: "6", title: "Blue Harbor", subtitle: "Discovery complete", value: "$31k" }],
  },
  {
    id: "won",
    label: "Won",
    cards: [{ id: "7", title: "Silverline Media", subtitle: "Annual", value: "$120k" }],
  },
];

function LeadCard({ card, index }: { card: PipelineCard; index: number }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="glass cursor-default rounded-xl border border-border/50 p-3 shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold leading-tight">{card.title}</p>
          {card.subtitle ? (
            <p className="text-muted-foreground mt-1 text-xs">{card.subtitle}</p>
          ) : null}
        </div>
        {card.score ? (
          <Badge variant="secondary" className="shrink-0 text-[10px]">
            {card.score}
          </Badge>
        ) : null}
      </div>
      {card.value ? (
        <p className="text-primary mt-3 text-xs font-semibold tracking-wide">{card.value}</p>
      ) : null}
    </motion.div>
  );
}

export function PipelineBoard() {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {stages.map((col) => (
        <Card
          key={col.id}
          className="glass-panel border-border/50 w-[260px] shrink-0"
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm font-semibold tracking-tight">
                {col.label}
              </CardTitle>
              <Badge variant="outline" className="text-[10px]">
                {col.cards.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <ScrollArea className="h-[420px] pr-2">
              <div className="space-y-3">
                {col.cards.map((c, i) => (
                  <LeadCard key={c.id} card={c} index={i} />
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
