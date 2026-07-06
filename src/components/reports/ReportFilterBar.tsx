"use client";

import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  EMPTY_REPORT_FILTERS,
  isReportFiltersEmpty,
  type ReportFilters,
} from "@/lib/helpers/reports";

interface FilterOption {
  id: string;
  label: string;
}

interface ReportFilterBarProps {
  filters: ReportFilters;
  onChange: (filters: ReportFilters) => void;
  monthOptions: { value: string; label: string }[];
  teachers: FilterOption[];
  students: FilterOption[];
  educationTypes: FilterOption[];
  /** Reports that don't use a given dimension can hide its control. */
  showTeacherFilter?: boolean;
  showStudentFilter?: boolean;
  showEducationTypeFilter?: boolean;
}

const selectClass =
  "h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

export function ReportFilterBar({
  filters,
  onChange,
  monthOptions,
  teachers,
  students,
  educationTypes,
  showTeacherFilter = true,
  showStudentFilter = true,
  showEducationTypeFilter = true,
}: ReportFilterBarProps) {
  const hasActiveFilters = !isReportFiltersEmpty(filters);

  const setMonth = (value: string) => {
    onChange({ ...filters, monthKey: value === "all" ? null : value, startDate: null, endDate: null });
  };

  const setStartDate = (value: string) => {
    onChange({ ...filters, startDate: value || null, monthKey: null });
  };

  const setEndDate = (value: string) => {
    onChange({ ...filters, endDate: value || null, monthKey: null });
  };

  return (
    <div className="flex flex-wrap items-end gap-2">
      {/* Month */}
      <div className="space-y-1">
        <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Ay
        </label>
        <select
          value={filters.monthKey ?? "all"}
          onChange={(e) => setMonth(e.target.value)}
          className={`${selectClass} block`}
          disabled={!!(filters.startDate || filters.endDate)}
        >
          {monthOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Date range */}
      <div className="space-y-1">
        <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Başlangıç
        </label>
        <Input
          type="date"
          value={filters.startDate ?? ""}
          onChange={(e) => setStartDate(e.target.value)}
          className="h-9 w-[150px]"
        />
      </div>
      <div className="space-y-1">
        <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Bitiş
        </label>
        <Input
          type="date"
          value={filters.endDate ?? ""}
          onChange={(e) => setEndDate(e.target.value)}
          className="h-9 w-[150px]"
        />
      </div>

      {/* Teacher */}
      {showTeacherFilter && (
        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Öğretmen
          </label>
          <select
            value={filters.teacherId ?? "all"}
            onChange={(e) =>
              onChange({ ...filters, teacherId: e.target.value === "all" ? null : e.target.value })
            }
            className={`${selectClass} block`}
          >
            <option value="all">Tüm Öğretmenler</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Student */}
      {showStudentFilter && (
        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Öğrenci
          </label>
          <select
            value={filters.studentId ?? "all"}
            onChange={(e) =>
              onChange({ ...filters, studentId: e.target.value === "all" ? null : e.target.value })
            }
            className={`${selectClass} block`}
          >
            <option value="all">Tüm Öğrenciler</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Education type */}
      {showEducationTypeFilter && (
        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Eğitim Türü
          </label>
          <select
            value={filters.educationTypeId ?? "all"}
            onChange={(e) =>
              onChange({
                ...filters,
                educationTypeId: e.target.value === "all" ? null : e.target.value,
              })
            }
            className={`${selectClass} block`}
          >
            <option value="all">Tüm Eğitim Türleri</option>
            {educationTypes.map((et) => (
              <option key={et.id} value={et.id}>
                {et.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {hasActiveFilters && (
        <button
          onClick={() => onChange({ ...EMPTY_REPORT_FILTERS })}
          className="inline-flex h-9 items-center gap-1 rounded-lg border border-destructive/40 px-2.5 text-xs font-medium text-destructive hover:bg-destructive/5 transition-colors"
        >
          <X className="h-3 w-3" />
          Filtreleri Temizle
        </button>
      )}
    </div>
  );
}
