"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  AlertCircle,
  Phone,
  Mail,
  User,
  GraduationCap,
  Tag,
  TrendingUp,
  Pencil,
  RefreshCw,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { TeacherFormDrawer } from "@/components/teachers/TeacherFormDrawer";
import { TeacherPaymentFormDrawer } from "@/components/teachers/TeacherPaymentFormDrawer";
import { TeacherPaymentHistoryTab } from "@/components/teachers/TeacherPaymentHistoryTab";
import { TeacherMergeHistoryTab } from "@/components/teachers/TeacherMergeHistoryTab";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge, EarningStatusBadge } from "@/components/shared/StatusBadge";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { Tabs, type TabItem } from "@/components/shared/Tabs";
import { useMockStore } from "@/lib/mock/store";
import { useUserScope } from "@/lib/auth/use-scope";
import { canAccessTeacher } from "@/lib/auth/scope";
import { UnauthorizedState } from "@/components/auth/UnauthorizedState";
import {
  buildTeacherDetail,
  calculateTeacherMonthlyPayable,
  getTeacherIncludedQuotaUsage,
  getTeacherExtraSessionCount,
  getTeacherPaymentModelLabel,
  resolveTeacherEarningStatus,
  buildEarningRecalculationPreview,
  applyEarningRecalculation,
  formatCurrency,
  formatDate,
  formatTime,
} from "@/lib/helpers/finance";
import { DetailHeaderMeta } from "@/components/shared/DetailHeaderMeta";
import { cn } from "@/lib/utils";
import type {
  EducationType,
  Session,
  Teacher,
  TeacherEducationTypeAssignment,
  TeacherEarning,
  TeacherStudentRow,
  TeacherEducationAssignmentRow,
} from "@/types";

// ─── Enriched earning row for display ─────────────────────────────────────────

interface EarningDisplayRow {
  earning: TeacherEarning;
  studentId: string;
  studentName: string;
  educationTypeName: string;
  sessionCount: number;
  sessionDate: string;
}

// ─── Session column builder ────────────────────────────────────────────────────

function buildSessionColumns(
  students: { id: string; fullName: string }[],
  teacher: Teacher | undefined,
  assignments: TeacherEducationTypeAssignment[],
  educationTypes: EducationType[]
): Column<Session>[] {
  return [
    {
      key: "date",
      header: "Tarih",
      render: (row) => (
        <span className="tabular-nums text-sm">{formatDate(row.date)}</span>
      ),
    },
    {
      key: "time",
      header: "Saat",
      render: (row) => (
        <span className="tabular-nums text-sm text-muted-foreground">
          {formatTime(row.date)}
        </span>
      ),
      className: "hidden sm:table-cell",
      headerClassName: "hidden sm:table-cell",
    },
    {
      key: "student",
      header: "Öğrenci",
      render: (row) => {
        const student = students.find((s) => s.id === row.studentId);
        return (
          <Link
            href={`/app/students/${row.studentId}`}
            className="font-medium text-foreground hover:text-primary transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {student?.fullName ?? "—"}
          </Link>
        );
      },
    },
    {
      key: "educationType",
      header: "Eğitim Türü",
      render: (row) => {
        const et = educationTypes.find((e) => e.id === row.educationTypeId);
        return (
          <span className="text-muted-foreground">{et?.name ?? "—"}</span>
        );
      },
      className: "hidden md:table-cell",
      headerClassName: "hidden md:table-cell",
    },
    {
      key: "sessionCount",
      header: "Adet",
      render: (row) => (
        <span className="tabular-nums text-center">{row.sessionCount}</span>
      ),
      className: "hidden sm:table-cell text-center",
      headerClassName: "hidden sm:table-cell text-center",
    },
    {
      key: "earning",
      header: "Hakediş",
      render: (row) =>
        resolveTeacherEarningStatus(row, teacher, assignments) === "unknown" ? (
          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
            Hakediş bekliyor
          </span>
        ) : (
          <span className="tabular-nums font-medium">
            {formatCurrency(row.teacherEarning * row.sessionCount)}
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
}

const studentRowColumns: Column<TeacherStudentRow>[] = [
  {
    key: "name",
    header: "Öğrenci",
    render: (row) => (
      <Link
        href={`/app/students/${row.studentId}`}
        className="font-medium text-foreground hover:text-primary transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {row.studentName}
      </Link>
    ),
  },
  {
    key: "guardian",
    header: "Veli",
    render: (row) =>
      row.primaryGuardianName && row.primaryGuardianId ? (
        <Link
          href={`/app/guardians/${row.primaryGuardianId}`}
          className="text-muted-foreground hover:text-primary transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {row.primaryGuardianName}
        </Link>
      ) : row.primaryGuardianName ? (
        <span className="text-muted-foreground">{row.primaryGuardianName}</span>
      ) : (
        <span className="text-muted-foreground/40">—</span>
      ),
    className: "hidden sm:table-cell",
    headerClassName: "hidden sm:table-cell",
  },
  {
    key: "educationTypes",
    header: "Eğitim Türleri",
    render: (row) =>
      row.educationTypeNames.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {row.educationTypeNames.map((name) => (
            <span
              key={name}
              className="inline-flex rounded-full bg-primary/8 px-2 py-0.5 text-[10px] font-medium text-primary"
            >
              {name}
            </span>
          ))}
        </div>
      ) : (
        <span className="text-muted-foreground/40">—</span>
      ),
    className: "hidden lg:table-cell",
    headerClassName: "hidden lg:table-cell",
  },
  {
    key: "totalSessions",
    header: "Seans",
    render: (row) => (
      <span className="tabular-nums text-muted-foreground">{row.totalSessions}</span>
    ),
    className: "text-right",
    headerClassName: "text-right",
  },
  {
    key: "lastSession",
    header: "Son Seans",
    render: (row) => (
      <span className="tabular-nums text-muted-foreground text-xs">
        {row.lastSessionDate ? formatDate(row.lastSessionDate) : "—"}
      </span>
    ),
    className: "hidden md:table-cell text-right",
    headerClassName: "hidden md:table-cell text-right",
  },
];

const earningColumns: Column<EarningDisplayRow>[] = [
  {
    key: "date",
    header: "Seans Tarihi",
    render: (row) => (
      <span className="tabular-nums text-sm">{formatDate(row.sessionDate)}</span>
    ),
  },
  {
    key: "student",
    header: "Öğrenci",
    render: (row) =>
      row.studentId ? (
        <Link
          href={`/app/students/${row.studentId}`}
          className="font-medium text-foreground hover:text-primary transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {row.studentName}
        </Link>
      ) : (
        <span className="font-medium">{row.studentName}</span>
      ),
  },
  {
    key: "educationType",
    header: "Eğitim Türü",
    render: (row) => (
      <span className="text-muted-foreground">{row.educationTypeName}</span>
    ),
    className: "hidden md:table-cell",
    headerClassName: "hidden md:table-cell",
  },
  {
    key: "sessionCount",
    header: "Adet",
    render: (row) => (
      <span className="tabular-nums text-muted-foreground">{row.sessionCount}</span>
    ),
    className: "hidden sm:table-cell text-center",
    headerClassName: "hidden sm:table-cell text-center",
  },
  {
    key: "amount",
    header: "Tutar",
    render: (row) => (
      <span className="tabular-nums font-semibold">
        {formatCurrency(row.earning.amount)}
      </span>
    ),
    className: "text-right",
    headerClassName: "text-right",
  },
  {
    key: "status",
    header: "Durum",
    render: (row) => <EarningStatusBadge status={row.earning.status} />,
    className: "text-right",
    headerClassName: "text-right",
  },
];

// ─── InfoRow helper ────────────────────────────────────────────────────────────

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="mt-0.5 text-sm font-medium text-foreground">{value}</div>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

interface TeacherDetailViewProps {
  teacherId: string;
}

export function TeacherDetailView({ teacherId }: TeacherDetailViewProps) {
  const store = useMockStore();
  const scope = useUserScope();

  // Direct-URL scope enforcement — a teacher hitting another teacher's id
  // by URL gets this instead of the record. See lib/auth/scope.ts.
  if (!canAccessTeacher(teacherId, scope)) {
    return (
      <UnauthorizedState
        title="Bu öğretmene erişim yetkiniz yok"
        description="Bu öğretmen kaydı hesabınızla ilişkili değil."
      />
    );
  }

  return <TeacherDetailViewContent teacherId={teacherId} store={store} />;
}

function TeacherDetailViewContent({
  teacherId,
  store,
}: TeacherDetailViewProps & { store: ReturnType<typeof useMockStore> }) {
  const [editOpen, setEditOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [recalcOpen, setRecalcOpen] = useState(false);
  const [recalcApplied, setRecalcApplied] = useState(false);
  // Snapshot of how many sessions were actually resolved by the last apply —
  // `recalcPreview` itself is recomputed live from the store every render, so
  // right after applying it immediately reflects the NEW (now-resolved) state
  // and would otherwise always read back as 0. Never used for anything but
  // display; the store update itself is already complete by the time this is set.
  const [recalcAppliedCount, setRecalcAppliedCount] = useState(0);
  const [mergeRollbackConfirmOpen, setMergeRollbackConfirmOpen] = useState(false);
  const rawTeacher = store.teachers.find((t) => t.id === teacherId);
  const sessionColumns = buildSessionColumns(
    store.students,
    rawTeacher,
    store.teacherEducationTypeAssignments,
    store.educationTypes
  );
  const mergeHistoryCount = store.teacherMergeHistory.filter(
    (h) => h.primaryTeacherId === teacherId || h.duplicateTeacherId === teacherId
  ).length;
  // The single merge that archived this record, if it is itself a merged-away
  // duplicate — used for the banner + quick rollback below. Always at most one
  // active (non-rolled-back) entry can have this teacher as duplicateTeacherId,
  // since mergeTeachers refuses to merge an already-archived teacher.
  const archivingMerge = store.teacherMergeHistory.find(
    (h) => h.duplicateTeacherId === teacherId && !h.rolledBackAt
  );
  const detail = buildTeacherDetail(
    teacherId,
    store.teachers,
    store.educationTypes,
    store.students,
    store.guardians,
    store.sessions,
    store.teacherEarnings,
    store.teacherPayments,
    store.teacherEducationTypeAssignments
  );

  if (!detail) {
    return (
      <div className="space-y-6">
        <Link
          href="/app/teachers"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Öğretmenler
        </Link>
        <EmptyState
          title="Öğretmen bulunamadı"
          description="Bu kimliğe ait öğretmen kaydı mevcut değil."
          icon={GraduationCap}
          action={{
            label: "Öğretmenlere Dön",
            onClick: () => window.history.back(),
          }}
        />
      </div>
    );
  }

  const initials = detail.fullName
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // ─── Unknown-earning recalculation preview (requirement 5) ─────────────────
  // Recomputed live off current store state every render — cheap (bounded by
  // this one teacher's own session count) and guarantees the preview shown in
  // the dialog always reflects the custom prices/settings as they are right now.

  const recalcPreview = rawTeacher
    ? buildEarningRecalculationPreview(rawTeacher, store.sessions, store.teacherEducationTypeAssignments, store.students, store.educationTypes)
    : [];
  const recalcResolvable = recalcPreview.filter((r) => r.recalculatedEarning !== null);
  const recalcStillUnresolved = recalcPreview.filter((r) => r.recalculatedEarning === null);
  const recalcEstimatedImpact = recalcResolvable.reduce(
    (sum, r) => sum + (r.recalculatedEarning! - r.session.teacherEarning) * r.session.sessionCount,
    0
  );

  function handleApplyRecalculation() {
    const updatedSessions = applyEarningRecalculation(recalcPreview);
    setRecalcAppliedCount(updatedSessions.length);
    updatedSessions.forEach((s) => store.updateSession(s));
    setRecalcApplied(true);
  }

  function closeRecalcDialog(open: boolean) {
    setRecalcOpen(open);
    if (!open) setRecalcApplied(false);
  }

  // ─── Enrich earnings for display ───────────────────────────────────────────

  const earningRows: EarningDisplayRow[] = detail.earnings
    .map((earning) => {
      const session = store.sessions.find((s) => s.id === earning.sessionId);
      if (!session) return null;
      const student = store.students.find((s) => s.id === session.studentId);
      const et = store.educationTypes.find((e) => e.id === session.educationTypeId);
      return {
        earning,
        studentId: session.studentId,
        studentName: student?.fullName ?? "—",
        educationTypeName: et?.name ?? "—",
        sessionCount: session.sessionCount,
        sessionDate: session.date,
      };
    })
    .filter((r): r is EarningDisplayRow => r !== null);

  // ─── Tab contents ───────────────────────────────────────────────────────────

  const generalInfoContent = (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Öğretmen Bilgileri
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 divide-y divide-border/60">
        <InfoRow icon={User} label="Ad Soyad" value={detail.fullName} />
        <InfoRow
          icon={Phone}
          label="Telefon"
          value={
            <a href={`tel:${detail.phone}`} className="text-primary hover:underline">
              {detail.phone}
            </a>
          }
        />
        {detail.email && (
          <InfoRow
            icon={Mail}
            label="E-posta"
            value={
              <a href={`mailto:${detail.email}`} className="text-primary hover:underline">
                {detail.email}
              </a>
            }
          />
        )}
        <InfoRow
          icon={Tag}
          label="Uzmanlık Alanları"
          value={
            detail.educationTypeNames.length > 0 ? (
              <div className="flex flex-wrap gap-1 mt-0.5">
                {detail.educationTypeNames.map((name) => (
                  <span
                    key={name}
                    className="inline-flex rounded-full bg-primary/8 px-2 py-0.5 text-[10px] font-medium text-primary"
                  >
                    {name}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-muted-foreground">Tanımlanmamış</span>
            )
          }
        />
        <InfoRow
          icon={TrendingUp}
          label="Hakediş Modeli"
          value={
            <span>
              {getTeacherPaymentModelLabel(detail)}
              {detail.earningType === "monthly_salary" && (
                <> — <span className="font-semibold">{formatCurrency(detail.monthlySalary ?? 0)}</span></>
              )}
              {detail.earningType === "salary_plus_quota" && (
                <> — <span className="font-semibold">{formatCurrency(detail.monthlySalary ?? 0)}</span> + kota üstü ₺{detail.extraSessionEarning ?? 0}/seans</>
              )}
              {detail.earningType === "percentage" && (
                <> — <span className="font-semibold">%{detail.earningPercentage ?? 0}</span></>
              )}
            </span>
          }
        />
        <InfoRow
          icon={GraduationCap}
          label="Durum"
          value={<StatusBadge status={detail.status} />}
        />
        <InfoRow
          icon={CalendarDays}
          label="Kayıt Tarihi"
          value={formatDate(detail.createdAt)}
        />
      </CardContent>
    </Card>
  );

  const sessionsContent = (
    <DataTable
      data={detail.sessions}
      columns={sessionColumns}
      keyExtractor={(s) => s.id}
      emptyTitle="Seans bulunamadı"
      emptyDescription="Bu öğretmene ait seans kaydı bulunmamaktadır."
    />
  );

  const studentsContent = (
    <DataTable
      data={detail.studentRows}
      columns={studentRowColumns}
      keyExtractor={(r) => r.studentId}
      emptyTitle="Öğrenci bulunamadı"
      emptyDescription="Bu öğretmen henüz hiçbir öğrenciyle seans yapmamış."
    />
  );

  const earningsContent = (
    <DataTable
      data={earningRows}
      columns={earningColumns}
      keyExtractor={(r) => r.earning.id}
      emptyTitle="Hakediş bulunamadı"
      emptyDescription="Bu öğretmene ait hakediş kaydı bulunmamaktadır."
    />
  );

  const pricesContent = (() => {
    if (detail.earningType === "monthly_salary") {
      return (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Bu öğretmen aylık maaş modelinde çalışmaktadır. Seans başı ayrıca hakediş hesaplanmaz.
          </p>
          <div className="rounded-lg border border-border bg-muted/30 px-5 py-4 flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Aylık Maaş</span>
            <span className="text-lg font-bold text-foreground tabular-nums">
              {formatCurrency(detail.monthlySalary ?? 0)}
            </span>
          </div>
        </div>
      );
    }

    if (detail.earningType === "salary_plus_quota") {
      const now = new Date();
      const yr = now.getFullYear();
      const mo = now.getMonth() + 1;
      const rawTeacherObj = store.teachers.find((t) => t.id === teacherId)!;
      const totalPayable = calculateTeacherMonthlyPayable(rawTeacherObj, store.sessions, yr, mo);
      const quotaUsed = getTeacherIncludedQuotaUsage(rawTeacherObj, store.sessions, yr, mo);
      const extraCount = getTeacherExtraSessionCount(rawTeacherObj, store.sessions, yr, mo);
      const quota = detail.includedSessionQuota ?? 0;
      const extraRate = detail.extraSessionEarning ?? 0;

      return (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Bu öğretmen sabit maaş + kota üstü modelinde çalışmaktadır. Maaşa dahil
            kota aşıldığında ek seans hakedişi eklenir.
          </p>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border/60">
                <tr className="bg-muted/20">
                  <td className="px-4 py-3 text-sm text-muted-foreground">Aylık Maaş</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">
                    {formatCurrency(detail.monthlySalary ?? 0)}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm text-muted-foreground">Maaşa Dahil Kota</td>
                  <td className="px-4 py-3 text-right tabular-nums text-foreground">
                    {quota} seans
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm text-muted-foreground">Kota Üstü Seans Hakedişi</td>
                  <td className="px-4 py-3 text-right tabular-nums text-foreground">
                    {formatCurrency(extraRate)} / seans
                  </td>
                </tr>
                <tr className="border-t-2 border-border">
                  <td className="px-4 py-3 text-sm text-muted-foreground">Bu Ay — Kota Kullanımı</td>
                  <td className="px-4 py-3 text-right tabular-nums text-foreground">
                    {quotaUsed} / {quota} seans
                  </td>
                </tr>
                {extraCount > 0 && (
                  <tr>
                    <td className="px-4 py-3 text-sm text-muted-foreground">Bu Ay — Kota Üstü</td>
                    <td className="px-4 py-3 text-right tabular-nums text-primary font-medium">
                      {extraCount} seans × {formatCurrency(extraRate)} = {formatCurrency(extraCount * extraRate)}
                    </td>
                  </tr>
                )}
                <tr className="bg-muted/30">
                  <td className="px-4 py-3 text-sm font-semibold text-foreground">Bu Ay Toplam Ödenecek</td>
                  <td className="px-4 py-3 text-right tabular-nums text-lg font-bold text-foreground">
                    {formatCurrency(totalPayable)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (detail.earningType === "percentage") {
      return (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Bu öğretmen yüzde hakediş modelinde çalışmaktadır. Seans ücreti üzerinden
            belirlenen oran kadar ödeme yapılır.
          </p>
          <div className="rounded-lg border border-border bg-muted/30 px-5 py-4 flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Hakediş Yüzdesi</span>
            <span className="text-lg font-bold text-foreground tabular-nums">
              %{detail.earningPercentage ?? 0}
            </span>
          </div>
        </div>
      );
    }

    // per_session (default)
    if (detail.assignmentRows.length === 0) {
      return (
        <p className="text-sm text-muted-foreground">
          Bu öğretmene henüz bir eğitim türü atanmamış. Düzenle&apos;den eğitim türü ve hakediş tanımlayın.
        </p>
      );
    }

    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Bu öğretmenin atandığı eğitim türleri ve her biri için tanımlı sabit hakediş.
        </p>
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Eğitim Türü
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Durum
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Hakediş
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Seans
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Son Güncelleme
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {detail.assignmentRows.map((row: TeacherEducationAssignmentRow) => (
                <tr key={row.assignmentId} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: row.educationTypeColor }}
                        aria-hidden
                      />
                      <p className="font-medium text-foreground">{row.educationTypeName}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {row.assignmentStatus === "inactive" && (
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          Atama Pasif
                        </span>
                      )}
                      {row.educationTypeStatus === "inactive" && (
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          Eğitim Türü Pasif
                        </span>
                      )}
                      {row.assignmentStatus === "active" && row.educationTypeStatus === "active" && (
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                          Aktif
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-foreground">
                    {row.earningAmount === null ? (
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                        Hakediş ayarı eksik
                      </span>
                    ) : (
                      formatCurrency(row.earningAmount)
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {row.sessionCount}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-xs text-muted-foreground">
                    {formatDate(row.updatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
          <Pencil className="h-3.5 w-3.5 mr-1.5" />
          Atamaları Düzenle
        </Button>
      </div>
    );
  })();

  const tabs: TabItem[] = [
    { key: "general", label: "Genel Bilgiler", content: generalInfoContent },
    {
      key: "sessions",
      label: "Seanslar",
      badge: detail.sessions.length,
      content: sessionsContent,
    },
    {
      key: "students",
      label: "Öğrenciler",
      badge: detail.studentRows.length,
      content: studentsContent,
    },
    {
      key: "earnings",
      label: "Hakediş Kayıtları",
      badge: detail.earnings.length,
      content: earningsContent,
    },
    { key: "prices", label: "Eğitim Türleri ve Hakedişler", content: pricesContent },
    {
      key: "payments",
      label: "Ödeme Geçmişi",
      badge: store.teacherPayments.filter((p) => p.teacherId === teacherId).length,
      content: <TeacherPaymentHistoryTab teacherId={teacherId} />,
    },
    {
      key: "merges",
      label: "Birleştirme Geçmişi",
      badge: mergeHistoryCount,
      content: <TeacherMergeHistoryTab teacherId={teacherId} />,
    },
  ];

  return (
    <>
      <div className="space-y-6">
        {/* Back link */}
        <Link
          href="/app/teachers"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Öğretmenler
        </Link>

        {/* Archived-via-merge banner */}
        {rawTeacher?.status === "archived" && archivingMerge && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-sm text-slate-700">
              Bu kayıt{" "}
              <Link
                href={`/app/teachers/${archivingMerge.primaryTeacherId}`}
                className="font-medium underline underline-offset-2 hover:text-slate-900"
              >
                {archivingMerge.primaryTeacherName}
              </Link>{" "}
              ile birleştirildi — {formatDate(archivingMerge.mergedAt)}.
            </p>
            <Button size="sm" variant="outline" onClick={() => setMergeRollbackConfirmOpen(true)}>
              Birleştirmeyi Geri Al
            </Button>
          </div>
        )}

        {/* Header card */}
        <Card className="relative overflow-hidden rounded-2xl border-border/70 bg-gradient-to-br from-primary/[0.06] via-card to-card shadow-sm">
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/10 blur-3xl"
            aria-hidden
          />
          <CardContent className="relative p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 shrink-0 ring-4 ring-primary/10">
                  <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h1 className="text-xl font-bold text-foreground">{detail.fullName}</h1>
                    <StatusBadge status={detail.status} />
                    {detail.configurationStatus !== "inactive_teacher" && (
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                          detail.configurationStatus === "missing_pricing" ||
                            detail.configurationStatus === "no_assignment"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-emerald-100 text-emerald-700"
                        )}
                      >
                        {detail.configurationStatusLabel}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {detail.phone}
                    </span>
                    {detail.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {detail.email}
                      </span>
                    )}
                  </div>
                  {detail.educationTypeNames.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {detail.educationTypeNames.map((name) => (
                        <span
                          key={name}
                          className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  )}
                  <DetailHeaderMeta createdAt={detail.createdAt} updatedAt={detail.updatedAt} />
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {detail.unknownSessionCount > 0 && (
                  <Button size="sm" variant="outline" onClick={() => setRecalcOpen(true)}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    Eksik Hakedişleri Yeniden Hesapla
                  </Button>
                )}
                {detail.pendingEarnings > 0 && (
                  <Button size="sm" onClick={() => setPayOpen(true)}>
                    Ödeme Yap
                  </Button>
                )}
                {detail.status !== "archived" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditOpen(true)}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1.5" />
                    Düzenle
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI stat cards */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Toplam Seans"
            value={detail.totalSessions}
            description="Tüm zamanlar"
            icon={CalendarDays}
            variant="default"
          />
          <StatCard
            title="Tamamlanan Seans"
            value={detail.completedSessions}
            description="Kazanç yaratan"
            icon={CheckCircle2}
            variant="default"
          />
          <StatCard
            title="Bu Ayki Hakediş"
            value={formatCurrency(detail.monthlyEarnings)}
            description="Seçili takvim ayı"
            icon={TrendingUp}
            variant="success"
          />
          <StatCard
            title="Toplam Bekleyen Hakediş"
            value={formatCurrency(detail.pendingEarnings)}
            description={
              detail.unknownSessionCount > 0
                ? `Tüm dönemlerden ödenmemiş toplam · Hakediş ayarı bekleniyor — ${detail.unknownSessionCount} seans`
                : "Tüm dönemlerden ödenmemiş toplam"
            }
            icon={AlertCircle}
            variant={detail.pendingEarnings > 0 ? "warning" : "success"}
          />
        </div>

        {/* Tabs */}
        <Tabs tabs={tabs} defaultTab="general" />
      </div>

      {rawTeacher && (
        <TeacherFormDrawer
          open={editOpen}
          onOpenChange={setEditOpen}
          initialData={rawTeacher}
        />
      )}
      <TeacherPaymentFormDrawer
        open={payOpen}
        onOpenChange={setPayOpen}
        preselectedTeacherId={teacherId}
      />

      {/* Eksik Hakedişleri Yeniden Hesapla — preview before applying (requirement 5).
          Never touches sessions that already resolved; never creates a TeacherPayment. */}
      <Dialog open={recalcOpen} onOpenChange={closeRecalcDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Eksik Hakedişleri Yeniden Hesapla</DialogTitle>
            <DialogDescription>
              {recalcPreview.length > 0
                ? `${detail.fullName} için hakediş ayarı bekleyen ${recalcPreview.length} seans bulundu. Güncel öğretmen ücret ayarlarıyla yeniden hesaplanacak.`
                : `${detail.fullName} için hesaplanamamış seans kalmadı — tüm hakedişler zaten hesaplanmış.`}
            </DialogDescription>
          </DialogHeader>

          {recalcApplied ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {recalcAppliedCount > 0
                ? `${recalcAppliedCount} seansın hakedişi güncellendi.`
                : "Güncellenecek seans bulunamadı — hesaplanamamış seans kalmamıştı."}
            </div>
          ) : recalcPreview.length === 0 ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Bu öğretmen için hesaplanamamış seans kalmadı. Tekrar çalıştırmak güvenlidir; hiçbir kaydı değiştirmez.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-muted/40 p-3 text-center">
                  <p className="text-lg font-bold tabular-nums">{recalcPreview.length}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Yeniden Hesaplanacak</p>
                </div>
                <div className="rounded-lg bg-emerald-50 p-3 text-center">
                  <p className="text-lg font-bold tabular-nums text-emerald-700">{recalcResolvable.length}</p>
                  <p className="text-[10px] text-emerald-700 uppercase tracking-wide">Hesaplanabilir</p>
                </div>
                <div className="rounded-lg bg-amber-50 p-3 text-center">
                  <p className="text-lg font-bold tabular-nums text-amber-700">{recalcStillUnresolved.length}</p>
                  <p className="text-[10px] text-amber-700 uppercase tracking-wide">Ayarı Eksik</p>
                </div>
              </div>

              {recalcResolvable.length > 0 && (
                <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5 text-sm">
                  <span className="text-muted-foreground">Tahmini Hakediş Etkisi</span>
                  <span className="font-semibold tabular-nums text-emerald-600">
                    +{formatCurrency(recalcEstimatedImpact)}
                  </span>
                </div>
              )}

              {recalcStillUnresolved.length > 0 && (
                <p className="text-xs text-amber-700">
                  {recalcStillUnresolved.length} seans için maaş modeli/fiyat hâlâ tanımlanmadı — bu seanslar
                  &quot;Hakediş bekliyor&quot; olarak kalacak.
                </p>
              )}

              <div className="max-h-48 overflow-y-auto rounded-lg border border-border divide-y divide-border/60">
                {recalcPreview.map((r) => (
                  <div key={r.session.id} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{r.studentName}</p>
                      <p className="text-muted-foreground">
                        {formatDate(r.session.date)} · {r.educationTypeName}
                      </p>
                      {r.resolution.status !== "resolved" && (
                        <p className="text-amber-700 mt-0.5">{r.resolution.explanation}</p>
                      )}
                    </div>
                    {r.recalculatedEarning !== null ? (
                      <div className="text-right shrink-0">
                        <p className="text-muted-foreground line-through">
                          {formatCurrency(r.session.teacherEarning)}
                        </p>
                        <span className="font-semibold tabular-nums text-emerald-600">
                          {formatCurrency(r.recalculatedEarning)}
                        </span>
                      </div>
                    ) : (
                      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                        Ayar Eksik
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            {recalcApplied || recalcPreview.length === 0 ? (
              <Button size="sm" onClick={() => closeRecalcDialog(false)}>
                Kapat
              </Button>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={() => setRecalcOpen(false)}>
                  Vazgeç
                </Button>
                <Button size="sm" onClick={handleApplyRecalculation} disabled={recalcResolvable.length === 0}>
                  {recalcResolvable.length} Seansı Güncelle
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick rollback from the archived-record banner above — same action as
          the row-level "Geri Al" in the Birleştirme Geçmişi tab. */}
      <Dialog open={mergeRollbackConfirmOpen} onOpenChange={setMergeRollbackConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Birleştirmeyi Geri Al</DialogTitle>
            <DialogDescription>
              {archivingMerge && (
                <>
                  &quot;{detail.fullName}&quot; yeniden etkinleştirilecek ve {archivingMerge.moved.sessions} seans,{" "}
                  {archivingMerge.moved.teacherEarnings} hakediş, {archivingMerge.moved.teacherPayments} ödeme,{" "}
                  {archivingMerge.moved.teacherEducationTypeAssignments} eğitim türü ataması ve {archivingMerge.moved.weeklyPlans}{" "}
                  haftalık plan bu kayda geri taşınacak.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeRollbackConfirmOpen(false)}>
              Vazgeç
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (archivingMerge) store.rollbackTeacherMerge(archivingMerge.id);
                setMergeRollbackConfirmOpen(false);
              }}
            >
              Geri Al
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
