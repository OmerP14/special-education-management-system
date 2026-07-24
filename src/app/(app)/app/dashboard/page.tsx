"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Users, GraduationCap, CalendarDays, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { RecentSessionsTable } from "@/components/dashboard/RecentSessionsTable";
import { SessionStatusBreakdown } from "@/components/dashboard/SessionStatusBreakdown";
import { TodaysScheduleCard } from "@/components/dashboard/TodaysScheduleCard";
import { UpcomingSessionsCard } from "@/components/dashboard/UpcomingSessionsCard";
import { TodaysTeachersCard } from "@/components/dashboard/TodaysTeachersCard";
import { CalendarPreviewCard } from "@/components/dashboard/CalendarPreviewCard";
import { useMockStore } from "@/lib/mock/store";

// This is the operational, everyone-sees-it dashboard — no revenue, payments,
// or earnings figures here. Those moved to /app/finance (owner/admin only,
// see lib/permissions.ts). Only presentation/layout changed: every widget
// below reads the same store data through the same existing helpers.
export default function DashboardPage() {
  const store = useMockStore();

  const today = useMemo(() => new Date(), []);

  const activeStudents = store.students.filter((s) => s.status === "active").length;
  const activeTeachers = store.teachers.filter((t) => t.status === "active").length;

  const todaysSessions = useMemo(
    () =>
      store.sessions.filter((s) => {
        const d = new Date(s.date);
        return (
          d.getFullYear() === today.getFullYear() &&
          d.getMonth() === today.getMonth() &&
          d.getDate() === today.getDate()
        );
      }),
    [store.sessions, today]
  );
  const todaysCompleted = todaysSessions.filter((s) => s.status === "completed").length;
  const completionRate =
    todaysSessions.length > 0 ? Math.round((todaysCompleted / todaysSessions.length) * 100) : 0;

  const recentSessions = [...store.sessions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Genel Bakış"
        description="Kurumunuzun günlük operasyonel durumu."
      />

      <DashboardHero />

      {/* Quick operational stats — deliberately no money here; see /app/finance */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/app/students" className="block">
          <StatCard
            title="Aktif Öğrenci"
            value={activeStudents}
            icon={Users}
            variant="default"
            description="Kayıtlı aktif öğrenci"
            className="transition-colors hover:border-primary/40"
          />
        </Link>
        <Link href="/app/teachers" className="block">
          <StatCard
            title="Aktif Öğretmen"
            value={activeTeachers}
            icon={GraduationCap}
            variant="default"
            description="Çalışan öğretmen"
            className="transition-colors hover:border-primary/40"
          />
        </Link>
        <Link href="/app/calendar" className="block">
          <StatCard
            title="Bugünkü Seans"
            value={todaysSessions.length}
            icon={CalendarDays}
            variant="default"
            description="Bugün planlanmış"
            className="transition-colors hover:border-primary/40"
          />
        </Link>
        <StatCard
          title="Bugünkü Tamamlanma"
          value={todaysSessions.length > 0 ? `%${completionRate}` : "—"}
          icon={CheckCircle2}
          variant="success"
          description={`${todaysCompleted}/${todaysSessions.length || 0} seans`}
        />
      </div>

      {/* Today's schedule + session distribution */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TodaysScheduleCard
            sessions={store.sessions}
            students={store.students}
            teachers={store.teachers}
          />
        </div>
        <SessionStatusBreakdown sessions={store.sessions} />
      </div>

      {/* Upcoming + today's teachers + calendar preview */}
      <div className="grid gap-4 lg:grid-cols-3">
        <UpcomingSessionsCard
          sessions={store.sessions}
          students={store.students}
          teachers={store.teachers}
        />
        <TodaysTeachersCard sessions={store.sessions} teachers={store.teachers} />
        <CalendarPreviewCard
          sessions={store.sessions}
          students={store.students}
          teachers={store.teachers}
          educationTypes={store.educationTypes}
        />
      </div>

      {/* Recent Activity */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Son Aktiviteler</h2>
          <Link href="/app/sessions" className="text-xs font-medium text-primary hover:underline">
            Tümünü Gör →
          </Link>
        </div>
        <RecentSessionsTable
          sessions={recentSessions}
          students={store.students}
          teachers={store.teachers}
          educationTypes={store.educationTypes}
        />
      </div>
    </div>
  );
}
