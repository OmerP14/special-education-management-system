"use client";

import Link from "next/link";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { formatDate, formatTime } from "@/lib/helpers/finance";
import type { WeeklyPlanConflictRow } from "@/lib/helpers/weekly-plans";

// ─── Conflict row list ──────────────────────────────────────────────────────────

function ConflictRowList({
  rows,
  onNavigateAway,
}: {
  rows: WeeklyPlanConflictRow[];
  onNavigateAway?: () => void;
}) {
  return (
    <div className="space-y-1.5">
      {rows.map((row, i) => (
        <div
          key={`${row.sessionId}-${i}`}
          className="flex items-center justify-between gap-2 rounded-md border border-amber-300/50 bg-background/60 px-2.5 py-2"
        >
          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground tabular-nums">
              {formatDate(row.date)} · {formatTime(row.date)}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              {row.studentName} · {row.educationTypeName}
            </p>
          </div>
          <Link
            href={`/app/students/${row.studentId}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onNavigateAway?.()}
            className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-primary hover:underline"
          >
            Seansı Aç
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────────

interface WeeklyPlanConflictWarningProps {
  teacherConflicts: WeeklyPlanConflictRow[];
  studentConflicts: WeeklyPlanConflictRow[];
  acknowledged: boolean;
  onAcknowledgedChange: (value: boolean) => void;
  /** Called when the user clicks "Seansı Aç" (e.g. to close the current drawer). */
  onNavigateAway?: () => void;
}

export function WeeklyPlanConflictWarning({
  teacherConflicts,
  studentConflicts,
  acknowledged,
  onAcknowledgedChange,
  onNavigateAway,
}: WeeklyPlanConflictWarningProps) {
  if (teacherConflicts.length === 0 && studentConflicts.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-400/50 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 space-y-3">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0 space-y-3">
          {teacherConflicts.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                Bu öğretmenin aynı saat için başka bir seansı bulunuyor.
              </p>
              <ConflictRowList rows={teacherConflicts} onNavigateAway={onNavigateAway} />
            </div>
          )}
          {studentConflicts.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                Öğrencinin aynı saat için başka bir seansı bulunuyor.
              </p>
              <ConflictRowList rows={studentConflicts} onNavigateAway={onNavigateAway} />
            </div>
          )}
        </div>
      </div>
      <label className="flex items-center gap-2.5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => onAcknowledgedChange(e.target.checked)}
          className="h-4 w-4 rounded border-amber-500/60 accent-amber-600"
        />
        <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
          Çakışmaları görüyorum, yine de kaydet
        </span>
      </label>
    </div>
  );
}
