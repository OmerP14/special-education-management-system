"use client";

import { cn } from "@/lib/utils";
import type {
  SessionStatus,
  StudentStatus,
  TeacherStatus,
  EarningStatus,
  InstallmentStatus,
} from "@/types";

type AnyStatus =
  | SessionStatus
  | "in_progress"
  | StudentStatus
  | TeacherStatus
  | EarningStatus
  | InstallmentStatus;

const STATUS_CONFIG: Record<AnyStatus, { label: string; className: string }> = {
  // Session
  in_progress: {
    label: "Devam Ediyor",
    className: "bg-orange-100 text-orange-700 border-orange-200",
  },
  planned: {
    label: "Planlandı",
    className: "bg-blue-100 text-blue-700 border-blue-200",
  },
  completed: {
    label: "Tamamlandı",
    className: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  cancelled: {
    label: "İptal",
    className: "bg-gray-100 text-gray-600 border-gray-200",
  },
  no_show: {
    label: "Gelmedi",
    className: "bg-red-100 text-red-700 border-red-200",
  },
  makeup: {
    label: "Telafi",
    className: "bg-purple-100 text-purple-700 border-purple-200",
  },
  // Student
  active: {
    label: "Aktif",
    className: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  inactive: {
    label: "Pasif",
    className: "bg-gray-100 text-gray-600 border-gray-200",
  },
  on_hold: {
    label: "Beklemede",
    className: "bg-amber-100 text-amber-700 border-amber-200",
  },
  // Earning / Installment shared
  pending: {
    label: "Bekliyor",
    className: "bg-amber-100 text-amber-700 border-amber-200",
  },
  paid: {
    label: "Ödendi",
    className: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  // Installment-only
  overdue: {
    label: "Gecikmiş",
    className: "bg-red-100 text-red-700 border-red-200",
  },
};

interface StatusBadgeProps {
  status: AnyStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  if (!config) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
