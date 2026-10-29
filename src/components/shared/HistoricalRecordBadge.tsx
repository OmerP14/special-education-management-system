"use client";

import { History } from "lucide-react";
import { cn } from "@/lib/utils";

interface HistoricalRecordBadgeProps {
  className?: string;
  label?: string;
}

/** Marks a record imported as history only — a session with billingMode
 *  "historical_non_billable" (see isBillableSession() in finance.ts) or a
 *  payment with `historical` — never counted toward any balance. */
export function HistoricalRecordBadge({ className, label = "Geçmiş kayıt — borca dahil değil" }: HistoricalRecordBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600",
        className
      )}
      title="Excel aktarımında geçmiş kayıt olarak eklendi; borca, hakedişe ve tahakkuka dahil edilmez."
    >
      <History className="h-3 w-3" />
      {label}
    </span>
  );
}
