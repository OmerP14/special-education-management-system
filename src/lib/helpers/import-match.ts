// ─── Entity matching / duplicate detection (Excel Import) ──────────────────────
// Every row is matched against the CURRENT store state — not a separate "already
// imported" ledger. This is what makes import idempotent for free: re-uploading
// the same file re-matches every row against what was committed last time and
// finds it already there.
//
// Everything here is INDEX-based (Map lookups), never a linear scan over an array
// that grows one row at a time — a per-row `.find()`/`.filter()` over a "working"
// array that itself grows by one every row is O(n^2) by construction, and a real
// historical-migration file (thousands of rows) makes that difference the gap
// between a sub-second preview and a multi-minute freeze. Callers build an index
// once per staging run and add newly-created records to it in O(1) as they go —
// see the `buildXIndex` / `addXToIndex` pairs below.

import type {
  Student,
  Guardian,
  Teacher,
  Session,
  Payment,
  TeacherPayment,
  OpeningBalance,
  OpeningBalanceType,
} from "@/types";

export function normalizeName(name: string): string {
  return name
    .toLocaleLowerCase("tr-TR")
    .replace(/\s+/g, " ")
    .trim();
}

/** Keeps the last 10 digits — tolerant of "0", "+90", "90" prefixes and formatting. */
export function normalizePhone(phone: string | undefined | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return null;
  return digits.slice(-10);
}

function addToBucket<T>(map: Map<string, T[]>, key: string, item: T): void {
  const bucket = map.get(key);
  if (bucket) bucket.push(item);
  else map.set(key, [item]);
}

export type MatchTier = "matched" | "possible" | "new";

// ─── Students ────────────────────────────────────────────────────────────────

export interface StudentIndex {
  byName: Map<string, Student[]>;
}

export function buildStudentIndex(students: Student[]): StudentIndex {
  const byName = new Map<string, Student[]>();
  for (const s of students) addToBucket(byName, normalizeName(s.fullName), s);
  return { byName };
}

export function addStudentToIndex(index: StudentIndex, student: Student): void {
  addToBucket(index.byName, normalizeName(student.fullName), student);
}

export interface StudentMatchResult {
  tier: MatchTier;
  student: Student | null;
}

/** Name match alone is a "possible duplicate" (needs user confirmation); name +
 *  phone (via the student's guardians) agreeing both is a confident "matched". */
export function matchStudent(
  fullName: string,
  guardianPhone: string | null | undefined,
  studentIndex: StudentIndex,
  guardianIndex: GuardianIndex
): StudentMatchResult {
  const candidates = studentIndex.byName.get(normalizeName(fullName)) ?? [];
  if (candidates.length === 0) return { tier: "new", student: null };

  const normalizedPhone = normalizePhone(guardianPhone);
  if (normalizedPhone) {
    const confident = candidates.find((s) =>
      s.guardianIds.some((gid) => {
        const g = guardianIndex.byId.get(gid);
        return g && normalizePhone(g.phone) === normalizedPhone;
      })
    );
    if (confident) return { tier: "matched", student: confident };
  }

  // Name matches but no phone corroboration (or student has no phone on file) —
  // could be the same person or a coincidental namesake.
  return { tier: "possible", student: candidates[0]! };
}

export interface StudentResolution {
  student: Student | null;
  ambiguous: boolean;
}

/** Foreign-key resolution (Sessions / Payments / Opening Balances) — simpler than
 *  matchStudent above since it doesn't need to decide new-vs-duplicate, only find
 *  an existing record; a name shared by more than one is genuinely ambiguous. */
export function resolveStudentByName(fullName: string, studentIndex: StudentIndex): StudentResolution {
  const candidates = studentIndex.byName.get(normalizeName(fullName)) ?? [];
  if (candidates.length === 0) return { student: null, ambiguous: false };
  return { student: candidates[0]!, ambiguous: candidates.length > 1 };
}

// ─── Guardians ───────────────────────────────────────────────────────────────

export interface GuardianIndex {
  byId: Map<string, Guardian>;
  byPhone: Map<string, Guardian>;
  byName: Map<string, Guardian[]>;
}

export function buildGuardianIndex(guardians: Guardian[]): GuardianIndex {
  const index: GuardianIndex = { byId: new Map(), byPhone: new Map(), byName: new Map() };
  for (const g of guardians) addGuardianToIndex(index, g);
  return index;
}

export function addGuardianToIndex(index: GuardianIndex, guardian: Guardian): void {
  index.byId.set(guardian.id, guardian);
  const phone = normalizePhone(guardian.phone);
  if (phone && !index.byPhone.has(phone)) index.byPhone.set(phone, guardian);
  addToBucket(index.byName, normalizeName(guardian.fullName), guardian);
}

export interface GuardianMatchResult {
  tier: MatchTier;
  guardian: Guardian | null;
}

export function matchGuardian(fullName: string, phone: string | undefined, guardianIndex: GuardianIndex): GuardianMatchResult {
  const normalizedPhone = normalizePhone(phone);
  if (normalizedPhone) {
    const byPhone = guardianIndex.byPhone.get(normalizedPhone);
    if (byPhone) return { tier: "matched", guardian: byPhone };
  }
  const byName = guardianIndex.byName.get(normalizeName(fullName))?.[0];
  if (byName) return { tier: normalizedPhone ? "possible" : "matched", guardian: byName };
  return { tier: "new", guardian: null };
}

// ─── Teachers ────────────────────────────────────────────────────────────────

export interface TeacherIndex {
  byName: Map<string, Teacher[]>;
}

export function buildTeacherIndex(teachers: Teacher[]): TeacherIndex {
  const byName = new Map<string, Teacher[]>();
  for (const t of teachers) addToBucket(byName, normalizeName(t.fullName), t);
  return { byName };
}

export function addTeacherToIndex(index: TeacherIndex, teacher: Teacher): void {
  addToBucket(index.byName, normalizeName(teacher.fullName), teacher);
}

export interface TeacherMatchResult {
  tier: MatchTier;
  teacher: Teacher | null;
}

export function matchTeacher(fullName: string, phone: string | undefined, teacherIndex: TeacherIndex): TeacherMatchResult {
  const candidates = teacherIndex.byName.get(normalizeName(fullName)) ?? [];
  if (candidates.length === 0) return { tier: "new", teacher: null };

  const normalizedPhone = normalizePhone(phone);
  if (normalizedPhone) {
    const confident = candidates.find((t) => normalizePhone(t.phone) === normalizedPhone);
    if (confident) return { tier: "matched", teacher: confident };
  }
  return { tier: "possible", teacher: candidates[0]! };
}

export interface TeacherResolution {
  teacher: Teacher | null;
  ambiguous: boolean;
}

export function resolveTeacherByName(fullName: string, teacherIndex: TeacherIndex): TeacherResolution {
  const candidates = teacherIndex.byName.get(normalizeName(fullName)) ?? [];
  if (candidates.length === 0) return { teacher: null, ambiguous: false };
  return { teacher: candidates[0]!, ambiguous: candidates.length > 1 };
}

// ─── Exact-duplicate indexes for financial/session records ─────────────────────
// Keyed by the same fields the old linear `.find()` compared, just precomputed into
// a Map key instead of re-checked per candidate.

export interface SessionDuplicateIndex {
  byKey: Map<string, Session>;
}

function sessionDuplicateKey(studentId: string, teacherId: string, educationTypeId: string, startsAt: string): string {
  return `${studentId}|${teacherId}|${educationTypeId}|${new Date(startsAt).getTime()}`;
}

export function buildSessionDuplicateIndex(sessions: Session[]): SessionDuplicateIndex {
  const byKey = new Map<string, Session>();
  for (const s of sessions) byKey.set(sessionDuplicateKey(s.studentId, s.teacherId, s.educationTypeId, s.date), s);
  return { byKey };
}

export function addSessionToDuplicateIndex(index: SessionDuplicateIndex, session: Session): void {
  index.byKey.set(sessionDuplicateKey(session.studentId, session.teacherId, session.educationTypeId, session.date), session);
}

export function findDuplicateSession(
  studentId: string,
  teacherId: string,
  educationTypeId: string,
  startsAt: string,
  index: SessionDuplicateIndex
): Session | null {
  return index.byKey.get(sessionDuplicateKey(studentId, teacherId, educationTypeId, startsAt)) ?? null;
}

export interface PaymentDuplicateIndex {
  byKey: Map<string, Payment>;
}

function paymentDuplicateKey(studentId: string, date: string, amount: number): string {
  return `${studentId}|${date}|${amount}`;
}

export function buildPaymentDuplicateIndex(payments: Payment[]): PaymentDuplicateIndex {
  const byKey = new Map<string, Payment>();
  for (const p of payments) byKey.set(paymentDuplicateKey(p.studentId, p.date, p.amount), p);
  return { byKey };
}

export function addPaymentToDuplicateIndex(index: PaymentDuplicateIndex, payment: Payment): void {
  index.byKey.set(paymentDuplicateKey(payment.studentId, payment.date, payment.amount), payment);
}

export function findDuplicatePayment(studentId: string, date: string, amount: number, index: PaymentDuplicateIndex): Payment | null {
  return index.byKey.get(paymentDuplicateKey(studentId, date, amount)) ?? null;
}

export interface TeacherPaymentDuplicateIndex {
  byKey: Map<string, TeacherPayment>;
}

function teacherPaymentDuplicateKey(teacherId: string, date: string, amount: number): string {
  return `${teacherId}|${date}|${amount}`;
}

export function buildTeacherPaymentDuplicateIndex(payments: TeacherPayment[]): TeacherPaymentDuplicateIndex {
  const byKey = new Map<string, TeacherPayment>();
  for (const p of payments) byKey.set(teacherPaymentDuplicateKey(p.teacherId, p.date, p.amount), p);
  return { byKey };
}

export function addTeacherPaymentToDuplicateIndex(index: TeacherPaymentDuplicateIndex, payment: TeacherPayment): void {
  index.byKey.set(teacherPaymentDuplicateKey(payment.teacherId, payment.date, payment.amount), payment);
}

export function findDuplicateTeacherPayment(
  teacherId: string,
  date: string,
  amount: number,
  index: TeacherPaymentDuplicateIndex
): TeacherPayment | null {
  return index.byKey.get(teacherPaymentDuplicateKey(teacherId, date, amount)) ?? null;
}

export interface OpeningBalanceDuplicateIndex {
  byKey: Map<string, OpeningBalance>;
  /** Backs the "this student already has an opening balance" warning without an
   *  O(n) `.some()` scan per row. */
  studentsWithBalance: Set<string>;
}

function openingBalanceDuplicateKey(studentId: string, date: string, balanceType: OpeningBalanceType): string {
  return `${studentId}|${date}|${balanceType}`;
}

export function buildOpeningBalanceDuplicateIndex(balances: OpeningBalance[]): OpeningBalanceDuplicateIndex {
  const byKey = new Map<string, OpeningBalance>();
  const studentsWithBalance = new Set<string>();
  for (const b of balances) {
    byKey.set(openingBalanceDuplicateKey(b.studentId, b.date, b.balanceType), b);
    studentsWithBalance.add(b.studentId);
  }
  return { byKey, studentsWithBalance };
}

export function addOpeningBalanceToDuplicateIndex(index: OpeningBalanceDuplicateIndex, balance: OpeningBalance): void {
  index.byKey.set(openingBalanceDuplicateKey(balance.studentId, balance.date, balance.balanceType), balance);
  index.studentsWithBalance.add(balance.studentId);
}

export function findDuplicateOpeningBalance(
  studentId: string,
  date: string,
  balanceType: OpeningBalanceType,
  index: OpeningBalanceDuplicateIndex
): OpeningBalance | null {
  return index.byKey.get(openingBalanceDuplicateKey(studentId, date, balanceType)) ?? null;
}

export function studentHasOpeningBalance(studentId: string, index: OpeningBalanceDuplicateIndex): boolean {
  return index.studentsWithBalance.has(studentId);
}
