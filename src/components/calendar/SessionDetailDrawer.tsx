"use client";

import Link from "next/link";
import {
  User,
  GraduationCap,
  BookOpen,
  CalendarDays,
  Clock,
  BarChart2,
  FileText,
  TrendingUp,
  Hash,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  formatCurrency,
  formatDate,
  formatTime,
} from "@/lib/helpers/finance";
import type { CalendarEventRelations } from "@/lib/helpers/calendar";

// ─── Info row ──────────────────────────────────────────────────────────────────

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground leading-none mb-0.5">
          {label}
        </p>
        <div className="text-sm font-medium text-foreground">{children}</div>
      </div>
    </div>
  );
}

// ─── Finance row ───────────────────────────────────────────────────────────────

function FinanceRow({
  label,
  value,
  variant = "default",
}: {
  label: string;
  value: string;
  variant?: "default" | "warning" | "success";
}) {
  return (
    <div className="flex items-center justify-between text-sm py-1">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={
          variant === "warning"
            ? "font-semibold text-amber-600 tabular-nums"
            : variant === "success"
            ? "font-semibold text-emerald-600 tabular-nums"
            : "font-semibold text-foreground tabular-nums"
        }
      >
        {value}
      </span>
    </div>
  );
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface SessionDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  relations: CalendarEventRelations | null;
  onEdit?: () => void;
}

// ─── Main component ────────────────────────────────────────────────────────────

export function SessionDetailDrawer({
  open,
  onOpenChange,
  relations,
  onEdit,
}: SessionDetailDrawerProps) {
  if (!relations) return null;

  const { session, student, guardian, teacher, educationType } = relations;

  const totalStudentAmount = session.studentPrice * session.sessionCount;
  const totalTeacherEarning = session.teacherEarning * session.sessionCount;
  const centerProfit = totalStudentAmount - totalTeacherEarning;

  return (
    <Sheet open={open} onOpenChange={(o) => onOpenChange(o)}>
      <SheetContent
        side="right"
        showCloseButton
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
      >
        <SheetHeader className="px-5 pt-5 pb-4">
          <SheetTitle className="text-base font-semibold">Seans Detayı</SheetTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatDate(session.date)} · {formatTime(session.date)}
          </p>
        </SheetHeader>

        <Separator />

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {/* Core relations */}
          <div className="divide-y divide-border/50">
            <InfoRow icon={User} label="Öğrenci">
              {student ? (
                <Link
                  href={`/app/students/${student.id}`}
                  className="text-foreground hover:text-primary transition-colors"
                  onClick={() => onOpenChange(false)}
                >
                  {student.fullName}
                </Link>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </InfoRow>

            <InfoRow icon={User} label="Veli">
              {guardian ? (
                <Link
                  href={`/app/guardians/${guardian.id}`}
                  className="text-foreground hover:text-primary transition-colors"
                  onClick={() => onOpenChange(false)}
                >
                  {guardian.fullName}
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                    {guardian.relationship}
                  </span>
                </Link>
              ) : (
                <span className="text-muted-foreground text-xs">Kayıtlı veli yok</span>
              )}
            </InfoRow>

            <InfoRow icon={GraduationCap} label="Öğretmen">
              {teacher ? (
                <Link
                  href={`/app/teachers/${teacher.id}`}
                  className="text-foreground hover:text-primary transition-colors"
                  onClick={() => onOpenChange(false)}
                >
                  {teacher.fullName}
                </Link>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </InfoRow>

            <InfoRow icon={BookOpen} label="Eğitim Türü">
              {educationType ? (
                <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {educationType.name}
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </InfoRow>
          </div>

          <Separator className="my-3" />

          {/* Time & count */}
          <div className="divide-y divide-border/50">
            <InfoRow icon={CalendarDays} label="Tarih">
              {formatDate(session.date)}
            </InfoRow>

            <InfoRow icon={Clock} label="Saat">
              {formatTime(session.date)}
            </InfoRow>

            <InfoRow icon={Hash} label="Seans Sayısı">
              {session.sessionCount} seans
            </InfoRow>
          </div>

          <Separator className="my-3" />

          {/* Financials */}
          <div className="rounded-lg bg-muted/40 px-3 py-2.5 space-y-0.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Finansal Özet
            </p>
            <FinanceRow
              label={`Öğrenci Ücreti (${session.sessionCount} × ₺${session.studentPrice})`}
              value={formatCurrency(totalStudentAmount)}
            />
            <FinanceRow
              label={`Öğretmen Hakedişi (${session.sessionCount} × ₺${session.teacherEarning})`}
              value={formatCurrency(totalTeacherEarning)}
              variant="warning"
            />
            <div className="border-t border-border/60 pt-1.5 mt-1">
              <FinanceRow
                label="Merkez Kârı"
                value={formatCurrency(centerProfit)}
                variant="success"
              />
            </div>
          </div>

          <Separator className="my-3" />

          {/* Status & notes */}
          <div className="divide-y divide-border/50">
            <InfoRow icon={BarChart2} label="Durum">
              <StatusBadge status={session.status} />
            </InfoRow>

            {session.notes && (
              <InfoRow icon={FileText} label="Notlar">
                <span className="text-sm text-muted-foreground leading-relaxed">
                  {session.notes}
                </span>
              </InfoRow>
            )}
          </div>
        </div>

        <Separator />

        <div className="flex items-center justify-between gap-2 px-5 py-4">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Kapat
          </Button>
          {onEdit && (
            <Button
              size="sm"
              onClick={() => {
                onOpenChange(false);
                onEdit();
              }}
            >
              Düzenle
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
