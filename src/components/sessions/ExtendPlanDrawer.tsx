"use client";

import { useState, useEffect, useMemo } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { FormDrawer } from "@/components/shared/FormDrawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { mockEducationTypes } from "@/lib/mock/education-types";
import { useMockStore } from "@/lib/mock/store";
import { formatCurrency, formatDate, formatTime } from "@/lib/helpers/finance";
import {
  generateSessionDates,
  nextDayString,
  findDuplicateDateTimestamps,
} from "@/lib/helpers/weekly-plans";
import { partitionDatesByConflict } from "@/lib/helpers/session-conflict";
import { WeeklyPlanConflictWarning } from "@/components/sessions/WeeklyPlanConflictWarning";
import type { WeeklySessionPlan } from "@/types";

interface ExtendPlanDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: WeeklySessionPlan;
}

export function ExtendPlanDrawer({ open, onOpenChange, plan }: ExtendPlanDrawerProps) {
  const store = useMockStore();
  const [newEndDate, setNewEndDate] = useState("");

  useEffect(() => {
    if (open) {
      setNewEndDate("");
    }
  }, [open, plan.id]);

  const student = store.students.find((s) => s.id === plan.studentId);
  const teacher = store.teachers.find((t) => t.id === plan.teacherId);
  const educationType = mockEducationTypes.find((et) => et.id === plan.educationTypeId);

  const minDate = nextDayString(plan.endDate);
  const isValidEndDate = !!newEndDate && newEndDate >= minDate;

  const candidateDates = useMemo(
    () => (isValidEndDate ? generateSessionDates(minDate, newEndDate, plan.weeklySchedule) : []),
    [isValidEndDate, minDate, newEndDate, plan.weeklySchedule]
  );

  const duplicateTimestamps = useMemo(
    () =>
      candidateDates.length === 0
        ? new Set<number>()
        : findDuplicateDateTimestamps(
            candidateDates,
            plan.studentId,
            plan.teacherId,
            plan.educationTypeId,
            store.sessions
          ),
    [candidateDates, plan.studentId, plan.teacherId, plan.educationTypeId, store.sessions]
  );

  const datesAfterDuplicates = useMemo(
    () => candidateDates.filter((d) => !duplicateTimestamps.has(new Date(d).getTime())),
    [candidateDates, duplicateTimestamps]
  );
  const skippedDuplicateCount = duplicateTimestamps.size;

  // Conflicting dates are excluded from datesToCreate, never force-created.
  const { datesToCreate, conflicts } = useMemo(
    () =>
      datesAfterDuplicates.length === 0
        ? { datesToCreate: [], conflicts: [] }
        : partitionDatesByConflict(
            datesAfterDuplicates,
            plan.studentId,
            plan.teacherId,
            50,
            store.sessions
          ),
    [datesAfterDuplicates, plan.studentId, plan.teacherId, store.sessions]
  );

  const totalBilling = datesToCreate.length * plan.studentPrice;
  const totalTeacherEarning = datesToCreate.length * plan.teacherEarning;

  const canSave = isValidEndDate;

  const handleSave = () => {
    if (!canSave) return;
    const tenantId = plan.tenantId;

    for (const dateStr of datesToCreate) {
      store.addSession({
        id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        tenantId,
        studentId: plan.studentId,
        teacherId: plan.teacherId,
        educationTypeId: plan.educationTypeId,
        date: dateStr,
        durationMinutes: 50,
        sessionCount: 1,
        studentPrice: plan.studentPrice,
        teacherEarning: plan.teacherEarning,
        status: "planned",
        notes: plan.notes,
        createdAt: new Date().toISOString(),
        weeklyPlanId: plan.id,
      });
    }

    store.updateWeeklySessionPlan({ ...plan, endDate: newEndDate });
    onOpenChange(false);
  };

  const saveLabel =
    datesToCreate.length > 0 ? `${datesToCreate.length} Seans Oluştur ve Uzat` : "Planı Uzat";

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Planı Uzat"
      description="Yeni bir bitiş tarihi seçin. Yalnızca mevcut bitiş tarihinden sonraki eksik seanslar oluşturulur."
      onSave={handleSave}
      saveLabel={saveLabel}
    >
      <div className="space-y-5">
        {/* Plan summary */}
        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 space-y-1 text-sm">
          <p className="font-medium text-foreground">{student?.fullName ?? "—"}</p>
          <p className="text-xs text-muted-foreground">
            {teacher?.fullName ?? "—"} · {educationType?.name ?? "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            Mevcut bitiş tarihi: <span className="font-medium text-foreground">{formatDate(plan.endDate + "T00:00:00")}</span>
          </p>
        </div>

        {/* New end date */}
        <div className="space-y-1.5">
          <Label htmlFor="extend-end-date">Yeni Bitiş Tarihi</Label>
          <Input
            id="extend-end-date"
            type="date"
            min={minDate}
            value={newEndDate}
            onChange={(e) => setNewEndDate(e.target.value)}
          />
          {newEndDate && !isValidEndDate && (
            <p className="text-xs text-destructive">
              Yeni bitiş tarihi, mevcut bitiş tarihinden sonra olmalıdır.
            </p>
          )}
        </div>

        <Separator />

        {/* Preview */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Önizleme
          </p>

          {!isValidEndDate && (
            <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
              <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                Geçerli bir yeni bitiş tarihi seçildiğinde önizleme görünecek.
              </p>
            </div>
          )}

          {isValidEndDate && candidateDates.length === 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50 dark:bg-amber-950/20 px-3 py-2.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Seçilen tarih aralığında planın haftalık programına denk gelen seans bulunamadı.
              </p>
            </div>
          )}

          {skippedDuplicateCount > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
              <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                {skippedDuplicateCount} seans zaten mevcut olduğu için atlanacak.
              </p>
            </div>
          )}

          <WeeklyPlanConflictWarning
            conflicts={conflicts}
            students={store.students}
            teachers={store.teachers}
            educationTypes={mockEducationTypes}
          />

          {datesToCreate.length > 0 && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
                  <p className="text-2xl font-bold text-foreground tabular-nums">
                    {datesToCreate.length}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 font-medium uppercase tracking-wide">
                    Yeni Seans
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
                  <p className="text-lg font-bold text-foreground tabular-nums">
                    {formatCurrency(totalBilling)}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 font-medium uppercase tracking-wide">
                    Potansiyel Tahakkuk
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
                  <p className="text-lg font-bold text-amber-600 tabular-nums">
                    {formatCurrency(totalTeacherEarning)}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 font-medium uppercase tracking-wide">
                    Öğretmen Hakedişi
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-1.5">
                <p className="text-xs font-medium text-foreground mb-2">Oluşturulacak Seanslar</p>
                {datesToCreate.slice(0, 8).map((d, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary/60 shrink-0" />
                    <span>{formatDate(d)} — {formatTime(d)}</span>
                  </div>
                ))}
                {datesToCreate.length > 8 && (
                  <p className="text-xs text-muted-foreground italic pt-1">
                    …ve {datesToCreate.length - 8} seans daha
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </FormDrawer>
  );
}
