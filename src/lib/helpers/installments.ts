import type {
  InstallmentPlan,
  InstallmentRecord,
  InstallmentStatus,
  InstallmentInterval,
  InstallmentRow,
  StudentInstallmentSummary,
  PaymentMethod,
  Payment,
  Student,
  Guardian,
} from "@/types";
import { getPaymentMethodLabel } from "@/lib/helpers/finance";

// ─── Payment record builder ────────────────────────────────────────────────────

/**
 * Builds a Payment record that is automatically created when an installment is
 * marked as paid. The payment's `paymentSource` is set to "installment" so it
 * can be distinguished from manually entered payments.
 */
export function buildInstallmentPayment(
  plan: InstallmentPlan,
  record: InstallmentRecord,
  paidDate: string
): Payment {
  return {
    id: `payment-inst-${plan.id}-${record.id}`,
    tenantId: plan.tenantId,
    studentId: plan.studentId,
    amount: record.amount,
    method: plan.method,
    date: paidDate,
    paymentSource: "installment",
    installmentPlanId: plan.id,
    installmentNumber: record.installmentNumber,
    notes: `Taksit ödemesi - ${record.installmentNumber}/${plan.installmentCount}`,
    createdAt: new Date().toISOString(),
  };
}

// ─── Amount splitting ──────────────────────────────────────────────────────────

/** Splits a total into `count` installment amounts, spreading the remainder into the last installment. */
export function splitAmountIntoInstallments(total: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(total / count);
  const remainder = total % count;
  return Array.from({ length: count }, (_, i) =>
    i === count - 1 ? base + remainder : base
  );
}

// ─── Due date computation ──────────────────────────────────────────────────────

export function computeInstallmentDueDate(
  firstDueDate: string,
  offset: number,
  interval: InstallmentInterval,
  customIntervalDays: number
): string {
  const d = new Date(firstDueDate);
  if (interval === "monthly") {
    d.setMonth(d.getMonth() + offset);
  } else if (interval === "weekly") {
    d.setDate(d.getDate() + offset * 7);
  } else {
    d.setDate(d.getDate() + offset * customIntervalDays);
  }
  return d.toISOString().split("T")[0]!;
}

// ─── Record builder ────────────────────────────────────────────────────────────

export function buildInstallmentRecords(
  planId: string,
  totalAmount: number,
  count: number,
  firstDueDate: string,
  interval: InstallmentInterval,
  customIntervalDays: number = 30
): InstallmentRecord[] {
  const amounts = splitAmountIntoInstallments(totalAmount, count);
  return amounts.map((amount, i) => ({
    id: `${planId}-inst-${i + 1}-${Date.now()}`,
    installmentNumber: i + 1,
    dueDate: computeInstallmentDueDate(firstDueDate, i, interval, customIntervalDays),
    amount,
    status: "pending" as const,
  }));
}

// ─── Status derivation ─────────────────────────────────────────────────────────

/**
 * Derives the displayed status of an installment record.
 * Stored status can only be "pending" | "paid" | "cancelled".
 * "overdue" is computed when the record is pending AND past its due date.
 */
export function getInstallmentDisplayStatus(
  record: InstallmentRecord,
  today: Date
): InstallmentStatus {
  if (record.status === "paid" || record.status === "cancelled") return record.status;
  const due = new Date(record.dueDate);
  due.setHours(23, 59, 59, 999);
  return due < today ? "overdue" : "pending";
}

// ─── Student summary ───────────────────────────────────────────────────────────

export function buildStudentInstallmentSummary(
  studentId: string,
  plans: InstallmentPlan[],
  today: Date
): StudentInstallmentSummary | null {
  const studentPlans = plans.filter((p) => p.studentId === studentId);
  if (studentPlans.length === 0) return null;

  let totalPaid = 0;
  let totalPending = 0;
  let totalOverdue = 0;
  let overdueCount = 0;

  studentPlans.forEach((plan) => {
    plan.installments.forEach((inst) => {
      const display = getInstallmentDisplayStatus(inst, today);
      if (display === "paid") totalPaid += inst.amount;
      else if (display === "overdue") {
        totalOverdue += inst.amount;
        overdueCount++;
      } else if (display === "pending") {
        totalPending += inst.amount;
      }
    });
  });

  const activePlanCount = studentPlans.filter((p) =>
    p.installments.some((i) => i.status !== "paid" && i.status !== "cancelled")
  ).length;

  return {
    activePlanCount,
    totalPlanned: studentPlans.reduce((s, p) => s + p.totalAmount, 0),
    totalPaid,
    totalPending,
    totalOverdue,
    overdueCount,
  };
}

// ─── Guardian summary ──────────────────────────────────────────────────────────

export function buildGuardianInstallmentSummary(
  guardianStudentIds: string[],
  plans: InstallmentPlan[],
  today: Date
): { totalPending: number; totalOverdue: number; overdueCount: number; planCount: number } {
  const relevantPlans = plans.filter((p) => guardianStudentIds.includes(p.studentId));

  let totalPending = 0;
  let totalOverdue = 0;
  let overdueCount = 0;

  relevantPlans.forEach((plan) => {
    plan.installments.forEach((inst) => {
      const display = getInstallmentDisplayStatus(inst, today);
      if (display === "overdue") {
        totalOverdue += inst.amount;
        overdueCount++;
      } else if (display === "pending") {
        totalPending += inst.amount;
      }
    });
  });

  return { totalPending, totalOverdue, overdueCount, planCount: relevantPlans.length };
}

// ─── Overdue lookup ────────────────────────────────────────────────────────────

export function getOverdueInstallments(
  plans: InstallmentPlan[],
  today: Date
): (InstallmentRecord & { planId: string; studentId: string })[] {
  const result: (InstallmentRecord & { planId: string; studentId: string })[] = [];
  for (const plan of plans) {
    for (const inst of plan.installments) {
      if (getInstallmentDisplayStatus(inst, today) === "overdue") {
        result.push({ ...inst, planId: plan.id, studentId: plan.studentId });
      }
    }
  }
  return result;
}

// ─── Row builder ───────────────────────────────────────────────────────────────

export function buildInstallmentRows(
  plans: InstallmentPlan[],
  students: Student[],
  guardians: Guardian[],
  today: Date
): InstallmentRow[] {
  const rows: InstallmentRow[] = [];

  plans.forEach((plan) => {
    const student = students.find((s) => s.id === plan.studentId);
    const guardian = student
      ? (guardians.find((g) => student.guardianIds.includes(g.id)) ?? null)
      : null;

    plan.installments.forEach((inst) => {
      rows.push({
        planId: plan.id,
        studentId: plan.studentId,
        studentName: student?.fullName ?? "—",
        guardianId: guardian?.id ?? null,
        guardianName: guardian?.fullName ?? null,
        installmentId: inst.id,
        installmentNumber: inst.installmentNumber,
        totalInstallments: plan.installmentCount,
        dueDate: inst.dueDate,
        amount: inst.amount,
        totalPlanAmount: plan.totalAmount,
        displayStatus: getInstallmentDisplayStatus(inst, today),
        storedStatus: inst.status,
        paidDate: inst.paidDate,
        method: plan.method,
        methodLabel: getPaymentMethodLabel(plan.method),
        interval: plan.interval,
        notes: plan.notes,
      });
    });
  });

  return rows.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
}

// ─── Interval label ────────────────────────────────────────────────────────────

export function getIntervalLabel(interval: InstallmentInterval, customDays?: number): string {
  if (interval === "monthly") return "Aylık";
  if (interval === "weekly") return "Haftalık";
  return `Her ${customDays ?? 30} günde bir`;
}

// ─── Plan progress ─────────────────────────────────────────────────────────────

export function getPlanProgress(
  plan: InstallmentPlan,
  today: Date
): { paid: number; pending: number; overdue: number; cancelled: number } {
  let paid = 0;
  let pending = 0;
  let overdue = 0;
  let cancelled = 0;

  plan.installments.forEach((inst) => {
    const status = getInstallmentDisplayStatus(inst, today);
    if (status === "paid") paid++;
    else if (status === "overdue") overdue++;
    else if (status === "cancelled") cancelled++;
    else pending++;
  });

  return { paid, pending, overdue, cancelled };
}
