"use client";

import { AlertTriangle } from "lucide-react";
import { formatDate, formatTime } from "@/lib/helpers/finance";
import type { BatchConflictEntry } from "@/lib/helpers/session-conflict";
import type { Student, Teacher, EducationType } from "@/types";

interface WeeklyPlanConflictWarningProps {
  conflicts: BatchConflictEntry[];
  students: Student[];
  teachers: Teacher[];
  educationTypes: EducationType[];
}

/**
 * Informational only — conflicting dates are already excluded from the batch being
 * created (see partitionDatesByConflict), so there is nothing to acknowledge or force
 * through. This just tells the user which dates were skipped and why.
 */
export function WeeklyPlanConflictWarning({
  conflicts,
  students,
  teachers,
  educationTypes,
}: WeeklyPlanConflictWarningProps) {
  if (conflicts.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-400/50 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 space-y-3">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
            {conflicts.length} seans çakışma nedeniyle oluşturulmayacak.
          </p>
          <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-500">
            Aşağıdaki tarihler mevcut seanslarla çakıştığı için atlanacak.
          </p>
        </div>
      </div>
      <div className="space-y-1.5">
        {conflicts.map(({ date, result }, i) => (
          <div
            key={`${date}-${i}`}
            className="rounded-md border border-amber-300/50 bg-background/60 px-2.5 py-2 space-y-1"
          >
            <p className="text-xs font-medium text-foreground tabular-nums">
              {formatDate(date)} · {formatTime(date)}
            </p>
            <p className="text-[11px] text-muted-foreground">{result.message}</p>
            {result.conflictingSessions.map((s) => {
              const student = students.find((st) => st.id === s.studentId);
              const teacher = teachers.find((t) => t.id === s.teacherId);
              const et = educationTypes.find((e) => e.id === s.educationTypeId);
              return (
                <p key={s.id} className="text-[11px] text-muted-foreground/80 truncate">
                  Çakışan seans: {student?.fullName ?? "—"} · {teacher?.fullName ?? "—"} ·{" "}
                  {et?.name ?? "—"}
                </p>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
