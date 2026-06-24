"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Session, SessionStatus } from "@/types";

interface SessionStatusBreakdownProps {
  sessions: Session[];
}

const STATUS_LABELS: Record<SessionStatus, string> = {
  planned: "Planlandı",
  completed: "Tamamlandı",
  cancelled: "İptal",
  no_show: "Gelmedi",
  makeup: "Telafi",
};

const STATUS_COLORS: Record<SessionStatus, string> = {
  planned: "bg-blue-500",
  completed: "bg-emerald-500",
  cancelled: "bg-gray-400",
  no_show: "bg-red-500",
  makeup: "bg-purple-500",
};

export function SessionStatusBreakdown({ sessions }: SessionStatusBreakdownProps) {
  const total = sessions.length;

  const counts = (Object.keys(STATUS_LABELS) as SessionStatus[]).map((status) => ({
    status,
    count: sessions.filter((s) => s.status === status).length,
  }));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Seans Dağılımı</CardTitle>
        <p className="text-sm text-muted-foreground">Tüm zamanlar · {total} seans</p>
      </CardHeader>
      <CardContent>
        {/* Stacked bar */}
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted mb-4">
          {counts.map(({ status, count }) => {
            const pct = total > 0 ? (count / total) * 100 : 0;
            if (pct === 0) return null;
            return (
              <div
                key={status}
                className={`${STATUS_COLORS[status]} transition-all`}
                style={{ width: `${pct}%` }}
              />
            );
          })}
        </div>

        {/* Legend */}
        <div className="space-y-2">
          {counts.map(({ status, count }) => {
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div key={status} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className={`h-2.5 w-2.5 rounded-sm ${STATUS_COLORS[status]}`} />
                  <span className="text-muted-foreground">{STATUS_LABELS[status]}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium tabular-nums">{count}</span>
                  <span className="text-xs text-muted-foreground w-8 text-right tabular-nums">
                    {pct}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
