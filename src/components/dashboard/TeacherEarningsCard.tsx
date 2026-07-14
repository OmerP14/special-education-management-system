"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/helpers/finance";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { Session, Teacher, TeacherPayment, TeacherCustomPrice } from "@/types";
import { getTeacherEarningTotals } from "@/lib/helpers/finance";

interface TeacherEarningsCardProps {
  teacherPayments: TeacherPayment[];
  teachers: Teacher[];
  sessions: Session[];
  teacherCustomPrices?: TeacherCustomPrice[];
}

export function TeacherEarningsCard({ teacherPayments, teachers, sessions, teacherCustomPrices = [] }: TeacherEarningsCardProps) {
  const activeTeachers = teachers.filter((t) => t.status === "active");

  const summaries = activeTeachers
    .map((teacher) => {
      const totals = getTeacherEarningTotals(teacher, sessions, teacherPayments, teacherCustomPrices);
      return {
        teacher,
        total: totals.totalEarning,
        pending: totals.pendingEarning,
        unknownSessionCount: totals.unknownSessionCount,
      };
    })
    // A teacher whose entire history is unresolved earnings (total stays ₺0)
    // must still surface here — never silently disappear.
    .filter((s) => s.total > 0 || s.unknownSessionCount > 0)
    .sort((a, b) => b.pending - a.pending);

  const totalPending = summaries.reduce((sum, s) => sum + s.pending, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Öğretmen Kazançları</CardTitle>
        <p className="text-sm text-muted-foreground">
          Bekleyen ödemeler:{" "}
          <span className="font-medium text-amber-600">
            {formatCurrency(totalPending)}
          </span>
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {summaries.map(({ teacher, total, pending, unknownSessionCount }) => (
            <div
              key={teacher.id}
              className="flex items-center gap-3 rounded-lg border border-border/60 p-3 bg-muted/20"
            >
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                  {teacher.fullName
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{teacher.fullName}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  Toplam: {formatCurrency(total)}
                </p>
                {unknownSessionCount > 0 && (
                  <p className="text-[11px] text-amber-600">
                    Hakediş ayarı bekleniyor — {unknownSessionCount} seans
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="text-sm font-semibold tabular-nums">
                  {formatCurrency(pending)}
                </span>
                {pending === 0 && unknownSessionCount > 0 ? (
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                    Hakediş bekliyor
                  </span>
                ) : (
                  <StatusBadge status={pending > 0 ? "pending" : "paid"} />
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
