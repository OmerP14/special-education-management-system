"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMonthlyRevenue, getMonthlyCollected, formatCurrency } from "@/lib/helpers/finance";
import type { Session, Payment } from "@/types";

interface CashFlowChartProps {
  sessions: Session[];
  payments: Payment[];
  monthsBack?: number;
}

const MONTH_FMT = new Intl.DateTimeFormat("tr-TR", { month: "short" });

interface CashFlowPoint {
  month: string;
  revenue: number;
  collected: number;
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string }>; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  const revenue = payload.find((p) => p.dataKey === "revenue")?.value ?? 0;
  const collected = payload.find((p) => p.dataKey === "collected")?.value ?? 0;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-md">
      <p className="mb-1 text-xs font-semibold capitalize text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground">
        Ciro: <span className="font-medium text-foreground">{formatCurrency(revenue)}</span>
      </p>
      <p className="text-xs text-muted-foreground">
        Tahsilat: <span className="font-medium text-foreground">{formatCurrency(collected)}</span>
      </p>
    </div>
  );
}

export function CashFlowChart({ sessions, payments, monthsBack = 6 }: CashFlowChartProps) {
  // Pure composition over the existing per-month finance helpers — no new
  // calculation logic, just plotting `monthsBack` months of already-defined
  // revenue/collected figures side by side.
  const data: CashFlowPoint[] = useMemo(() => {
    const now = new Date();
    return Array.from({ length: monthsBack }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1 - i), 1);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      return {
        month: MONTH_FMT.format(d),
        revenue: getMonthlyRevenue(sessions, year, month),
        collected: getMonthlyCollected(payments, year, month),
      };
    });
  }, [sessions, payments, monthsBack]);

  return (
    <Card className="flex h-[360px] flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Nakit Akışı</CardTitle>
        <p className="text-sm text-muted-foreground">Son {monthsBack} ay · Ciro vs Tahsilat</p>
      </CardHeader>
      <CardContent className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }} barGap={4}>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" opacity={0.6} />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}K` : String(v))}
              width={36}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.5 }} />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }}
              formatter={(value: string) => (value === "revenue" ? "Ciro" : "Tahsilat")}
            />
            <Bar dataKey="revenue" name="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={22} />
            <Bar dataKey="collected" name="collected" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
