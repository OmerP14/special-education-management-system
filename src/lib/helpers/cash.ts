import type {
  CashMovement,
  CashMovementType,
  CashCategory,
  CashMovementRow,
  DailyCashSummary,
  Payment,
  Student,
} from "@/types";
import { getPaymentMethodLabel } from "@/lib/helpers/finance";

// ─── Label helpers ─────────────────────────────────────────────────────────────

export function getCashMovementTypeLabel(type: CashMovementType): string {
  return type === "income" ? "Gelir" : "Gider";
}

export function getCashCategoryLabel(category: CashCategory): string {
  const map: Record<CashCategory, string> = {
    guardian_payment: "Veli Ödemesi",
    loan_received: "Borç Alındı",
    rent: "Kira",
    salary: "Maaş",
    grocery: "Market",
    stationery: "Kırtasiye",
    utility: "Fatura",
    other: "Diğer",
  };
  return map[category];
}

// ─── Row builder ───────────────────────────────────────────────────────────────

/**
 * Combines manual CashMovements with student Payment records into a unified
 * list of CashMovementRows. Student payments count as income with category
 * "guardian_payment". Only manual movements are editable.
 */
export function buildCashMovementRows(
  movements: CashMovement[],
  payments: Payment[],
  students: Student[]
): CashMovementRow[] {
  const paymentRows: CashMovementRow[] = payments.map((p) => {
    const student = students.find((s) => s.id === p.studentId);
    return {
      id: `pmt-${p.id}`,
      date: p.date,
      type: "income" as const,
      typeLabel: "Gelir",
      category: "guardian_payment" as const,
      categoryLabel: "Veli Ödemesi",
      amount: p.amount,
      method: p.method,
      methodLabel: getPaymentMethodLabel(p.method),
      description:
        p.notes ??
        (student ? `${student.fullName} ödemesi` : "Öğrenci ödemesi"),
      studentId: p.studentId,
      studentName: student?.fullName,
      paymentId: p.id,
      source: "payment" as const,
      isEditable: false,
    };
  });

  const movementRows: CashMovementRow[] = movements.map((m) => {
    const student = m.studentId
      ? students.find((s) => s.id === m.studentId)
      : undefined;
    return {
      id: m.id,
      date: m.date,
      type: m.type,
      typeLabel: getCashMovementTypeLabel(m.type),
      category: m.category,
      categoryLabel: getCashCategoryLabel(m.category),
      amount: m.amount,
      method: m.method,
      methodLabel: getPaymentMethodLabel(m.method),
      description: m.description,
      studentId: m.studentId,
      studentName: student?.fullName,
      paymentId: undefined,
      source: "manual" as const,
      isEditable: true,
    };
  });

  return [...movementRows, ...paymentRows].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

// ─── Date filter ───────────────────────────────────────────────────────────────

export function getCashMovementsForDate(
  movements: CashMovement[],
  date: string
): CashMovement[] {
  return movements.filter((m) => m.date === date);
}

// ─── Running balance ───────────────────────────────────────────────────────────

/**
 * Cumulative cash position through `upToDate` (inclusive, YYYY-MM-DD).
 * = all income (manual incomes + student payments) minus all manual expenses.
 */
export function calculateCashBalance(
  movements: CashMovement[],
  payments: Payment[],
  upToDate: string
): number {
  const cutoff = new Date(upToDate);
  cutoff.setHours(23, 59, 59, 999);

  const manualNet = movements
    .filter((m) => new Date(m.date) <= cutoff)
    .reduce(
      (sum, m) => (m.type === "income" ? sum + m.amount : sum - m.amount),
      0
    );

  const paymentIncome = payments
    .filter((p) => new Date(p.date) <= cutoff)
    .reduce((sum, p) => sum + p.amount, 0);

  return manualNet + paymentIncome;
}

// ─── Daily summary ─────────────────────────────────────────────────────────────

export function buildDailyCashSummary(
  movements: CashMovement[],
  payments: Payment[],
  date: string
): DailyCashSummary {
  const dayMovements = movements.filter((m) => m.date === date);
  const dayPayments = payments.filter((p) => p.date === date);

  const totalIncome =
    dayMovements
      .filter((m) => m.type === "income")
      .reduce((s, m) => s + m.amount, 0) +
    dayPayments.reduce((s, p) => s + p.amount, 0);

  const totalExpense = dayMovements
    .filter((m) => m.type === "expense")
    .reduce((s, m) => s + m.amount, 0);

  // Opening balance: cumulative through day before
  const prevDay = new Date(date);
  prevDay.setDate(prevDay.getDate() - 1);
  const prevDateStr = prevDay.toISOString().split("T")[0]!;
  const openingBalance = calculateCashBalance(movements, payments, prevDateStr);

  const netMovement = totalIncome - totalExpense;

  return {
    date,
    openingBalance,
    totalIncome,
    totalExpense,
    netMovement,
    closingBalance: openingBalance + netMovement,
    movementCount: dayMovements.length + dayPayments.length,
  };
}
