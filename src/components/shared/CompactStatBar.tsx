"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// A single dense row of stat cells instead of several tall StatCards — same
// pattern already used on the Calendar page, generalized here so list pages
// (Öğrenciler / Öğretmenler / Veliler) can share it instead of each rolling
// their own. Cheap to scan, doesn't push the table below the fold.

export interface CompactStatItem {
  icon: LucideIcon;
  label: string;
  value: string | number;
  tone?: "primary" | "success" | "warning" | "danger";
}

const TONE_CLASSES: Record<NonNullable<CompactStatItem["tone"]>, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-emerald-500/10 text-emerald-600",
  warning: "bg-amber-500/10 text-amber-600",
  danger: "bg-destructive/10 text-destructive",
};

// Tailwind needs literal class strings at build time — a template-built
// `grid-cols-${n}` would never be generated, so column counts are mapped
// explicitly instead of computed.
const GRID_COLS: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-2 sm:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-4",
  5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
  6: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6",
};

interface CompactStatBarProps {
  items: CompactStatItem[];
  className?: string;
}

export function CompactStatBar({ items, className }: CompactStatBarProps) {
  const colsClass = GRID_COLS[items.length] ?? GRID_COLS[4];

  return (
    <div
      className={cn(
        "grid divide-x divide-y divide-border overflow-hidden rounded-xl border border-border bg-card sm:divide-y-0",
        colsClass,
        className
      )}
    >
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2.5 px-3.5 py-2.5">
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
              TONE_CLASSES[item.tone ?? "primary"]
            )}
          >
            <item.icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {item.label}
            </p>
            <p className="truncate text-base font-bold leading-tight tabular-nums text-foreground">
              {item.value}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
