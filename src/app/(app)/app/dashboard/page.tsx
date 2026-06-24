"use client";

import {
  Users,
  GraduationCap,
  CalendarDays,
  TrendingUp,
  AlertCircle,
  Banknote,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { RecentSessionsTable } from "@/components/dashboard/RecentSessionsTable";
import { PaymentSummaryCard } from "@/components/dashboard/PaymentSummaryCard";
import { TeacherEarningsCard } from "@/components/dashboard/TeacherEarningsCard";
import { SessionStatusBreakdown } from "@/components/dashboard/SessionStatusBreakdown";
import { mockSessions } from "@/lib/mock/sessions";
import { mockPayments } from "@/lib/mock/payments";
import { mockTeacherEarnings } from "@/lib/mock/teacher-earnings";
import { buildDashboardStats, formatCurrency } from "@/lib/helpers/finance";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function DashboardPage() {
  const stats = buildDashboardStats(mockSessions, mockPayments, mockTeacherEarnings);

  const recentSessions = [...mockSessions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Genel Bakış"
        description="Kurumunuzun güncel durumunu buradan takip edebilirsiniz."
        actions={
          <Link href="/app/sessions">
            <Button size="sm">Seans Ekle</Button>
          </Link>
        }
      />

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          title="Aktif Öğrenci"
          value={stats.activeStudents}
          icon={Users}
          variant="default"
          description="Kayıtlı aktif öğrenci"
          className="xl:col-span-1"
        />
        <StatCard
          title="Aktif Öğretmen"
          value={stats.activeTeachers}
          icon={GraduationCap}
          variant="default"
          description="Çalışan öğretmen"
          className="xl:col-span-1"
        />
        <StatCard
          title="Bu Ayki Seans"
          value={stats.sessionsThisMonth}
          icon={CalendarDays}
          variant="default"
          description="Haziran 2026"
          className="xl:col-span-1"
        />
        <StatCard
          title="Bu Ayki Ciro"
          value={formatCurrency(stats.revenueThisMonth)}
          icon={TrendingUp}
          variant="success"
          description="Tamamlanan seanslar"
          className="xl:col-span-1"
        />
        <StatCard
          title="Bekleyen Borç"
          value={formatCurrency(stats.pendingPayments)}
          icon={AlertCircle}
          variant="danger"
          description="Tahsil edilmemiş"
          className="xl:col-span-1"
        />
        <StatCard
          title="Öğretmen Borcu"
          value={formatCurrency(stats.pendingEarnings)}
          icon={Banknote}
          variant="warning"
          description="Ödenmemiş kazanç"
          className="xl:col-span-1"
        />
      </div>

      {/* Middle row: Payment + Earning + Status */}
      <div className="grid gap-4 lg:grid-cols-3">
        <PaymentSummaryCard sessions={mockSessions} payments={mockPayments} />
        <TeacherEarningsCard earnings={mockTeacherEarnings} />
        <SessionStatusBreakdown sessions={mockSessions} />
      </div>

      {/* Recent Sessions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Son Seanslar</h2>
          <Link href="/app/sessions">
            <Button variant="ghost" size="sm" className="text-xs">
              Tümünü Gör →
            </Button>
          </Link>
        </div>
        <RecentSessionsTable sessions={recentSessions} />
      </div>
    </div>
  );
}
