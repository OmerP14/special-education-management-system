"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/helpers/finance";
import type { Payment, Session, Student, OpeningBalance } from "@/types";
import { getStudentDebt, getStudentTotalPaid } from "@/lib/helpers/finance";

interface PaymentSummaryCardProps {
  sessions: Session[];
  payments: Payment[];
  students: Student[];
  openingBalances?: OpeningBalance[];
}

const VISIBLE_LIMIT = 8;

export function PaymentSummaryCard({ sessions, payments, students, openingBalances = [] }: PaymentSummaryCardProps) {
  // Same pattern as TeacherEarningsCard: totals below always cover every
  // active student with a balance, but only the top VISIBLE_LIMIT debtors
  // render as rows so a large imported student roster can't stretch the card.
  const summaries = useMemo(() => {
    return students
      .filter((s) => s.status === "active")
      .map((student) => {
        const debt = getStudentDebt(student.id, sessions, payments, openingBalances);
        const paid = getStudentTotalPaid(student.id, payments);
        const total = debt + paid;
        return { student, debt, paid, total };
      })
      .filter((s) => s.total > 0)
      .sort((a, b) => b.debt - a.debt);
  }, [students, sessions, payments, openingBalances]);

  const totalDebt = useMemo(() => summaries.reduce((sum, s) => sum + s.debt, 0), [summaries]);
  const totalPaid = useMemo(() => summaries.reduce((sum, s) => sum + s.paid, 0), [summaries]);

  const visibleSummaries = summaries.slice(0, VISIBLE_LIMIT);

  return (
    <Card className="flex h-[440px] flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Ödeme Özeti</CardTitle>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Toplam Tahsilat: <span className="font-medium text-emerald-600">{formatCurrency(totalPaid)}</span></span>
          <span>Bekleyen: <span className="font-medium text-destructive">{formatCurrency(totalDebt)}</span></span>
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col">
        <div className="scrollbar-thin -mr-1 min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="space-y-4">
            {visibleSummaries.map(({ student, debt, paid, total }) => {
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
        </div>
        <div className="mt-3 shrink-0 border-t border-border/60 pt-3">
          <Link
            href="/app/payments"
            className="text-xs font-medium text-primary hover:underline"
          >
            → Tüm Öğrenci Ödemelerini Gör
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
