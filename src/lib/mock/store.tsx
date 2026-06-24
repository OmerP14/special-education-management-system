"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type {
  Student,
  Guardian,
  Teacher,
  Session,
  Payment,
  TeacherEarning,
  TeacherCustomPrice,
  InstallmentPlan,
  CashMovement,
} from "@/types";
import { mockStudents, mockGuardians } from "@/lib/mock/students";
import { mockTeachers } from "@/lib/mock/teachers";
import { mockSessions } from "@/lib/mock/sessions";
import { mockPayments } from "@/lib/mock/payments";
import { mockTeacherEarnings } from "@/lib/mock/teacher-earnings";
import { mockTeacherCustomPrices } from "@/lib/mock/teacher-custom-prices";
import { mockInstallmentPlans } from "@/lib/mock/installment-plans";
import { mockCashMovements } from "@/lib/mock/cash-movements";
import { buildInstallmentPayment } from "@/lib/helpers/installments";

// ─── Store shape ───────────────────────────────────────────────────────────────

interface MockStore {
  students: Student[];
  guardians: Guardian[];
  teachers: Teacher[];
  sessions: Session[];
  payments: Payment[];
  teacherEarnings: TeacherEarning[];
  teacherCustomPrices: TeacherCustomPrice[];
  installmentPlans: InstallmentPlan[];
  cashMovements: CashMovement[];

  addStudent: (s: Student) => void;
  updateStudent: (s: Student) => void;
  addGuardian: (g: Guardian) => void;
  updateGuardian: (g: Guardian) => void;
  addTeacher: (t: Teacher) => void;
  updateTeacher: (t: Teacher) => void;
  addSession: (s: Session) => void;
  updateSession: (s: Session) => void;
  addPayment: (p: Payment) => void;
  updatePayment: (p: Payment) => void;
  upsertTeacherCustomPricesForTeacher: (
    teacherId: string,
    tenantId: string,
    prices: { educationTypeId: string; amount: number }[]
  ) => void;
  addInstallmentPlan: (plan: InstallmentPlan) => void;
  updateInstallmentPlan: (plan: InstallmentPlan) => void;
  markInstallmentPaid: (planId: string, installmentId: string) => void;
  cancelInstallment: (planId: string, installmentId: string) => void;
  addCashMovement: (m: CashMovement) => void;
  updateCashMovement: (m: CashMovement) => void;
  deleteCashMovement: (id: string) => void;
}

// ─── Context ───────────────────────────────────────────────────────────────────

const MockStoreContext = createContext<MockStore | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function MockDataProvider({ children }: { children: ReactNode }) {
  const [students, setStudents] = useState<Student[]>(mockStudents);
  const [guardians, setGuardians] = useState<Guardian[]>(mockGuardians);
  const [teachers, setTeachers] = useState<Teacher[]>(mockTeachers);
  const [sessions, setSessions] = useState<Session[]>(mockSessions);
  const [payments, setPayments] = useState<Payment[]>(mockPayments);
  const [teacherEarnings] = useState<TeacherEarning[]>(mockTeacherEarnings);
  const [teacherCustomPrices, setTeacherCustomPrices] = useState<TeacherCustomPrice[]>(
    mockTeacherCustomPrices
  );
  const [installmentPlans, setInstallmentPlans] = useState<InstallmentPlan[]>(
    mockInstallmentPlans
  );
  const [cashMovements, setCashMovements] = useState<CashMovement[]>(mockCashMovements);

  const value: MockStore = {
    students,
    guardians,
    teachers,
    sessions,
    payments,
    teacherEarnings,
    teacherCustomPrices,
    installmentPlans,
    cashMovements,

    addStudent: (s) => setStudents((prev) => [...prev, s]),
    updateStudent: (s) =>
      setStudents((prev) => prev.map((x) => (x.id === s.id ? s : x))),

    addGuardian: (g) => setGuardians((prev) => [...prev, g]),
    updateGuardian: (g) =>
      setGuardians((prev) => prev.map((x) => (x.id === g.id ? g : x))),

    addTeacher: (t) => setTeachers((prev) => [...prev, t]),
    updateTeacher: (t) =>
      setTeachers((prev) => prev.map((x) => (x.id === t.id ? t : x))),

    addSession: (s) => setSessions((prev) => [...prev, s]),
    updateSession: (s) =>
      setSessions((prev) => prev.map((x) => (x.id === s.id ? s : x))),

    addPayment: (p) => setPayments((prev) => [...prev, p]),
    updatePayment: (p) =>
      setPayments((prev) => prev.map((x) => (x.id === p.id ? p : x))),

    upsertTeacherCustomPricesForTeacher: (teacherId, tenantId, prices) => {
      setTeacherCustomPrices((prev) => {
        const withoutTeacher = prev.filter((tcp) => tcp.teacherId !== teacherId);
        const newPrices = prices
          .filter((p) => p.amount > 0)
          .map((p, i) => ({
            id: `tcp-${teacherId}-${p.educationTypeId}-${Date.now()}-${i}`,
            tenantId,
            teacherId,
            educationTypeId: p.educationTypeId,
            customEarning: p.amount,
            createdAt: new Date().toISOString(),
          }));
        return [...withoutTeacher, ...newPrices];
      });
    },

    addInstallmentPlan: (plan) =>
      setInstallmentPlans((prev) => [...prev, plan]),

    updateInstallmentPlan: (plan) =>
      setInstallmentPlans((prev) => prev.map((x) => (x.id === plan.id ? plan : x))),

    markInstallmentPaid: (planId, installmentId) => {
      const today = new Date().toISOString().split("T")[0]!;

      // Find the plan and record from current state to build the payment
      const plan = installmentPlans.find((p) => p.id === planId);
      const record = plan?.installments.find((i) => i.id === installmentId);

      // Guard: only proceed if the installment exists and is not already paid
      if (!plan || !record || record.status === "paid") return;

      // 1. Mark the installment record as paid
      setInstallmentPlans((prev) =>
        prev.map((p) => {
          if (p.id !== planId) return p;
          return {
            ...p,
            installments: p.installments.map((inst) =>
              inst.id === installmentId
                ? { ...inst, status: "paid" as const, paidDate: today }
                : inst
            ),
          };
        })
      );

      // 2. Create a linked Payment record (idempotent: skip if one already exists)
      setPayments((prev) => {
        const alreadyExists = prev.some(
          (p) =>
            p.installmentPlanId === planId &&
            p.installmentNumber === record.installmentNumber
        );
        if (alreadyExists) return prev;
        return [...prev, buildInstallmentPayment(plan, record, today)];
      });
    },

    addCashMovement: (m) => setCashMovements((prev) => [...prev, m]),

    updateCashMovement: (m) =>
      setCashMovements((prev) => prev.map((x) => (x.id === m.id ? m : x))),

    deleteCashMovement: (id) =>
      setCashMovements((prev) => prev.filter((x) => x.id !== id)),

    cancelInstallment: (planId, installmentId) => {
      // Guard: never cancel a paid installment (payment already created)
      const plan = installmentPlans.find((p) => p.id === planId);
      const record = plan?.installments.find((i) => i.id === installmentId);
      if (!plan || !record || record.status === "paid") return;

      setInstallmentPlans((prev) =>
        prev.map((p) => {
          if (p.id !== planId) return p;
          return {
            ...p,
            installments: p.installments.map((inst) =>
              inst.id === installmentId
                ? { ...inst, status: "cancelled" as const }
                : inst
            ),
          };
        })
      );
    },
  };

  return (
    <MockStoreContext.Provider value={value}>
      {children}
    </MockStoreContext.Provider>
  );
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useMockStore(): MockStore {
  const ctx = useContext(MockStoreContext);
  if (!ctx) throw new Error("useMockStore must be used within MockDataProvider");
  return ctx;
}
