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

export type TrendPoint = { date: string; count: number };

export function TrendChart({
  title,
  subtitle,
  points,
  valueLabel = "Count",
  gradientId = "trendFill",
}: {
  title: string;
  subtitle: string;
  points: TrendPoint[];
  valueLabel?: string;
  gradientId?: string;
}) {
  return (
    <Card className="glass-panel border-border/50 min-h-[320px]">
      <CardHeader>
        <CardTitle className="text-base font-semibold tracking-tight">
          {title}
        </CardTitle>
        <p className="text-muted-foreground text-sm">{subtitle}</p>
      </CardHeader>
      <CardContent className="h-[260px] min-h-[260px] w-full min-w-0 pt-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ left: 0, right: 8, top: 8 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="oklch(0.72 0.19 250)" stopOpacity={0.45} />
                <stop offset="95%" stopColor="oklch(0.72 0.19 250)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
            <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={11} />
            <YAxis width={36} tickLine={false} axisLine={false} fontSize={11} />
            <Tooltip
              contentStyle={{
                background: "oklch(0.16 0.04 264)",
                border: "1px solid oklch(1 0 0 / 12%)",
                borderRadius: 12,
              }}
              labelStyle={{ color: "oklch(0.97 0.01 264)" }}
              formatter={(value) => [
                typeof value === "number" ? value : Number(value ?? 0),
                valueLabel,
              ]}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="oklch(0.72 0.19 250)"
              strokeWidth={2}
              fill={`url(#${gradientId})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
