"use client";

import {
  Users,
  GraduationCap,
  CalendarDays,
  TrendingUp,
  AlertCircle,
  Banknote,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { RecentSessionsTable } from "@/components/dashboard/RecentSessionsTable";
import { PaymentSummaryCard } from "@/components/dashboard/PaymentSummaryCard";
import { TeacherEarningsCard } from "@/components/dashboard/TeacherEarningsCard";
import { SessionStatusBreakdown } from "@/components/dashboard/SessionStatusBreakdown";
import { useMockStore } from "@/lib/mock/store";
import { buildDashboardStats, formatCurrency } from "@/lib/helpers/finance";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function DashboardPage() {
  const store = useMockStore();

  const currentMonthLabel = new Intl.DateTimeFormat("tr-TR", {
    month: "long",
    year: "numeric",
  }).format(new Date());

  const stats = buildDashboardStats(
    store.sessions,
    store.payments,
    store.teacherPayments,
    store.students,
    store.teachers,
    store.openingBalances,
    store.teacherCustomPrices
  );

  const recentSessions = [...store.sessions]
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

      {/* KPI Cards — Ciro (accrual) and Tahsilat (cash collected) are deliberately
          separate cards; a payment-only month must move Tahsilat without touching Ciro. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <StatCard
          title="Aktif Öğrenci"
          value={stats.activeStudents}
          icon={Users}
          variant="default"
          description="Kayıtlı aktif öğrenci"
        />
        <StatCard
          title="Aktif Öğretmen"
          value={stats.activeTeachers}
          icon={GraduationCap}
          variant="default"
          description="Çalışan öğretmen"
        />
        <Link href="/app/sessions" className="block">
          <StatCard
            title="Bu Ayki Seans"
            value={stats.sessionsThisMonth}
            icon={CalendarDays}
            variant="default"
            description={currentMonthLabel}
            className="transition-colors hover:border-primary/40"
          />
        </Link>
        <Link href="/app/reports" className="block">
          <StatCard
            title="Bu Ayki Ciro"
            value={formatCurrency(stats.revenueThisMonth)}
            icon={TrendingUp}
            variant="success"
            description="Tahakkuk — tamamlanan seanslar"
            className="transition-colors hover:border-primary/40"
          />
        </Link>
        <Link href="/app/payments" className="block">
          <StatCard
            title="Bu Ay Tahsilat"
            value={formatCurrency(stats.collectedThisMonth)}
            icon={Wallet}
            variant="success"
            description="Alınan ödeme"
            className="transition-colors hover:border-primary/40"
          />
        </Link>
        <Link href="/app/payments" className="block">
          <StatCard
            title="Bekleyen Borç"
            value={formatCurrency(stats.pendingPayments)}
            icon={AlertCircle}
            variant="danger"
            description="Tahsil edilmemiş"
            className="transition-colors hover:border-primary/40"
          />
        </Link>
        <Link href="/app/teacher-earnings" className="block">
          <StatCard
            title="Öğretmen Borcu"
            value={formatCurrency(stats.pendingEarnings)}
            icon={Banknote}
            variant="warning"
            description={
              stats.unknownEarningSessionCount > 0
                ? `Ödenmemiş kazanç · Hakediş ayarı bekleniyor — ${stats.unknownEarningSessionCount} seans`
                : "Ödenmemiş kazanç"
            }
            className="transition-colors hover:border-primary/40"
          />
        </Link>
      </div>

      {/* Middle row: Payment + Earning + Status */}
      <div className="grid gap-4 lg:grid-cols-3">
        <PaymentSummaryCard
          sessions={store.sessions}
          payments={store.payments}
          students={store.students}
          openingBalances={store.openingBalances}
        />
        <TeacherEarningsCard
          teacherPayments={store.teacherPayments}
          teachers={store.teachers}
          sessions={store.sessions}
          teacherCustomPrices={store.teacherCustomPrices}
        />
        <SessionStatusBreakdown sessions={store.sessions} />
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
        <RecentSessionsTable
          sessions={recentSessions}
          students={store.students}
          teachers={store.teachers}
        />
      </div>
    </div>
  );
}
