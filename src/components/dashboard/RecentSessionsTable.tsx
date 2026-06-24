"use client";

import type { Session } from "@/types";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDateTime, formatCurrency } from "@/lib/helpers/finance";
import { mockStudents } from "@/lib/mock/students";
import { mockTeachers } from "@/lib/mock/teachers";
import { mockEducationTypes } from "@/lib/mock/education-types";

interface RecentSessionsTableProps {
  sessions: Session[];
}

const columns: Column<Session>[] = [
  {
    key: "student",
    header: "Öğrenci",
    render: (row) => {
      const student = mockStudents.find((s) => s.id === row.studentId);
      return (
        <span className="font-medium text-foreground">
          {student?.fullName ?? "—"}
        </span>
      );
    },
  },
  {
    key: "teacher",
    header: "Öğretmen",
    render: (row) => {
      const teacher = mockTeachers.find((t) => t.id === row.teacherId);
      return <span className="text-muted-foreground">{teacher?.fullName ?? "—"}</span>;
    },
  },
  {
    key: "educationType",
    header: "Eğitim Türü",
    render: (row) => {
      const et = mockEducationTypes.find((e) => e.id === row.educationTypeId);
      return <span className="text-muted-foreground">{et?.name ?? "—"}</span>;
    },
    className: "hidden md:table-cell",
    headerClassName: "hidden md:table-cell",
  },
  {
    key: "date",
    header: "Tarih",
    render: (row) => (
      <span className="text-muted-foreground tabular-nums">
        {formatDateTime(row.date)}
      </span>
    ),
    className: "hidden lg:table-cell",
    headerClassName: "hidden lg:table-cell",
  },
  {
    key: "price",
    header: "Ücret",
    render: (row) => (
      <span className="tabular-nums font-medium">
        {formatCurrency(row.studentPrice)}
      </span>
    ),
    className: "text-right",
    headerClassName: "text-right",
  },
  {
    key: "status",
    header: "Durum",
    render: (row) => <StatusBadge status={row.status} />,
    className: "text-right",
    headerClassName: "text-right",
  },
];

export function RecentSessionsTable({ sessions }: RecentSessionsTableProps) {
  return (
    <DataTable
      data={sessions}
      columns={columns}
      keyExtractor={(s) => s.id}
      emptyTitle="Seans bulunamadı"
      emptyDescription="Henüz seans kaydı oluşturulmamış."
    />
  );
}
