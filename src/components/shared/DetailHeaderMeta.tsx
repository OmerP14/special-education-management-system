"use client";

import { CalendarDays, RefreshCw } from "lucide-react";
import { formatDateTime } from "@/lib/helpers/finance";

interface DetailHeaderMetaProps {
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Subtle one-line metadata row for detail page headers.
 * Shows creation and last-update timestamps when available.
 */
export function DetailHeaderMeta({ createdAt, updatedAt }: DetailHeaderMetaProps) {
  if (!createdAt && !updatedAt) return null;
  return (
    <div className="flex items-center gap-4 flex-wrap text-[11px] text-muted-foreground/60 mt-1.5">
      {createdAt && (
        <span className="flex items-center gap-1">
          <CalendarDays className="h-3 w-3" />
          Oluşturuldu: {formatDateTime(createdAt)}
        </span>
      )}
      {updatedAt && (
        <span className="flex items-center gap-1">
          <RefreshCw className="h-3 w-3" />
          Güncellendi: {formatDateTime(updatedAt)}
        </span>
      )}
    </div>
  );
}
