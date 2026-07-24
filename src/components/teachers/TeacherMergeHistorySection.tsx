"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { useMockStore } from "@/lib/mock/store";
import { formatDateTime } from "@/lib/helpers/finance";
import type { TeacherMergeHistory } from "@/types";

// ─── Öğretmen Birleştirme Geçmişi — global list ────────────────────────────────
// The Import History page's counterpart to TeacherMergeHistoryTab (which is
// scoped to one teacher's own detail page): every merge across every teacher,
// newest first, with the same rollback affordance — see Teacher Merge
// requirement 7 ("Visible under: Teacher Detail, Import History").

const columns: Column<TeacherMergeHistory>[] = [
  {
    key: "date",
    header: "Tarih",
    render: (h) => <span className="text-xs text-muted-foreground">{formatDateTime(h.mergedAt)}</span>,
  },
  {
    key: "primary",
    header: "Birincil (Korunan)",
    render: (h) => (
      <Link
        href={`/app/teachers/${h.primaryTeacherId}`}
        className="font-medium text-foreground hover:text-primary transition-colors"
      >
        {h.primaryTeacherName}
      </Link>
    ),
  },
  {
    key: "duplicate",
    header: "İkincil (Arşivlenen)",
    render: (h) => (
      <Link
        href={`/app/teachers/${h.duplicateTeacherId}`}
        className="text-muted-foreground hover:text-primary transition-colors"
      >
        {h.duplicateTeacherName}
      </Link>
    ),
  },
  {
    key: "moved",
    header: "Taşınan Kayıtlar",
    render: (h) => (
      <span className="text-xs text-muted-foreground">
        {h.moved.sessions} seans · {h.moved.teacherEarnings} hakediş · {h.moved.teacherPayments} ödeme ·{" "}
        {h.moved.teacherEducationTypeAssignments} eğitim türü ataması · {h.moved.weeklyPlans} plan
      </span>
    ),
    className: "hidden md:table-cell",
    headerClassName: "hidden md:table-cell",
  },
  {
    key: "status",
    header: "Durum",
    render: (h) =>
      h.rolledBackAt ? (
        <span className="text-xs text-muted-foreground">Geri Alındı</span>
      ) : (
        <span className="text-xs font-medium text-emerald-600">Aktif</span>
      ),
  },
];

export function TeacherMergeHistorySection() {
  const store = useMockStore();
  const [rollbackTarget, setRollbackTarget] = useState<TeacherMergeHistory | null>(null);

  const rows = [...store.teacherMergeHistory].reverse();

  const fullColumns: Column<TeacherMergeHistory>[] = [
    ...columns,
    {
      key: "action",
      header: "",
      render: (h) =>
        !h.rolledBackAt ? (
          <button
            className="text-xs font-medium text-destructive underline underline-offset-2"
            onClick={() => setRollbackTarget(h)}
          >
            Birleştirmeyi Geri Al
          </button>
        ) : (
          <span className="text-muted-foreground/30 text-xs">—</span>
        ),
      className: "w-44",
      headerClassName: "w-44",
    },
  ];

  function confirmRollback() {
    if (!rollbackTarget) return;
    store.rollbackTeacherMerge(rollbackTarget.id);
    setRollbackTarget(null);
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="border-b border-border/60 px-5 py-4">
        <p className="text-sm font-semibold text-foreground">Öğretmen Birleştirme Geçmişi</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Yinelenen öğretmen kayıtları için yapılan birleştirmeleri görüntüleyin veya geri alın
        </p>
      </div>
      <DataTable
        data={rows}
        columns={fullColumns}
        keyExtractor={(h) => h.id}
        emptyTitle="Henüz birleştirme yapılmadı"
      />

      <Dialog open={!!rollbackTarget} onOpenChange={(open) => !open && setRollbackTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Birleştirmeyi Geri Al</DialogTitle>
            <DialogDescription>
              {rollbackTarget && (
                <>
                  &quot;{rollbackTarget.duplicateTeacherName}&quot; kaydı yeniden etkinleştirilecek ve{" "}
                  {rollbackTarget.moved.sessions} seans, {rollbackTarget.moved.teacherEarnings} hakediş,{" "}
                  {rollbackTarget.moved.teacherPayments} ödeme, {rollbackTarget.moved.teacherEducationTypeAssignments}{" "}
                  eğitim türü ataması ve {rollbackTarget.moved.weeklyPlans} haftalık plan bu kayda geri taşınacak.
                  Birleştirmeden sonra eklenmiş yeni kayıtlar etkilenmez.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRollbackTarget(null)}>
              Vazgeç
            </Button>
            <Button variant="destructive" onClick={confirmRollback}>
              Geri Al
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
