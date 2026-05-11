"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const data = [
  { m: "Jan", rev: 42 },
  { m: "Feb", rev: 48 },
  { m: "Mar", rev: 53 },
  { m: "Apr", rev: 61 },
  { m: "May", rev: 58 },
  { m: "Jun", rev: 67 },
  { m: "Jul", rev: 72 },
  { m: "Aug", rev: 79 },
  { m: "Sep", rev: 84 },
  { m: "Oct", rev: 91 },
  { m: "Nov", rev: 96 },
  { m: "Dec", rev: 104 },
];

export function RevenueChart() {
  return (
    <Card className="glass-panel border-border/50 min-h-[320px]">
      <CardHeader>
        <CardTitle className="text-base font-semibold tracking-tight">
          Revenue trajectory
        </CardTitle>
        <p className="text-muted-foreground text-sm">
          Normalized index — wire to Supabase / billing integrations.
        </p>
      </CardHeader>
      <CardContent className="h-[260px] pt-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
            <defs>
              <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="oklch(0.72 0.19 250)" stopOpacity={0.45} />
                <stop offset="95%" stopColor="oklch(0.72 0.19 250)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
            <XAxis dataKey="m" tickLine={false} axisLine={false} fontSize={12} />
            <YAxis
              width={32}
              tickLine={false}
              axisLine={false}
              fontSize={12}
              tickFormatter={(v) => `${v}k`}
            />
            <Tooltip
              contentStyle={{
                background: "oklch(0.16 0.04 264)",
                border: "1px solid oklch(1 0 0 / 12%)",
                borderRadius: 12,
              }}
              labelStyle={{ color: "oklch(0.97 0.01 264)" }}
            />
            <Area
              type="monotone"
              dataKey="rev"
              stroke="oklch(0.72 0.19 250)"
              strokeWidth={2}
              fill="url(#revFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
