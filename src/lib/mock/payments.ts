import type { Payment } from "@/types";

// ─── 7 Payments ────────────────────────────────────────────────────────────────
//
// Remaining debt per student after these payments:
//   student-1  Yusuf  : billed 1 250 – paid 1 200  =    50 ₺  (nearly clear)
//   student-2  Elif   : billed 1 600 – paid 1 200  =   400 ₺
//   student-3  Ahmet  : billed 1 150 – paid   800  =   350 ₺
//                       (payment-7 is the installment-plan first payment)
//   student-4  Selin  : billed 1 000 – paid   500  =   500 ₺
//   student-5  Nisa   : billed   450 – paid     0  =   450 ₺  (on_hold)
//
export const mockPayments: Payment[] = [
  {
    id: "payment-1",
    tenantId: "tenant-1",
    studentId: "student-1",
    amount: 1000,
    method: "bank_transfer",
    date: "2026-06-01T00:00:00Z",
    notes: "Haziran ayı ödemesi",
    createdAt: "2026-06-01T00:00:00Z",
  },
  {
    id: "payment-2",
    tenantId: "tenant-1",
    studentId: "student-2",
    amount: 800,
    method: "cash",
    date: "2026-06-05T00:00:00Z",
    createdAt: "2026-06-05T00:00:00Z",
  },
  {
    id: "payment-3",
    tenantId: "tenant-1",
    studentId: "student-3",
    amount: 500,
    method: "credit_card",
    date: "2026-06-10T00:00:00Z",
    createdAt: "2026-06-10T00:00:00Z",
  },
  {
    id: "payment-4",
    tenantId: "tenant-1",
    studentId: "student-4",
    amount: 500,
    method: "cash",
    date: "2026-06-15T00:00:00Z",
    createdAt: "2026-06-15T00:00:00Z",
  },
  {
    id: "payment-5",
    tenantId: "tenant-1",
    studentId: "student-2",
    amount: 400,
    method: "bank_transfer",
    date: "2026-05-20T00:00:00Z",
    createdAt: "2026-05-20T00:00:00Z",
  },
  {
    id: "payment-6",
    tenantId: "tenant-1",
    studentId: "student-1",
    amount: 200,
    method: "bank_transfer",
    date: "2026-05-05T00:00:00Z",
    notes: "Mayıs ayı ödemesi",
    createdAt: "2026-05-05T00:00:00Z",
  },
  // payment-7 is the paid installment from iplan-1 (Ahmet Koç, 1. taksit)
  {
    id: "payment-7",
    tenantId: "tenant-1",
    studentId: "student-3",
    amount: 300,
    method: "cash",
    date: "2026-04-16T00:00:00Z",
    paymentSource: "installment",
    installmentPlanId: "iplan-1",
    installmentNumber: 1,
    notes: "1. taksit ödemesi",
    createdAt: "2026-04-16T00:00:00Z",
  },
];
