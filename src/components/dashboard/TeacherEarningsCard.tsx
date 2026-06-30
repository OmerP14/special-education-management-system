"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/helpers/finance";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { Teacher, TeacherEarning } from "@/types";
import {
  getTeacherTotalEarnings,
  getTeacherPendingEarnings,
} from "@/lib/helpers/finance";

interface TeacherEarningsCardProps {
  earnings: TeacherEarning[];
  teachers: Teacher[];
}

export function TeacherEarningsCard({ earnings, teachers }: TeacherEarningsCardProps) {
  const activeTeachers = teachers.filter((t) => t.status === "active");

  const summaries = activeTeachers
    .map((teacher) => ({
      teacher,
      total: getTeacherTotalEarnings(teacher.id, earnings),
      pending: getTeacherPendingEarnings(teacher.id, earnings),
    }))
    .filter((s) => s.total > 0)
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
          {summaries.map(({ teacher, total, pending }) => (
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
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="text-sm font-semibold tabular-nums">
                  {formatCurrency(pending)}
                </span>
                <StatusBadge status={pending > 0 ? "pending" : "paid"} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
