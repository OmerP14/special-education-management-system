"use client";

import { useState } from "react";
import Link from "next/link";
import { Undo2, GitMerge } from "lucide-react";
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

interface TeacherMergeHistoryTabProps {
  teacherId: string;
}

interface MergeRow {
  entry: TeacherMergeHistory;
  role: "primary" | "duplicate";
  otherTeacherId: string;
  otherTeacherName: string;
}

export function TeacherMergeHistoryTab({ teacherId }: TeacherMergeHistoryTabProps) {
  const store = useMockStore();
  const [rollbackTarget, setRollbackTarget] = useState<TeacherMergeHistory | null>(null);

  const rows: MergeRow[] = store.teacherMergeHistory
    .filter((h) => h.primaryTeacherId === teacherId || h.duplicateTeacherId === teacherId)
    .sort((a, b) => new Date(b.mergedAt).getTime() - new Date(a.mergedAt).getTime())
    .map((entry) => {
      const role = entry.primaryTeacherId === teacherId ? "primary" : "duplicate";
      return {
        entry,
        role,
        otherTeacherId: role === "primary" ? entry.duplicateTeacherId : entry.primaryTeacherId,
        otherTeacherName: role === "primary" ? entry.duplicateTeacherName : entry.primaryTeacherName,
      };
    });

  function confirmRollback() {
    if (!rollbackTarget) return;
    store.rollbackTeacherMerge(rollbackTarget.id);
    setRollbackTarget(null);
  }

  const columns: Column<MergeRow>[] = [
    {
      key: "date",
      header: "Tarih",
      render: (r) => <span className="text-xs text-muted-foreground">{formatDateTime(r.entry.mergedAt)}</span>,
    },
    {
      key: "role",
      header: "Yön",
      render: (r) => (
        <span
          className={
            r.role === "primary"
              ? "inline-flex rounded-full bg-primary/8 px-2 py-0.5 text-[10px] font-medium text-primary"
              : "inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700"
          }
        >
          {r.role === "primary" ? "Bu kayıt korundu" : "Bu kayıt arşivlendi"}
        </span>
      ),
    },
    {
      key: "other",
      header: "Diğer Öğretmen",
      render: (r) => (
        <Link
          href={`/app/teachers/${r.otherTeacherId}`}
          className="font-medium text-foreground hover:text-primary transition-colors"
        >
          {r.otherTeacherName}
        </Link>
      ),
    },
    {
      key: "moved",
      header: "Taşınan Kayıtlar",
      render: (r) => (
        <span className="text-xs text-muted-foreground">
          {r.entry.moved.sessions} seans · {r.entry.moved.teacherEarnings} hakediş ·{" "}
          {r.entry.moved.teacherPayments} ödeme · {r.entry.moved.teacherEducationTypeAssignments} eğitim türü ataması ·{" "}
          {r.entry.moved.weeklyPlans} plan
        </span>
      ),
      className: "hidden md:table-cell",
      headerClassName: "hidden md:table-cell",
    },
    {
      key: "reason",
      header: "Neden",
      render: (r) => <span className="text-xs text-muted-foreground">{r.entry.reason}</span>,
      className: "hidden lg:table-cell",
      headerClassName: "hidden lg:table-cell",
    },
    {
      key: "status",
      header: "Durum",
      render: (r) =>
        r.entry.rolledBackAt ? (
          <span className="text-xs text-muted-foreground">Geri Alındı</span>
        ) : (
          <span className="text-xs font-medium text-emerald-600">Aktif</span>
        ),
    },
    {
      key: "action",
      header: "",
      render: (r) =>
        !r.entry.rolledBackAt ? (
          <button
            onClick={() => setRollbackTarget(r.entry)}
            className="inline-flex items-center gap-1 text-xs font-medium text-destructive underline underline-offset-2"
          >
            <Undo2 className="h-3 w-3" />
            Geri Al
          </button>
        ) : (
          <span className="text-muted-foreground/30 text-xs">—</span>
        ),
      className: "w-28",
      headerClassName: "w-28",
    },
  ];

  return (
    <div className="space-y-4">
      <DataTable
        data={rows}
        columns={columns}
        keyExtractor={(r) => r.entry.id}
        emptyTitle="Birleştirme geçmişi yok"
        emptyDescription="Bu öğretmen için henüz bir birleştirme işlemi yapılmadı."
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
              <GitMerge className="h-3.5 w-3.5 mr-1.5" />
              Geri Al
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
