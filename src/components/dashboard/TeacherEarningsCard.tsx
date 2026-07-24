"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/helpers/finance";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { Session, Teacher, TeacherPayment, TeacherEducationTypeAssignment } from "@/types";
import { getTeacherEarningTotals } from "@/lib/helpers/finance";

interface TeacherEarningsCardProps {
  teacherPayments: TeacherPayment[];
  teachers: Teacher[];
  sessions: Session[];
  teacherEducationTypeAssignments?: TeacherEducationTypeAssignment[];
}

const VISIBLE_LIMIT = 8;

export function TeacherEarningsCard({ teacherPayments, teachers, sessions, teacherEducationTypeAssignments = [] }: TeacherEarningsCardProps) {
  // Excel imports can bring in hundreds of historical teachers — the totals
  // below always reflect all of them, but only the top VISIBLE_LIMIT (by
  // pending earnings) render as rows, so the card never grows past its fixed
  // height. See PaymentSummaryCard for the identical pattern.
  const summaries = useMemo(() => {
    const activeTeachers = teachers.filter((t) => t.status === "active");
    return activeTeachers
      .map((teacher) => {
        const totals = getTeacherEarningTotals(teacher, sessions, teacherPayments, teacherEducationTypeAssignments);
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
  }, [teachers, sessions, teacherPayments, teacherEducationTypeAssignments]);

  const totalPending = useMemo(
    () => summaries.reduce((sum, s) => sum + s.pending, 0),
    [summaries]
  );

  const visibleSummaries = summaries.slice(0, VISIBLE_LIMIT);

  return (
    <Card className="flex h-[440px] flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Öğretmen Kazançları</CardTitle>
        <p className="text-sm text-muted-foreground">
          Bekleyen ödemeler:{" "}
          <span className="font-medium text-amber-600">
            {formatCurrency(totalPending)}
          </span>
        </p>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col">
        <div className="scrollbar-thin -mr-1 min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="space-y-3">
            {visibleSummaries.map(({ teacher, total, pending, unknownSessionCount }) => (
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
                      {unknownSessionCount} geçmiş seansın hakedişi çözümlenmemiş
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
        </div>
        <div className="mt-3 shrink-0 border-t border-border/60 pt-3">
          <Link
            href="/app/teacher-earnings"
            className="text-xs font-medium text-primary hover:underline"
          >
            → Tüm Öğretmen Hakedişlerini Gör
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
