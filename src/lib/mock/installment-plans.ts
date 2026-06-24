import type { InstallmentPlan } from "@/types";

// Today = 2026-06-24. Plan-1 is healthy (2 paid, 1 upcoming).
// Plan-2's 2nd and 3rd installments are past their due dates → will show as overdue.
export const mockInstallmentPlans: InstallmentPlan[] = [
  {
    id: "iplan-1",
    tenantId: "tenant-1",
    studentId: "student-1",
    totalAmount: 1200,
    installmentCount: 3,
    firstDueDate: "2026-05-01",
    interval: "monthly",
    method: "bank_transfer",
    notes: "Mayıs–Temmuz 2026 dönemi taksit planı",
    installments: [
      {
        id: "iplan-1-1",
        installmentNumber: 1,
        dueDate: "2026-05-01",
        amount: 400,
        status: "paid",
        paidDate: "2026-05-03",
      },
      {
        id: "iplan-1-2",
        installmentNumber: 2,
        dueDate: "2026-06-01",
        amount: 400,
        status: "paid",
        paidDate: "2026-06-05",
      },
      {
        id: "iplan-1-3",
        installmentNumber: 3,
        dueDate: "2026-07-01",
        amount: 400,
        status: "pending",
      },
    ],
    createdAt: "2026-04-28T00:00:00Z",
  },
  {
    id: "iplan-2",
    tenantId: "tenant-1",
    studentId: "student-3",
    totalAmount: 900,
    installmentCount: 3,
    firstDueDate: "2026-04-15",
    interval: "monthly",
    method: "cash",
    notes: "Nisan–Haziran 2026 taksit planı",
    installments: [
      {
        id: "iplan-2-1",
        installmentNumber: 1,
        dueDate: "2026-04-15",
        amount: 300,
        status: "paid",
        paidDate: "2026-04-16",
      },
      {
        id: "iplan-2-2",
        installmentNumber: 2,
        dueDate: "2026-05-15",
        amount: 300,
        status: "pending", // past due → getInstallmentDisplayStatus returns "overdue"
      },
      {
        id: "iplan-2-3",
        installmentNumber: 3,
        dueDate: "2026-06-15",
        amount: 300,
        status: "pending", // past due → getInstallmentDisplayStatus returns "overdue"
      },
    ],
    createdAt: "2026-04-10T00:00:00Z",
  },
];
