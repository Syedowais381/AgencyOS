"use client";

import { motion } from "framer-motion";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type KpiCardProps = {
  title: string;
  value: string;
  subtitle?: string;
  trend?: { label: string; positive?: boolean };
  delay?: number;
};

export function KpiCard({
  title,
  value,
  subtitle,
  trend,
  delay = 0,
}: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
    >
      <Card className="glass-panel border-border/50 overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <p className="text-glow text-2xl font-semibold tracking-tight md:text-3xl">
            {value}
          </p>
          {subtitle ? (
            <p className="text-muted-foreground text-sm">{subtitle}</p>
          ) : null}
          {trend ? (
            <p
              className={cn(
                "text-xs font-medium",
                trend.positive === false
                  ? "text-destructive"
                  : "text-primary",
              )}
            >
              {trend.label}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </motion.div>
  );
}
