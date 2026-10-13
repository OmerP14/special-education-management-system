// ─── Devir date (Excel Import) ───────────────────────────────────────────────
//
// One rule for bringing old records in: everything dated before the devir
// date is history only — sessions bill and earn nothing, payments count
// nowhere — and each student's and teacher's balance at that date enters as a
// single devir amount. From the devir date on, the system keeps the books.
//
// A student's devir comes from the file's own devir rows (a "Devir Bakiyesi"
// sheet) when it has them; otherwise it is the file's lessons minus its
// payments. A file with lessons but no payments at all can't say what is
// still owed, so the suggestion is 0 and the user fills it in. Teachers: the
// file's earnings minus what was paid to them; salaried teachers' earnings
// can't be derived from lessons, so theirs starts at 0 for the user to fill.

import type { OpeningBalance, Session, Student, Teacher } from "@/types";
import type { TeacherEarningsSettings } from "@/types/settings";
import { newId, type StagedRow } from "@/lib/helpers/import";
import { computeEarningFactor, isChargeableStatus } from "@/lib/helpers/finance";

/** "YYYY-MM-DD" of a stored date ("YYYY-MM-DD" or an ISO date-time). */
export function dayKeyOf(date: string): string {
  if (!date.includes("T")) return date.slice(0, 10);
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const isCommitted = (row: StagedRow) =>
  row.preview.include && (row.preview.status === "valid" || row.preview.status === "warning");

/** Marks every staged session/payment dated before `devirDate` as history. */
export function applyDevirDate(rows: StagedRow[], devirDate: string): StagedRow[] {
  return rows.map((row) => {
    let changed = false;
    const staged = row.staged.map((st) => {
      if (st.kind === "sessions") {
        const historical = dayKeyOf(st.record.date) < devirDate;
        const billingMode = historical ? ("historical_non_billable" as const) : ("billable" as const);
        if ((st.record.billingMode ?? "billable") === billingMode) return st;
        changed = true;
        return { ...st, record: { ...st.record, billingMode } };
      }
      if (st.kind === "openingBalances" && !st.record.date) {
        changed = true;
        return { ...st, record: { ...st.record, date: devirDate } };
      }
      if (st.kind === "payments" || st.kind === "teacherPayments") {
        const historical = dayKeyOf(st.record.date) < devirDate;
        if (!!st.record.historical === historical) return st;
        changed = true;
        return { ...st, record: { ...st.record, historical: historical || undefined } };
      }
      return st;
    }) as StagedRow["staged"];
    return changed ? { ...row, staged } : row;
  });
}

/** Suggested devir date: the day the system's own records start (the first
 *  live session or payment), so imported history never overlaps them; today
 *  when there are none. */
export function suggestDevirDate(liveSessions: Session[], livePaymentDates: string[], today: string): string {
  const dates = [
    ...liveSessions.filter((s) => s.billingMode !== "historical_non_billable").map((s) => dayKeyOf(s.date)),
    ...livePaymentDates.map(dayKeyOf),
  ];
  return dates.length === 0 ? today : dates.reduce((min, d) => (d < min ? d : min), today);
}

export type StudentDevirSource = "file" | "computed" | "no_payments";

export interface StudentDevirLine {
  studentId: string;
  studentName: string;
  /** Lessons before the devir date (price × count, billing statuses only). */
  lessonTotal: number;
  paymentTotal: number;
  /** Signed devir in the file's own devir rows (debt +, credit −), if any. */
  fileDevir: number | null;
  /** Debt +, credit −. */
  suggested: number;
  source: StudentDevirSource;
  /** The student already had a devir before this import. */
  hasExistingDevir: boolean;
}

export interface TeacherDevirLine {
  teacherId: string;
  teacherName: string;
  earningTotal: number;
  paymentTotal: number;
  /** Salary-based pay can't be derived from lessons. */
  salaryBased: boolean;
  suggested: number;
  hasExistingDevir: boolean;
}

export interface DevirPlan {
  students: StudentDevirLine[];
  teachers: TeacherDevirLine[];
  /** The import holds at least one student payment. */
  hasPaymentData: boolean;
}

export function buildDevirPlan(params: {
  rows: StagedRow[];
  devirDate: string;
  students: Student[];
  teachers: Teacher[];
  openingBalances: OpeningBalance[];
  policy: TeacherEarningsSettings;
}): DevirPlan {
  const { rows, devirDate, policy } = params;
  const committed = rows.filter(isCommitted).flatMap((r) => r.staged);

  const stagedStudents = committed.flatMap((st) => (st.kind === "students" ? [st.record] : []));
  const stagedTeachers = committed.flatMap((st) => (st.kind === "teachers" ? [st.record] : []));
  const studentName = (id: string) =>
    [...params.students, ...stagedStudents].find((s) => s.id === id)?.fullName ?? "—";
  const teacherById = (id: string) => [...params.teachers, ...stagedTeachers].find((t) => t.id === id);

  const student = new Map<string, { lessons: number; paid: number; fileDevir: number | null }>();
  const teacher = new Map<string, { earned: number; paid: number }>();
  const s = (id: string) => student.get(id) ?? (student.set(id, { lessons: 0, paid: 0, fileDevir: null }), student.get(id)!);
  const t = (id: string) => teacher.get(id) ?? (teacher.set(id, { earned: 0, paid: 0 }), teacher.get(id)!);
  let hasPaymentData = false;

  for (const st of committed) {
    if (st.kind === "sessions" && dayKeyOf(st.record.date) < devirDate) {
      const r = st.record;
      if (isChargeableStatus(r.status)) s(r.studentId).lessons += r.studentPrice * r.sessionCount;
      t(r.teacherId).earned += r.teacherEarning * r.sessionCount * computeEarningFactor(r.status, policy);
    } else if (st.kind === "payments") {
      hasPaymentData = true;
      if (dayKeyOf(st.record.date) < devirDate) s(st.record.studentId).paid += st.record.amount;
    } else if (st.kind === "teacherPayments" && dayKeyOf(st.record.date) < devirDate) {
      // A Kesinti also settles what was owed.
      t(st.record.teacherId).paid += st.record.amount;
    } else if (st.kind === "openingBalances") {
      const signed = st.record.balanceType === "debt" ? st.record.amount : -st.record.amount;
      const entry = s(st.record.studentId);
      entry.fileDevir = (entry.fileDevir ?? 0) + signed;
    }
  }

  const round = (n: number) => Math.round(n * 100) / 100;
  const students: StudentDevirLine[] = [...student.entries()].map(([studentId, v]) => {
    const source: StudentDevirSource = v.fileDevir !== null ? "file" : hasPaymentData ? "computed" : "no_payments";
    return {
      studentId,
      studentName: studentName(studentId),
      lessonTotal: round(v.lessons),
      paymentTotal: round(v.paid),
      fileDevir: v.fileDevir,
      suggested: source === "file" ? round(v.fileDevir!) : source === "computed" ? round(v.lessons - v.paid) : 0,
      source,
      hasExistingDevir: params.openingBalances.some((b) => b.studentId === studentId),
    };
  });

  const teachers: TeacherDevirLine[] = [...teacher.entries()].flatMap(([teacherId, v]) => {
    const record = teacherById(teacherId);
    if (!record) return [];
    const salaryBased = record.earningType === "monthly_salary" || record.earningType === "salary_plus_quota";
    return [
      {
        teacherId,
        teacherName: record.fullName,
        earningTotal: round(v.earned),
        paymentTotal: round(v.paid),
        salaryBased,
        suggested: salaryBased ? 0 : Math.max(0, round(v.earned - v.paid)),
        hasExistingDevir: !!record.openingBalance,
      },
    ];
  });

  const byName = <T extends { studentName?: string; teacherName?: string }>(a: T, b: T) =>
    (a.studentName ?? a.teacherName ?? "").localeCompare(b.studentName ?? b.teacherName ?? "", "tr");
  return { students: students.sort(byName), teachers: teachers.sort(byName), hasPaymentData };
}

/** Whether a devir line is applied: by default yes, unless the person already
 *  had a devir before this import (then it would be counted twice). */
export function isDevirIncluded(
  included: Record<string, boolean>,
  id: string,
  line: { hasExistingDevir: boolean }
): boolean {
  return included[id] ?? !line.hasExistingDevir;
}

/** Staged devir records for the students whose devir this import sets (not
 *  the ones whose devir comes from the file's own devir rows — those are
 *  staged already). Committed with the rest of the import, so rollback
 *  removes them too. */
export function studentDevirRows(
  lines: StudentDevirLine[],
  amountOf: (id: string, suggested: number) => number,
  devirDate: string
): StagedRow[] {
  return lines.flatMap((line, i) => {
    const amount = Math.round(amountOf(line.studentId, line.suggested) * 100) / 100;
    if (line.source === "file" || amount === 0) return [];
    const record: OpeningBalance = {
      id: newId("opening", i + 1),
      tenantId: "tenant-1",
      studentId: line.studentId,
      amount: Math.abs(amount),
      balanceType: amount > 0 ? "debt" : "credit",
      date: devirDate,
      note: "Excel aktarımı — devir",
      createdAt: new Date().toISOString(),
    };
    return [
      {
        preview: {
          rowNumber: i + 1,
          displayText: `${line.studentName} — devir`,
          status: "valid" as const,
          issues: [],
          entityMatches: [],
          include: true,
        },
        staged: [{ kind: "openingBalances" as const, record }],
      },
    ];
  });
}
