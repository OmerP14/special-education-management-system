"use client";

import { useRouter } from "next/navigation";
import type { EducationType, Session, Student, Teacher } from "@/types";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDateTime, formatCurrency } from "@/lib/helpers/finance";

interface RecentSessionsTableProps {
  sessions: Session[];
  students: Student[];
  teachers: Teacher[];
  educationTypes: EducationType[];
}

export function RecentSessionsTable({ sessions, students, teachers, educationTypes }: RecentSessionsTableProps) {
  const router = useRouter();

  // No dedicated session detail route exists in this app (sessions are edited via a
  // drawer on the Sessions list page, not a /app/sessions/[id] page) — so a row click
  // navigates to Sessions with ?sessionId=, which that page reads to auto-open the
  // matching session's edit drawer.
  const columns: Column<Session>[] = [
    {
      key: "student",
      header: "Öğrenci",
      render: (row) => {
        const student = students.find((s) => s.id === row.studentId);
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
        const teacher = teachers.find((t) => t.id === row.teacherId);
        return <span className="text-muted-foreground">{teacher?.fullName ?? "—"}</span>;
      },
    },
    {
      key: "educationType",
      header: "Eğitim Türü",
      render: (row) => {
        const et = educationTypes.find((e) => e.id === row.educationTypeId);
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

  return (
    <DataTable
      data={sessions}
      columns={columns}
      keyExtractor={(s) => s.id}
      onRowClick={(row) => router.push(`/app/sessions?sessionId=${row.id}`)}
      emptyTitle="Seans bulunamadı"
      emptyDescription="Henüz seans kaydı oluşturulmamış."
    />
  );
}
