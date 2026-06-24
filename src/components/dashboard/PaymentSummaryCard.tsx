"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/helpers/finance";
import type { Payment, Session } from "@/types";
import { mockStudents } from "@/lib/mock/students";
import { getStudentDebt, getStudentTotalPaid } from "@/lib/helpers/finance";

interface PaymentSummaryCardProps {
  sessions: Session[];
  payments: Payment[];
}

export function PaymentSummaryCard({ sessions, payments }: PaymentSummaryCardProps) {
  const summaries = mockStudents
    .filter((s) => s.status === "active")
    .map((student) => {
      const debt = getStudentDebt(student.id, sessions, payments);
      const paid = getStudentTotalPaid(student.id, payments);
      const total = debt + paid;
      return { student, debt, paid, total };
    })
    .filter((s) => s.total > 0)
    .sort((a, b) => b.debt - a.debt)
    .slice(0, 5);

  const totalDebt = summaries.reduce((sum, s) => sum + s.debt, 0);
  const totalPaid = summaries.reduce((sum, s) => sum + s.paid, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Ödeme Özeti</CardTitle>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Toplam Tahsilat: <span className="font-medium text-emerald-600">{formatCurrency(totalPaid)}</span></span>
          <span>Bekleyen: <span className="font-medium text-destructive">{formatCurrency(totalDebt)}</span></span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {summaries.map(({ student, debt, paid, total }) => {
            const paidPercent = total > 0 ? (paid / total) * 100 : 0;
            return (
              <div key={student.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground truncate max-w-[140px]">
                    {student.fullName}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    {debt > 0 && (
                      <span className="text-xs text-destructive tabular-nums">
                        -{formatCurrency(debt)}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatCurrency(paid)}
                    </span>
                  </div>
                </div>
                <Progress value={paidPercent} className="h-1.5" />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
