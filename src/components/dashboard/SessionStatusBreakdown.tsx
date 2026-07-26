"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  PieChart,
  Pie,
  Cell,
  Sector,
  ResponsiveContainer,
} from "recharts";
import type { PieSectorDataItem, PieShape } from "recharts/types/polar/Pie";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Session, SessionStatus } from "@/types";

interface SessionStatusBreakdownProps {
  sessions: Session[];
}

// Four display groups — İptal and Gelmedi are combined into one slice, matching
// how the rest of the app already presents this pair (see the Sessions page
// status donut). Colors reuse the exact hues StatusBadge/the app already use
// for each status, so a status means the same color everywhere.
interface StatusGroup {
  key: string;
  label: string;
  color: string;
  statuses: SessionStatus[];
}

const STATUS_GROUPS: StatusGroup[] = [
  { key: "completed", label: "Tamamlandı", color: "#10b981", statuses: ["completed"] }, // emerald-500
  { key: "planned", label: "Planlandı", color: "#3b82f6", statuses: ["planned"] }, // blue-500
  { key: "makeup", label: "Telafi", color: "#a855f7", statuses: ["makeup"] }, // purple-500
  { key: "cancelled_no_show", label: "İptal / Gelmedi", color: "#f87171", statuses: ["cancelled", "no_show"] }, // red-400
];

const POP_DISTANCE = 8; // px a hovered slice lifts outward, along its own bisector
const RADIAN = Math.PI / 180;

interface ChartDatum {
  key: string;
  label: string;
  color: string;
  count: number;
  pct: number;
}

// Custom sector renderer: draws the base Sector shape at its normal geometry,
// then lifts it outward via a CSS transform on the wrapping <g> (never via
// path-geometry changes, which aren't smoothly transitionable across
// browsers) — this is what makes the 200–300ms hover pop actually animate.
//
// A custom `shape` fully replaces Recharts' default per-slice rendering, so
// the sibling <Cell>'s onMouseEnter/onMouseLeave/aria-label never reach the
// DOM here — mouse handling and a11y attributes have to live directly on the
// element this function returns instead.
function makeSliceRenderer(hoveredKey: string | null, onHoverChange: (key: string | null) => void) {
  function SliceShape(props: PieSectorDataItem & { index?: number; midAngle?: number }) {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, midAngle } = props;
    const datum = payload as unknown as ChartDatum;
    const isActive = hoveredKey === datum.key;
    const angle = midAngle ?? (Number(startAngle) + Number(endAngle)) / 2;
    const dx = isActive ? Math.cos(-RADIAN * angle) * POP_DISTANCE : 0;
    const dy = isActive ? Math.sin(-RADIAN * angle) * POP_DISTANCE : 0;

    return (
      <g
        tabIndex={0}
        role="img"
        aria-label={`${datum.label}: ${datum.count} seans, yüzde ${datum.pct}`}
        onMouseEnter={() => onHoverChange(datum.key)}
        onMouseLeave={() => onHoverChange(null)}
        onFocus={() => onHoverChange(datum.key)}
        onBlur={() => onHoverChange(null)}
        style={{
          transform: `translate(${dx}px, ${dy}px)`,
          transition: "transform 240ms cubic-bezier(0.34, 1.56, 0.64, 1), filter 240ms ease",
          filter: isActive ? "brightness(1.08) url(#donut-elevation)" : "url(#donut-elevation)",
          cursor: "pointer",
          outline: "none",
        }}
      >
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={isActive ? Number(outerRadius) + 3 : outerRadius}
          startAngle={startAngle}
          endAngle={endAngle}
          cornerRadius={3}
          fill={fill}
          stroke="var(--card)"
          strokeWidth={2}
        />
      </g>
    );
  }
  return SliceShape;
}

export function SessionStatusBreakdown({ sessions }: SessionStatusBreakdownProps) {
  const router = useRouter();
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  // Recharts' own <Tooltip> only repositions when the active Pie sector
  // changes, not on every pointer-move within the same sector — too coarse
  // for "the tooltip should follow the cursor smoothly". Tracking raw cursor
  // position ourselves and rendering a plain positioned div gives true 1:1
  // cursor-follow instead.
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  // The sessions list can be large after an Excel import — memoize the raw
  // per-status counts and the derived chart data separately so hover-driven
  // re-renders (state change on every pointer move) never re-scan `sessions`.
  const counts = useMemo(() => {
    const result: Record<SessionStatus, number> = {
      planned: 0,
      completed: 0,
      cancelled: 0,
      no_show: 0,
      makeup: 0,
    };
    for (const session of sessions) {
      result[session.status] += 1;
    }
    return result;
  }, [sessions]);

  const total = useMemo(
    () => Object.values(counts).reduce((sum, n) => sum + n, 0),
    [counts]
  );

  const chartData: ChartDatum[] = useMemo(
    () =>
      STATUS_GROUPS.map((group) => {
        const count = group.statuses.reduce((sum, status) => sum + counts[status], 0);
        return {
          key: group.key,
          label: group.label,
          color: group.color,
          count,
          pct: total > 0 ? Math.round((count / total) * 100) : 0,
        };
      }),
    [counts, total]
  );

  const isEmpty = total === 0;
  const pieData: ChartDatum[] = isEmpty
    ? [{ key: "empty", label: "", color: "var(--muted)", count: 1, pct: 0 }]
    : chartData;

  const sliceShape = useMemo(
    () => makeSliceRenderer(hoveredKey, setHoveredKey),
    [hoveredKey]
  );
  const activeDatum = chartData.find((d) => d.key === hoveredKey) ?? null;

  return (
    <Card
      className="@container flex cursor-pointer flex-col transition-colors hover:border-primary/40 @[360px]:h-[440px]"
      onClick={() => router.push("/app/sessions")}
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Seans Dağılımı</CardTitle>
        <p className="text-sm text-muted-foreground">Tüm zamanlar · {total} seans</p>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 @[360px]:flex-row">
          <div
            className="relative aspect-square w-full max-w-[180px] shrink-0"
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setCursorPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
            }}
            onMouseLeave={() => setCursorPos(null)}
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <defs>
                  <filter id="donut-elevation" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="1.4" stdDeviation="1.8" floodOpacity="0.22" />
                  </filter>
                  {STATUS_GROUPS.map((group) => (
                    <linearGradient key={group.key} id={`donut-grad-${group.key}`} x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={group.color} stopOpacity={0.78} />
                      <stop offset="100%" stopColor={group.color} stopOpacity={1} />
                    </linearGradient>
                  ))}
                </defs>
                <Pie
                  data={pieData}
                  dataKey="count"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius="58%"
                  outerRadius="92%"
                  paddingAngle={isEmpty ? 0 : 3}
                  startAngle={90}
                  endAngle={-270}
                  isAnimationActive
                  animationDuration={700}
                  animationEasing="ease-out"
                  shape={isEmpty ? undefined : (sliceShape as unknown as PieShape)}
                  stroke={isEmpty ? "var(--card)" : "none"}
                  strokeWidth={isEmpty ? 2 : 0}
                >
                  {pieData.map((d) => (
                    // Cell's `fill` still flows into the custom `shape` above as
                    // part of its computed sector props, even though `shape`
                    // otherwise fully replaces Cell's own rendering/interaction
                    // (event handlers and a11y attrs live on the shape itself).
                    <Cell
                      key={d.key}
                      fill={isEmpty ? "var(--muted)" : `url(#donut-grad-${d.key})`}
                      style={{ outline: "none" }}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>

            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              {isEmpty ? (
                <>
                  <span className="text-2xl font-semibold text-foreground">0</span>
                  <span className="text-[11px] text-muted-foreground">Seans</span>
                </>
              ) : (
                <>
                  <span className="text-[11px] text-muted-foreground">Toplam</span>
                  <span className="text-2xl font-semibold text-foreground">{total}</span>
                  <span className="text-[11px] text-muted-foreground">Seans</span>
                </>
              )}
            </div>

            {activeDatum && cursorPos && (
              <div
                className="pointer-events-none absolute z-10 whitespace-nowrap rounded-md border border-border bg-popover px-3 py-2 text-center shadow-md"
                style={{ left: cursorPos.x + 14, top: cursorPos.y - 14 }}
              >
                <p className="text-xs font-semibold text-foreground">{activeDatum.label}</p>
                <p className="text-xs text-muted-foreground">{activeDatum.count} Seans</p>
                <p className="text-xs text-muted-foreground">%{activeDatum.pct}</p>
              </div>
            )}
          </div>

          <div className="flex w-full flex-col gap-2.5 @[360px]:w-auto @[360px]:min-w-[130px]">
            {chartData.map((d) => (
              <button
                key={d.key}
                type="button"
                className="flex flex-col items-start gap-0.5 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-muted/60"
                onMouseEnter={() => setHoveredKey(d.key)}
                onMouseLeave={() => setHoveredKey((h) => (h === d.key ? null : h))}
                onFocus={() => setHoveredKey(d.key)}
                onBlur={() => setHoveredKey((h) => (h === d.key ? null : h))}
              >
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-sm font-medium text-foreground">{d.label}</span>
                </span>
                <span className="pl-[18px] text-xs tabular-nums text-muted-foreground">
                  {d.count} (%{d.pct})
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 shrink-0 border-t border-border/60 pt-3">
          <Link
            href="/app/sessions"
            className="text-xs font-medium text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            → Tüm Seansları Gör
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
