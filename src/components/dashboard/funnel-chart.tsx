"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const data = [
  { stage: "Lead", value: 1000 },
  { stage: "Contacted", value: 640 },
  { stage: "Qualified", value: 420 },
  { stage: "Appt set", value: 210 },
  { stage: "Show", value: 140 },
  { stage: "Close", value: 58 },
];

export function FunnelChart() {
  return (
    <Card className="glass-panel border-border/50 min-h-[320px]">
      <CardHeader>
        <CardTitle className="text-base font-semibold tracking-tight">
          Acquisition funnel
        </CardTitle>
        <p className="text-muted-foreground text-sm">
          Synthetic funnel — connect GoHighLevel / Trackio webhooks.
        </p>
      </CardHeader>
      <CardContent className="h-[260px] pt-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="stage"
              width={88}
              tickLine={false}
              axisLine={false}
              fontSize={12}
            />
            <Tooltip
              cursor={{ fill: "oklch(0.72 0.19 250 / 0.08)" }}
              contentStyle={{
                background: "oklch(0.16 0.04 264)",
                border: "1px solid oklch(1 0 0 / 12%)",
                borderRadius: 12,
              }}
            />
            <Bar dataKey="value" radius={[0, 6, 6, 0]} fill="oklch(0.62 0.16 200)" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
