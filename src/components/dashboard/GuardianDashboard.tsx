"use client";

import { useMemo, useState } from "react";
import { Wallet, AlertCircle, TrendingUp, Bell } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { UpcomingSessionsCard } from "@/components/dashboard/UpcomingSessionsCard";
import { RecentSessionsTable } from "@/components/dashboard/RecentSessionsTable";
import { useMockStore } from "@/lib/mock/store";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useUserScope } from "@/lib/auth/use-scope";
import { getScopedSessions, getScopedStudents } from "@/lib/auth/scope";
import { getStudentTotalBilled, getStudentTotalPaid, getStudentNetBalance, formatCurrency } from "@/lib/helpers/finance";
import { cn } from "@/lib/utils";

/** Guardian's own view — linked child(ren) only, with a switcher when more
 *  than one is linked. No institution-wide data anywhere on this page —
 *  every number here is computed from getScopedX (lib/auth/scope.ts)
 *  output, never the raw store arrays. */
export function GuardianDashboard() {
  const store = useMockStore();
  const { user } = useAuth();
  const scope = useUserScope();

  const linkedStudents = useMemo(
    () => getScopedStudents(store.students, store.sessions, scope),
    [store.students, store.sessions, scope]
  );
  const [selectedStudentId, setSelectedStudentId] = useState<string | "all">("all");

  const activeStudents = useMemo(
    () => (selectedStudentId === "all" ? linkedStudents : linkedStudents.filter((s) => s.id === selectedStudentId)),
    [linkedStudents, selectedStudentId]
  );
  const activeStudentIds = useMemo(() => new Set(activeStudents.map((s) => s.id)), [activeStudents]);

  const scopedSessions = useMemo(
    () => getScopedSessions(store.sessions, scope).filter((s) => activeStudentIds.has(s.studentId)),
    [store.sessions, scope, activeStudentIds]
  );

  const totalBilled = useMemo(
    () => activeStudents.reduce((sum, s) => sum + getStudentTotalBilled(s.id, store.sessions), 0),
    [activeStudents, store.sessions]
  );
  const totalPaid = useMemo(
    () => activeStudents.reduce((sum, s) => sum + getStudentTotalPaid(s.id, store.payments), 0),
    [activeStudents, store.payments]
  );
  const netBalance = useMemo(
    () =>
      activeStudents.reduce(
        (sum, s) => sum + getStudentNetBalance(s.id, store.sessions, store.payments, store.openingBalances),
        0
      ),
    [activeStudents, store.sessions, store.payments, store.openingBalances]
  );

  const recentSessions = useMemo(
    () => [...scopedSessions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8),
    [scopedSessions]
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Panel" description={`Hoş geldiniz, ${user?.name ?? ""} — çocuğunuzun seans ve ödeme özeti.`} />

      {linkedStudents.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/20 py-16 text-center">
          <p className="text-sm text-muted-foreground">Hesabınıza bağlı bir öğrenci kaydı bulunamadı.</p>
        </div>
      ) : (
        <>
          {linkedStudents.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setSelectedStudentId("all")}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors border",
                  selectedStudentId === "all"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                )}
              >
                Tümü
              </button>
              {linkedStudents.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedStudentId(s.id)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors border",
                    selectedStudentId === s.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                  )}
                >
                  {s.fullName}
                </button>
              ))}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard title="Toplam Tutar" value={formatCurrency(totalBilled)} icon={TrendingUp} description="Tahakkuk eden" />
            <StatCard title="Ödenen" value={formatCurrency(totalPaid)} icon={Wallet} variant="success" description="Tahsil edilen" />
            <StatCard
              title="Kalan Bakiye"
              value={formatCurrency(netBalance)}
              icon={AlertCircle}
              variant={netBalance > 0 ? "danger" : "success"}
              description={netBalance > 0 ? "Ödenmemiş tutar" : "Borç yok"}
            />
          </div>

          <UpcomingSessionsCard sessions={scopedSessions} students={activeStudents} teachers={store.teachers} />

          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Son Seanslar</h2>
            <RecentSessionsTable
              sessions={recentSessions}
              students={activeStudents}
              teachers={store.teachers}
              educationTypes={store.educationTypes}
            />
          </div>
        </>
      )}

      <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        <Bell className="h-4 w-4 shrink-0" />
        Bildirimleriniz için sağ üstteki zil simgesini kullanabilirsiniz.
      </div>
    </div>
  );
}
