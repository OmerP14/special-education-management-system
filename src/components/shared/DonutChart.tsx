"use client";

import { cn } from "@/lib/utils";

export interface DonutSegment {
  key: string;
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  centerUnitLabel?: string;
  emptyLabel?: string;
  className?: string;
}

const SIZE = 100;
const RADIUS = 38;
const STROKE_WIDTH = 11;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GAP = 2.5;

export function DonutChart({
  segments,
  centerUnitLabel = "Seans",
  emptyLabel = "0 Seans",
  className,
}: DonutChartProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const visibleSegments = segments.filter((s) => s.value > 0);

  let cumulative = 0;

  return (
    <div className={cn("flex flex-col items-center gap-4 sm:flex-row sm:items-center", className)}>
      <div className="relative shrink-0 w-[180px] h-[180px] sm:w-[200px] sm:h-[200px]">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="h-full w-full -rotate-90"
          role="img"
          aria-label={
            total > 0
              ? `${total} ${centerUnitLabel.toLowerCase()}, ${visibleSegments
                  .map((s) => `${s.label}: ${s.value}`)
                  .join(", ")}`
              : emptyLabel
          }
        >
          {total === 0 ? (
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke="var(--muted)"
              strokeWidth={STROKE_WIDTH}
            />
          ) : (
            visibleSegments.map((seg) => {
              const segLength = (seg.value / total) * CIRCUMFERENCE;
              const visibleLength = Math.max(segLength - GAP, 0);
              const dashOffset = -cumulative;
              cumulative += segLength;
              return (
                <circle
                  key={seg.key}
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={STROKE_WIDTH}
                  strokeDasharray={`${visibleLength} ${CIRCUMFERENCE - visibleLength}`}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="butt"
                >
                  <title>
                    {seg.label}: {seg.value}
                    {total > 0 ? ` (${Math.round((seg.value / total) * 100)}%)` : ""}
                  </title>
                </circle>
              );
            })
          )}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          {total === 0 ? (
            <span className="text-sm font-medium text-muted-foreground">{emptyLabel}</span>
          ) : (
            <>
              <span className="text-2xl font-semibold text-foreground">{total}</span>
              <span className="text-[11px] text-muted-foreground">{centerUnitLabel}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[160px]">
        {segments.map((seg) => {
          const pct = total > 0 ? Math.round((seg.value / total) * 100) : 0;
          return (
            <div key={seg.key} className="flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: seg.color }}
                />
                <span className="truncate text-muted-foreground">{seg.label}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 tabular-nums">
                <span className="font-semibold text-foreground">{seg.value}</span>
                <span className="w-8 text-right text-muted-foreground">{pct}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
