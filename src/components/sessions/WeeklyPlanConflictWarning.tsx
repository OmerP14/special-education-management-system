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

/** Dates a plan skips because they fall on a holiday (Ayarlar → Takvim → Resmi Tatiller). */
export function HolidaySkipNotice({ skips }: { skips: { date: string; label: string }[] }) {
  if (skips.length === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 space-y-1">
      <p className="text-xs font-medium text-foreground">
        {skips.length} seans resmi tatile denk geldiği için oluşturulmayacak.
      </p>
      {skips.slice(0, 6).map((s) => (
        <p key={s.date} className="text-[11px] text-muted-foreground tabular-nums">
          {formatDate(s.date)} · {s.label}
        </p>
      ))}
      {skips.length > 6 && <p className="text-[11px] text-muted-foreground">…ve {skips.length - 6} tarih daha</p>}
    </div>
  );
}

/** Non-blocking notes about weekly slots outside the institution's working days/hours. */
export function SlotScheduleNotice({ issues }: { issues: string[] }) {
  if (issues.length === 0) return null;
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-400/50 bg-amber-50 dark:bg-amber-950/20 px-3 py-2.5">
      <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
      <div className="space-y-0.5">
        {issues.map((issue) => (
          <p key={issue} className="text-xs text-amber-700 dark:text-amber-400">{issue}</p>
        ))}
      </div>
    </div>
  );
}
