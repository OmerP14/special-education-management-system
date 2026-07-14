"use client";

import { History } from "lucide-react";
import { cn } from "@/lib/utils";

interface HistoricalRecordBadgeProps {
  className?: string;
}

/** Marks a session staged with billingMode: "historical_non_billable" — imported
 *  purely as session history, never counted toward student/guardian debt. See
 *  isBillableSession() in finance.ts for the calculation-side rule this labels. */
export function HistoricalRecordBadge({ className }: HistoricalRecordBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600",
        className
      )}
      title="Bu seans ders geçmişi olarak aktarıldı; öğrenci borcuna/tahakkuka dahil edilmez."
    >
      <History className="h-3 w-3" />
      Geçmiş kayıt — borca dahil değil
    </span>
  );
}
