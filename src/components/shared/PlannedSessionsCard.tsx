"use client";

import { Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/helpers/finance";
import { cn } from "@/lib/utils";

interface PlannedSessionsCardProps {
  count: number;
  totalValue: number;
  className?: string;
}

/**
 * Informational-only summary of planned (not yet billed) sessions.
 * Planned sessions never create debt or affect the current account/payment
 * totals — this card exists purely to preview what will be billed once those
 * sessions are completed.
 */
export function PlannedSessionsCard({ count, totalValue, className }: PlannedSessionsCardProps) {
  return (
    <Card className={cn("border-blue-200/60 bg-blue-50/40 dark:border-blue-900/40 dark:bg-blue-950/10", className)}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Planlı Seanslar</p>
              <p className="text-xs text-muted-foreground">
                Bu seanslar tamamlandığında otomatik olarak tahakkuka dönüşecektir.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6 sm:gap-8">
            <div className="text-left sm:text-right">
              <p className="text-xl font-bold tabular-nums text-foreground">{count}</p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Seans</p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-xl font-bold tabular-nums text-blue-600">
                {formatCurrency(totalValue)}
              </p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Potansiyel Tutar
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
