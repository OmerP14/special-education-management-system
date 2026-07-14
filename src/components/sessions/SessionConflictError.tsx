"use client";

import { AlertCircle } from "lucide-react";
import { formatDate, formatTime } from "@/lib/helpers/finance";
import type { Student, Teacher, EducationType } from "@/types";
import type { SessionConflictResult } from "@/lib/helpers/session-conflict";

interface SessionConflictErrorProps {
  result: SessionConflictResult;
  students: Student[];
  teachers: Teacher[];
  educationTypes: EducationType[];
}

/**
 * Hard-blocking conflict error — no acknowledge checkbox. Double-booking a student or
 * teacher must not be allowed, so this only ever informs; Save stays disabled until the
 * caller resolves the conflict (change time, student, or teacher).
 */
export function SessionConflictError({
  result,
  students,
  teachers,
  educationTypes,
}: SessionConflictErrorProps) {
  if (!result.hasConflict) return null;

  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 space-y-2.5">
      <div className="flex items-start gap-2.5">
        <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
        <p className="text-sm font-semibold text-destructive">{result.message}</p>
      </div>
      <div className="space-y-1.5">
        {result.conflictingSessions.map((s) => {
          const student = students.find((st) => st.id === s.studentId);
          const teacher = teachers.find((t) => t.id === s.teacherId);
          const et = educationTypes.find((e) => e.id === s.educationTypeId);
          return (
            <div
              key={s.id}
              className="rounded-md border border-destructive/30 bg-background/60 px-2.5 py-2 text-xs"
            >
              <p className="font-medium text-foreground tabular-nums">
                {formatDate(s.date)} · {formatTime(s.date)}
              </p>
              <p className="text-muted-foreground">
                {student?.fullName ?? "—"} · {teacher?.fullName ?? "—"} · {et?.name ?? "—"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
