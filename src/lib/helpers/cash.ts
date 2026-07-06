import type {
  CashMovement,
  CashMovementType,
  CashCategory,
  CashMovementRow,
  DailyCashSummary,
  Payment,
  Student,
  Teacher,
  TeacherPayment,
} from "@/types";
import {
  getPaymentMethodLabel,
  getTeacherPaymentTypeLabel,
  isDeductionPaymentType,
} from "@/lib/helpers/finance";

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
 * Combines manual CashMovements, student Payment records, and TeacherPayment records
 * into a unified list of CashMovementRows. Student payments count as income with
 * category "guardian_payment"; teacher payments count as an expense with category
 * "salary" — Günlük Kasa always reflects a real cash/bank teacher payment as an outgoing
 * payment. Kesinti (deduction) payments are excluded entirely — a Kesinti is not a cash
 * transaction, so it never creates a Günlük Kasa row. Only manual movements are editable.
 */
export function buildCashMovementRows(
  movements: CashMovement[],
  payments: Payment[],
  students: Student[],
  teacherPayments: TeacherPayment[] = [],
  teachers: Teacher[] = []
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

  const teacherPaymentRows: CashMovementRow[] = teacherPayments
    .filter((p) => !isDeductionPaymentType(p.paymentType))
    .map((p) => {
      const teacher = teachers.find((t) => t.id === p.teacherId);
      return {
        id: `tpmt-${p.id}`,
        date: p.date,
        type: "expense" as const,
        typeLabel: "Gider",
        category: "salary" as const,
        categoryLabel: "Maaş",
        amount: p.amount,
        method: p.method,
        methodLabel: getPaymentMethodLabel(p.method),
        description:
          p.description ??
          (teacher ? `${teacher.fullName} hakediş ödemesi` : "Öğretmen ödemesi"),
        teacherId: p.teacherId,
        teacherName: teacher?.fullName,
        teacherPaymentId: p.id,
        teacherPaymentTypeLabel: getTeacherPaymentTypeLabel(p.paymentType),
        source: "teacher_payment" as const,
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

  return [...movementRows, ...paymentRows, ...teacherPaymentRows].sort(
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
 * = all income (manual incomes + student payments) minus all expenses
 * (manual expenses + teacher payments).
 */
export function calculateCashBalance(
  movements: CashMovement[],
  payments: Payment[],
  upToDate: string,
  teacherPayments: TeacherPayment[] = []
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

  // Kesinti (deduction) payments are excluded — they're not a cash outflow.
  const teacherExpense = teacherPayments
    .filter((p) => !isDeductionPaymentType(p.paymentType) && new Date(p.date) <= cutoff)
    .reduce((sum, p) => sum + p.amount, 0);

  return manualNet + paymentIncome - teacherExpense;
}

// ─── Daily summary ─────────────────────────────────────────────────────────────

export function buildDailyCashSummary(
  movements: CashMovement[],
  payments: Payment[],
  date: string,
  teacherPayments: TeacherPayment[] = []
): DailyCashSummary {
  const dayMovements = movements.filter((m) => m.date === date);
  const dayPayments = payments.filter((p) => p.date === date);
  // Kesinti (deduction) payments never appear in Günlük Kasa — not a cash transaction.
  const dayTeacherPayments = teacherPayments.filter(
    (p) => p.date === date && !isDeductionPaymentType(p.paymentType)
  );

  const totalIncome =
    dayMovements
      .filter((m) => m.type === "income")
      .reduce((s, m) => s + m.amount, 0) +
    dayPayments.reduce((s, p) => s + p.amount, 0);

  const totalExpense =
    dayMovements
      .filter((m) => m.type === "expense")
      .reduce((s, m) => s + m.amount, 0) +
    dayTeacherPayments.reduce((s, p) => s + p.amount, 0);

  // Opening balance: cumulative through day before
  const prevDay = new Date(date);
  prevDay.setDate(prevDay.getDate() - 1);
  const prevDateStr = prevDay.toISOString().split("T")[0]!;
  const openingBalance = calculateCashBalance(movements, payments, prevDateStr, teacherPayments);

  const netMovement = totalIncome - totalExpense;

  return {
    date,
    openingBalance,
    totalIncome,
    totalExpense,
    netMovement,
    closingBalance: openingBalance + netMovement,
    movementCount: dayMovements.length + dayPayments.length + dayTeacherPayments.length,
  };
}
