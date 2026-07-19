"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, CheckCircle2, AlertTriangle } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useMockStore } from "@/lib/mock/store";
import { buildTeacherMergePreview } from "@/lib/helpers/teacher-merge";
import type { DuplicateTeacherCandidate } from "@/lib/helpers/finance";
import type { Teacher } from "@/types";
import { cn } from "@/lib/utils";

// ─── Merge Teacher drawer ───────────────────────────────────────────────────────
// Serves BOTH the single-pair "Birleştir" flow and the "Tümünü İncele" bulk-review
// flow — a bulk review is just a queue of length > 1 that this drawer steps through
// one confirmed merge at a time. Every merge still goes through the same full
// preview/conflict/confirm gate; nothing here ever auto-merges a pair without the
// user hitting "Birleştir" on that specific pair (requirement: never bulk merge
// automatically).

interface TeacherMergeDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  queue: DuplicateTeacherCandidate[];
}

interface MergeResultSummary {
  primaryName: string;
  duplicateName: string;
  sessions: number;
  teacherEarnings: number;
  teacherPayments: number;
  teacherCustomPrices: number;
  weeklyPlans: number;
}

export function TeacherMergeDrawer({ open, onOpenChange, queue }: TeacherMergeDrawerProps) {
  const store = useMockStore();
  const [index, setIndex] = useState(0);
  const [swapped, setSwapped] = useState(false);
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<MergeResultSummary | null>(null);

  useEffect(() => {
    if (open) {
      setIndex(0);
      setSwapped(false);
      setReason("");
      setResult(null);
    }
  }, [open]);

  const candidate = queue[index] ?? null;

  const sessionCountFor = (teacherId: string) =>
    store.sessions.filter((s) => s.teacherId === teacherId).length;

  // Re-read both sides live from the store (rather than trusting the candidate
  // snapshot captured when the panel's useMemo last ran) — session counts can
  // shift mid-review as earlier pairs in the same queue get merged.
  const rawA = candidate ? store.teachers.find((t) => t.id === candidate.teacherA.id) : undefined;
  const rawB = candidate ? store.teachers.find((t) => t.id === candidate.teacherB.id) : undefined;

  // Default: whichever side has more sessions today is the one kept (primary);
  // the sparser record is archived. User can always swap before confirming.
  let defaultPrimary: Teacher | undefined;
  let defaultDuplicate: Teacher | undefined;
  if (rawA && rawB) {
    const countA = sessionCountFor(rawA.id);
    const countB = sessionCountFor(rawB.id);
    [defaultPrimary, defaultDuplicate] = countA >= countB ? [rawA, rawB] : [rawB, rawA];
  }

  const primaryTeacher = swapped ? defaultDuplicate : defaultPrimary;
  const duplicateTeacher = swapped ? defaultPrimary : defaultDuplicate;

  const preview = useMemo(() => {
    if (!primaryTeacher || !duplicateTeacher) return null;
    return buildTeacherMergePreview(
      primaryTeacher,
      duplicateTeacher,
      store.sessions,
      store.teacherEarnings,
      store.teacherPayments,
      store.teacherCustomPrices,
      store.weeklySessionPlans,
      store.educationTypes
    );
  }, [
    primaryTeacher,
    duplicateTeacher,
    store.sessions,
    store.teacherEarnings,
    store.teacherPayments,
    store.teacherCustomPrices,
    store.weeklySessionPlans,
    store.educationTypes,
  ]);

  const hasNext = index < queue.length - 1;

  function handleConfirm() {
    if (!primaryTeacher || !duplicateTeacher || !preview?.isSafe) return;
    store.mergeTeachers({
      primaryTeacherId: primaryTeacher.id,
      duplicateTeacherId: duplicateTeacher.id,
      reason: reason.trim() || undefined,
    });
    setResult({
      primaryName: primaryTeacher.fullName,
      duplicateName: duplicateTeacher.fullName,
      sessions: preview.counts.sessions,
      teacherEarnings: preview.counts.teacherEarnings,
      teacherPayments: preview.counts.teacherPayments,
      teacherCustomPrices: preview.counts.teacherCustomPrices,
      weeklyPlans: preview.counts.weeklyPlans,
    });
  }

  function handleAdvance() {
    if (hasNext) {
      setIndex((i) => i + 1);
      setSwapped(false);
      setReason("");
      setResult(null);
    } else {
      onOpenChange(false);
    }
  }

  if (!candidate || !primaryTeacher || !duplicateTeacher) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" showCloseButton className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
          <SheetHeader className="px-5 pt-5 pb-4">
            <SheetTitle className="text-base font-semibold">Öğretmenleri Birleştir</SheetTitle>
          </SheetHeader>
          <Separator />
          <div className="flex-1 px-5 py-8 text-center text-sm text-muted-foreground">
            İncelenecek olası yinelenen kayıt kalmadı.
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" showCloseButton className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="px-5 pt-5 pb-4">
          <SheetTitle className="text-base font-semibold">
            Öğretmenleri Birleştir
            {queue.length > 1 && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {index + 1} / {queue.length}
              </span>
            )}
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            İkincil kayıt arşivlenir; tüm seans, hakediş, ödeme, özel fiyat ve haftalık
            plan kayıtları birincil öğretmene taşınır. Hiçbir kayıt silinmez.
          </SheetDescription>
        </SheetHeader>
        <Separator />

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {result ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 space-y-1.5">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-800">
                <CheckCircle2 className="h-4 w-4" /> Birleştirme tamamlandı
              </p>
              <p className="text-xs text-emerald-700">
                &quot;{result.duplicateName}&quot; arşivlendi ve &quot;{result.primaryName}&quot; ile
                birleştirildi.
              </p>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-0.5 pt-1 text-xs text-emerald-700">
                <li>Seans: {result.sessions}</li>
                <li>Hakediş: {result.teacherEarnings}</li>
                <li>Ödeme: {result.teacherPayments}</li>
                <li>Özel Fiyat: {result.teacherCustomPrices}</li>
                <li>Haftalık Plan: {result.weeklyPlans}</li>
              </ul>
            </div>
          ) : (
            <>
              {/* Primary / Duplicate pickers */}
              <div className="space-y-3">
                <TeacherMergeCard
                  role="primary"
                  teacher={primaryTeacher}
                  sessionCount={sessionCountFor(primaryTeacher.id)}
                />
                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => setSwapped((s) => !s)}
                    title="Öğretmenleri değiştir"
                  >
                    <ArrowLeftRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <TeacherMergeCard
                  role="duplicate"
                  teacher={duplicateTeacher}
                  sessionCount={sessionCountFor(duplicateTeacher.id)}
                />
              </div>

              <Separator />

              {/* Preview counts */}
              {preview && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Taşınacak Kayıtlar
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <PreviewStat label="Seanslar" value={preview.counts.sessions} />
                    <PreviewStat label="Öğretmen Hakedişleri" value={preview.counts.teacherEarnings} />
                    <PreviewStat label="Öğretmen Ödemeleri" value={preview.counts.teacherPayments} />
                    <PreviewStat label="Özel Fiyatlar" value={preview.counts.teacherCustomPrices} />
                    <PreviewStat label="Haftalık Planlar" value={preview.counts.weeklyPlans} />
                    <PreviewStat label="Takvim Referansları" value={preview.counts.calendarReferences} />
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    Raporlar ve Panel: birleştirme sonrası otomatik güncellenir — ayrı bir işlem gerekmez.
                  </div>
                </div>
              )}

              {/* Conflicts */}
              {preview && preview.conflicts.length > 0 ? (
                <div className="space-y-2">
                  {preview.conflicts.map((c) => (
                    <div
                      key={c.category}
                      className="flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5"
                    >
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
                      <p className="text-xs text-red-800">{c.message}</p>
                    </div>
                  ))}
                  <p className="text-xs font-medium text-red-700">
                    Çakışmalar giderilmeden birleştirme yapılamaz — hiçbir kayıt taşınmadı.
                  </p>
                </div>
              ) : (
                preview && (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    <p className="text-xs text-emerald-800">
                      Çakışma bulunamadı — birleştirme güvenli.
                    </p>
                  </div>
                )
              )}

              {/* Reason */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Not (opsiyonel)</label>
                <textarea
                  rows={2}
                  placeholder={`${duplicateTeacher.fullName} → ${primaryTeacher.fullName} birleştirildi`}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </>
          )}
        </div>

        <Separator />
        <SheetFooter className="flex flex-row justify-end gap-2 px-5 py-4">
          {result ? (
            <Button onClick={handleAdvance}>{hasNext ? "Sonraki Kayıt" : "Kapat"}</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Vazgeç
              </Button>
              <Button onClick={handleConfirm} disabled={!preview?.isSafe}>
                Birleştir
              </Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────────

function TeacherMergeCard({
  role,
  teacher,
  sessionCount,
}: {
  role: "primary" | "duplicate";
  teacher: Teacher;
  sessionCount: number;
}) {
  const isPrimary = role === "primary";
  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-3",
        isPrimary ? "border-primary/40 bg-primary/5" : "border-amber-200 bg-amber-50"
      )}
    >
      <p
        className={cn(
          "text-[10px] font-semibold uppercase tracking-wide",
          isPrimary ? "text-primary" : "text-amber-700"
        )}
      >
        {isPrimary ? "Birincil (Korunacak)" : "İkincil (Arşivlenecek)"}
      </p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">{teacher.fullName}</p>
          <p className="text-xs text-muted-foreground">{teacher.phone}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold tabular-nums text-foreground">{sessionCount}</p>
          <p className="text-[10px] text-muted-foreground">seans</p>
        </div>
      </div>
      <div className="mt-1.5">
        <StatusBadge status={teacher.status} />
      </div>
    </div>
  );
}

function PreviewStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted/40 px-3 py-2">
      <p className="text-base font-bold tabular-nums text-foreground">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
