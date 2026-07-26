"use client";

import { useMemo } from "react";
import { CalendarDays, CheckCircle2, Users, Banknote } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { TodaysScheduleCard } from "@/components/dashboard/TodaysScheduleCard";
import { UpcomingSessionsCard } from "@/components/dashboard/UpcomingSessionsCard";
import { RecentSessionsTable } from "@/components/dashboard/RecentSessionsTable";
import { useMockStore } from "@/lib/mock/store";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useUserScope } from "@/lib/auth/use-scope";
import { getScopedSessions, getScopedStudents } from "@/lib/auth/scope";
import { getTeacherEarningTotals, formatCurrency } from "@/lib/helpers/finance";

function getWeekRange(date: Date): { start: Date; end: Date } {
  const day = date.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(date);
  start.setDate(date.getDate() + diffToMonday);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/** Teacher's own view — no institution ciro/tahsilat/receivables, no other
 *  teacher's sessions/earnings. Every list here is fed already-scoped data
 *  (see lib/auth/scope.ts), not styled differently from the owner
 *  dashboard's cards, just narrower data underneath. */
export function TeacherDashboard() {
  const store = useMockStore();
  const { user, hasPermission } = useAuth();
  const scope = useUserScope();

  const teacher = store.teachers.find((t) => t.id === scope.teacherId);
  const scopedSessions = useMemo(() => getScopedSessions(store.sessions, scope), [store.sessions, scope]);
  const scopedStudents = useMemo(
    () => getScopedStudents(store.students, store.sessions, scope),
    [store.students, store.sessions, scope]
  );
  const scopedTeachers = useMemo(() => (teacher ? [teacher] : []), [teacher]);

  const today = useMemo(() => new Date(), []);
  const todaysSessions = useMemo(
    () =>
      scopedSessions.filter((s) => {
        const d = new Date(s.date);
        return (
          d.getFullYear() === today.getFullYear() &&
          d.getMonth() === today.getMonth() &&
          d.getDate() === today.getDate()
        );
      }),
    [scopedSessions, today]
  );
  const todaysCompleted = todaysSessions.filter((s) => s.status === "completed").length;

  const { start: weekStart, end: weekEnd } = useMemo(() => getWeekRange(today), [today]);
  const thisWeekSessions = useMemo(
    () => scopedSessions.filter((s) => { const d = new Date(s.date); return d >= weekStart && d <= weekEnd; }),
    [scopedSessions, weekStart, weekEnd]
  );

  const canViewEarnings = hasPermission("teachers.view_earnings");
  const earnings =
    teacher && canViewEarnings
      ? getTeacherEarningTotals(teacher, store.sessions, store.teacherPayments, store.teacherEducationTypeAssignments)
      : null;

  const recentSessions = useMemo(
    () => [...scopedSessions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8),
    [scopedSessions]
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Panel" description={`Hoş geldiniz, ${user?.name ?? ""} — bugünkü ve yaklaşan programınız.`} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Bugünkü Seans" value={todaysSessions.length} icon={CalendarDays} description="Size ait" />
        <StatCard
          title="Bugünkü Tamamlanma"
          value={todaysSessions.length > 0 ? `%${Math.round((todaysCompleted / todaysSessions.length) * 100)}` : "—"}
          icon={CheckCircle2}
          variant="success"
          description={`${todaysCompleted}/${todaysSessions.length || 0} seans`}
        />
        <StatCard title="Bu Hafta Seans" value={thisWeekSessions.length} icon={Users} description="Haftalık iş yükü" />
        {earnings && (
          <StatCard
            title="Bekleyen Hakediş"
            value={formatCurrency(earnings.pendingEarning)}
            icon={Banknote}
            variant="warning"
            description="Ödenmemiş kazanç"
          />
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <TodaysScheduleCard sessions={scopedSessions} students={scopedStudents} teachers={scopedTeachers} />
        <UpcomingSessionsCard sessions={scopedSessions} students={scopedStudents} teachers={scopedTeachers} />
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Son Seanslarım</h2>
        <RecentSessionsTable
          sessions={recentSessions}
          students={scopedStudents}
          teachers={scopedTeachers}
          educationTypes={store.educationTypes}
        />
      </div>
    </div>
  );
}
