"use client";

import type { KeyboardEvent } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    label: string;
  };
  variant?: "default" | "success" | "warning" | "danger";
  /** Override the value paragraph's classes. Replaces the default text-2xl wrapping style. */
  valueClassName?: string;
  className?: string;
  /** When provided, the card becomes a clickable filter toggle (e.g. "show only
   *  error rows") — renders as a real <button> so it stays keyboard-accessible. */
  onClick?: () => void;
  /** Highlights the card as the currently-active filter. Ignored without onClick. */
  active?: boolean;
}

const variantStyles = {
  default: "bg-primary/10 text-primary",
  success: "bg-emerald-500/10 text-emerald-600",
  warning: "bg-amber-500/10 text-amber-600",
  danger: "bg-destructive/10 text-destructive",
};

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  variant = "default",
  valueClassName,
  className,
  onClick,
  active,
}: StatCardProps) {
  const valueCls = valueClassName ?? "text-xl font-bold tracking-tight tabular-nums text-foreground [overflow-wrap:anywhere] sm:text-2xl";
  return (
    <Card
      className={cn(
        "overflow-hidden",
        onClick && "cursor-pointer transition-shadow hover:shadow-md",
        active && "ring-2 ring-primary",
        className
      )}
      {...(onClick
        ? {
            role: "button",
            tabIndex: 0,
            onClick,
            onKeyDown: (e: KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            },
          }
        : {})}
    >
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3 sm:gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {title}
            </p>
            <p className={cn("mt-1.5", valueCls)}>
              {value}
            </p>
            {description && (
              <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
            )}
            {trend && (
              <p
                className={cn(
                  "mt-1 text-xs font-medium",
                  trend.value >= 0 ? "text-emerald-600" : "text-destructive"
                )}
              >
                {trend.value >= 0 ? "+" : ""}
                {trend.value}% {trend.label}
              </p>
            )}
          </div>
          {/* Hidden on phones so a two-column grid leaves room for the full amount. */}
          <div className={cn("hidden rounded-lg p-2.5 shrink-0 sm:block", variantStyles[variant])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
