"use client";

import { useMemo, useState } from "react";
import { BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/data/store";
import {
  computeEarningFactor,
  formatCurrency,
  formatDate,
  formatTime,
  getSessionStatusLabel,
  isAwaitingEarningApproval,
  roundEarning,
} from "@/lib/helpers/finance";

/**
 * Sessions whose earning waits for a manager — only shown with Ayarlar →
 * Öğretmen ve Hakediş → Hakediş Oluşturma Anı: "Yönetici onayladığında".
 * Approving one makes its earning count toward the teacher's totals.
 */
export function PendingEarningApprovalsCard() {
  const store = useStore();
  const policy = store.institutionSettings.teacherEarnings;
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const pending = useMemo(
    () =>
      store.sessions
        .filter((s) => isAwaitingEarningApproval(s, policy))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [store.sessions, policy]
  );

  if (policy.earningTriggerMoment !== "on_admin_approval" || pending.length === 0) return null;

  const teacherName = (id: string) => store.teachers.find((t) => t.id === id)?.fullName ?? "—";
  const studentName = (id: string) => store.students.find((s) => s.id === id)?.fullName ?? "—";
  const amountOf = (s: (typeof pending)[number]) =>
    roundEarning(s.teacherEarning * s.sessionCount * (s.earningFactor ?? computeEarningFactor(s.status, policy)));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const approve = (ids: string[]) => {
    store.approveSessionEarnings(ids);
    setSelected(new Set());
  };

  const selectedIds = pending.filter((s) => selected.has(s.id)).map((s) => s.id);

  return (
    <div className="rounded-lg border border-amber-300/60 bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Onay Bekleyen Hakedişler ({pending.length})</p>
          <p className="text-xs text-muted-foreground">
            Kurum ayarına göre hakedişler yönetici onayından sonra öğretmen bakiyesine eklenir.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={selectedIds.length === 0} onClick={() => approve(selectedIds)}>
            Seçilenleri Onayla ({selectedIds.length})
          </Button>
          <Button size="sm" onClick={() => approve(pending.map((s) => s.id))}>
            <BadgeCheck className="h-3.5 w-3.5 mr-1" />
            Tümünü Onayla
          </Button>
        </div>
      </div>
      <div className="max-h-72 divide-y divide-border/60 overflow-y-auto">
        {pending.map((s) => (
          <label key={s.id} className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted/40">
            <input
              type="checkbox"
              checked={selected.has(s.id)}
              onChange={() => toggle(s.id)}
              className="h-4 w-4 rounded border-border"
            />
            <span className="w-32 shrink-0 tabular-nums text-muted-foreground">
              {formatDate(s.date)} {formatTime(s.date)}
            </span>
            <span className="min-w-0 flex-1 truncate">
              <span className="font-medium text-foreground">{teacherName(s.teacherId)}</span>
              <span className="text-muted-foreground"> · {studentName(s.studentId)} · {getSessionStatusLabel(s.status)}</span>
            </span>
            <span className="shrink-0 font-semibold tabular-nums">{formatCurrency(amountOf(s))}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
