import type { InstallmentPlan } from "@/types";

// ─── 1 Installment Plan ────────────────────────────────────────────────────────
//
// Plan for Ahmet Koç (student-3).  Today = 2026-06-24.
//   Installment 1 – Apr 15 – PAID (matching payment-7 in mockPayments)
//   Installment 2 – May 15 – PENDING → past due → displayed as OVERDUE
//   Installment 3 – Jul 15 – PENDING → future → displayed as PENDING
//
// This gives a single plan that demonstrates all three visible states
// (paid / overdue / upcoming) without requiring two separate plans.
//
export const mockInstallmentPlans: InstallmentPlan[] = [
  {
    id: "iplan-1",
    tenantId: "tenant-1",
    studentId: "student-3",
    totalAmount: 900,
    installmentCount: 3,
    firstDueDate: "2026-04-15",
    interval: "monthly",
    method: "cash",
    notes: "Nisan–Temmuz 2026 taksit planı",
    installments: [
      {
        id: "iplan-1-1",
        installmentNumber: 1,
        dueDate: "2026-04-15",
        amount: 300,
        status: "paid",
        paidDate: "2026-04-16",
      },
      {
        id: "iplan-1-2",
        installmentNumber: 2,
        dueDate: "2026-05-15",
        amount: 300,
        status: "pending", // past due → getInstallmentDisplayStatus returns "overdue"
      },
      {
        id: "iplan-1-3",
        installmentNumber: 3,
        dueDate: "2026-07-15",
        amount: 300,
        status: "pending", // future due date → displayed as "pending"
      },
    ],
    createdAt: "2026-04-10T00:00:00Z",
  },
];
