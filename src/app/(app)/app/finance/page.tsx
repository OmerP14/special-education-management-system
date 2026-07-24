"use client";

import Link from "next/link";
import { TrendingUp, Wallet, AlertCircle, Banknote, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { CashFlowChart } from "@/components/dashboard/CashFlowChart";
import { PaymentSummaryCard } from "@/components/dashboard/PaymentSummaryCard";
import { TeacherEarningsCard } from "@/components/dashboard/TeacherEarningsCard";
import { useMockStore } from "@/lib/mock/store";
import { buildDashboardStats, formatCurrency } from "@/lib/helpers/finance";
import { CURRENT_USER, canViewFinance } from "@/lib/permissions";

export default function FinancePage() {
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
    store.teacherEducationTypeAssignments
  );

  // The nav link is already hidden for this role (see AppSidebar), but a
  // direct URL visit should still respect the same boundary rather than
  // silently render financial figures to a role that shouldn't see them.
  if (!canViewFinance(CURRENT_USER.role)) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 py-24 text-center">
        <div className="rounded-full bg-muted p-3">
          <ShieldAlert className="h-6 w-6 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Bu sayfaya erişim yetkiniz yok</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Finansal Panel yalnızca yönetici hesapları içindir.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finansal Panel"
        description="Kurumunuzun finansal kontrol merkezi — ciro, tahsilat, alacaklar ve ödenecekler tek yerde."
      />

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            description="Tahsil edilmemiş — alacaklar"
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
                ? `Ödenmemiş kazanç — ${stats.unknownEarningSessionCount} seans bekliyor`
                : "Ödenmemiş kazanç — ödenecekler"
            }
            className="transition-colors hover:border-primary/40"
          />
        </Link>
      </div>

      {/* Cash flow trend */}
      <CashFlowChart sessions={store.sessions} payments={store.payments} monthsBack={6} />

      {/* Receivables (from students) + Payables (to teachers) */}
      <div className="grid gap-4 lg:grid-cols-2">
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
          teacherEducationTypeAssignments={store.teacherEducationTypeAssignments}
        />
      </div>

      <p className="text-xs text-muted-foreground">{currentMonthLabel} verileri gösteriliyor.</p>
    </div>
  );
}
