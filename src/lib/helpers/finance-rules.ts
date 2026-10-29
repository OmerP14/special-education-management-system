import type { Payment, Session, TeacherPaymentType } from "@/types";
import type { SessionSettings, TeacherEarningsSettings } from "@/types/settings";

// ─── Student payment rules ───────────────────────────────────────────────────
// Fixed rules: receipts are numbered MKB-<year>-<0000> from 1000 on, and a new
// payment's description starts as "<öğrenci> - <ay> tahsilatı".

const RECEIPT_NUMBER_FORMAT = "MKB-{YYYY}-{0000}";
const RECEIPT_NUMBER_START = 1000;

const MONTH_NAMES = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

/** Default description of a new payment: "Ali Veli - Mart 2026 tahsilatı". */
export function describeCollection(studentName: string, date: string): string {
  const d = date ? new Date(`${date.slice(0, 10)}T00:00:00`) : new Date();
  const month = Number.isNaN(d.getTime()) ? "" : `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  return `${studentName} - ${month} tahsilatı`.trim();
}

/** Receipt number format: {YYYY} → year, a run of zeros in braces ({0000})
 *  → the sequence padded to that width. */
export function formatReceiptNumber(format: string, sequence: number, date: string): string {
  const year = (date || new Date().toISOString()).slice(0, 4);
  return format
    .replaceAll("{YYYY}", year)
    .replace(/\{(0+)\}/g, (_, zeros: string) => String(sequence).padStart(zeros.length, "0"));
}

/** Next receipt sequence: one past the highest issued, never below `start`. */
export function getNextReceiptSequence(payments: Payment[], start: number): number {
  const highest = payments.reduce((max, p) => Math.max(max, p.receiptSequence ?? 0), 0);
  return Math.max(start, highest + 1);
}

/** Gives a new payment its receipt number (no-op if it already has one). */
export function assignReceiptNumber(payment: Payment, existing: Payment[]): Payment {
  if (payment.receiptNumber) return payment;
  const sequence = getNextReceiptSequence(existing, RECEIPT_NUMBER_START);
  return {
    ...payment,
    receiptSequence: sequence,
    receiptNumber: formatReceiptNumber(RECEIPT_NUMBER_FORMAT, sequence, payment.date),
  };
}

// ─── Teacher payments (Ayarlar → Öğretmen ve Hakediş) ────────────────────────

/** Payment types offered for teacher payments: Kesinti / Avans only when allowed. */
export function getAllowedTeacherPaymentTypes(
  allTypes: TeacherPaymentType[],
  policy: Pick<TeacherEarningsSettings, "allowDeductions" | "allowAdvances">
): TeacherPaymentType[] {
  return allTypes.filter(
    (t) => (t !== "deduction" || policy.allowDeductions) && (t !== "advance" || policy.allowAdvances)
  );
}

/**
 * Whether a teacher payment of `amount` may exceed what's pending. A Kesinti
 * can never exceed it (it only reduces what's owed); an Avans is paid ahead of
 * earnings by definition; anything else only when "Fazla ödemeyi engelle" is off.
 */
export function canExceedPendingEarning(
  type: TeacherPaymentType,
  policy: Pick<TeacherEarningsSettings, "allowAdvances" | "preventOverpayment">
): boolean {
  if (type === "deduction") return false;
  if (type === "advance") return policy.allowAdvances;
  return !policy.preventOverpayment;
}

/** Ayarlar → Ders Kuralları → "Telafi dersi için veliden ücret alınsın mı?":
 *  with "Hayır", a lesson saved as Telafi — from the form, Excel or a plan —
 *  costs the guardian nothing. Applied when the lesson becomes a makeup, so a
 *  later change of the setting never rewrites past lessons. */
export function applyMakeupBilling<T extends Session>(session: T, rules: Pick<SessionSettings, "makeupSessionBehavior">): T {
  return session.status === "makeup" && rules.makeupSessionBehavior === "non_billable" ? { ...session, studentPrice: 0 } : session;
}
