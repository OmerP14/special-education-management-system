import type { InstallmentInterval, Payment, TeacherPaymentType } from "@/types";
import type { FinanceSettings, OverpaymentPolicy, TeacherEarningsSettings } from "@/types/settings";

// ─── Institution finance rules (Ayarlar → Finans) ────────────────────────────

const MONTH_NAMES = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

/** Fills "Tahsilat Açıklama Şablonu": {ogrenciAdi} and {ay} ("Mart 2026"). */
export function fillCollectionTemplate(template: string, studentName: string, date: string): string {
  const d = date ? new Date(`${date.slice(0, 10)}T00:00:00`) : new Date();
  const month = Number.isNaN(d.getTime()) ? "" : `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  return template.replaceAll("{ogrenciAdi}", studentName).replaceAll("{ay}", month).trim();
}

/** "Makbuz Numara Formatı": {YYYY} → year, a run of zeros in braces ({0000})
 *  → the sequence padded to that width. */
export function formatReceiptNumber(format: string, sequence: number, date: string): string {
  const year = (date || new Date().toISOString()).slice(0, 4);
  return format
    .replaceAll("{YYYY}", year)
    .replace(/\{(0+)\}/g, (_, zeros: string) => String(sequence).padStart(zeros.length, "0"));
}

/** Next receipt sequence: one past the highest issued, never below
 *  "Başlangıç Ödeme Numarası". */
export function getNextReceiptSequence(payments: Payment[], start: number): number {
  const highest = payments.reduce((max, p) => Math.max(max, p.receiptSequence ?? 0), 0);
  return Math.max(start, highest + 1);
}

/** Gives a new payment its receipt number (no-op if it already has one). */
export function assignReceiptNumber(payment: Payment, existing: Payment[], finance: FinanceSettings): Payment {
  if (payment.receiptNumber) return payment;
  const sequence = getNextReceiptSequence(existing, finance.paymentNumberStart);
  return {
    ...payment,
    receiptSequence: sequence,
    receiptNumber: formatReceiptNumber(finance.receiptNumberFormat, sequence, payment.date),
  };
}

/** Installment form defaults from "Varsayılan Taksit Aralığı (gün)". */
export function getDefaultInstallmentInterval(days: number): { interval: InstallmentInterval; customIntervalDays: number } {
  if (days === 30) return { interval: "monthly", customIntervalDays: 30 };
  if (days === 7) return { interval: "weekly", customIntervalDays: 7 };
  return { interval: "custom", customIntervalDays: Math.max(1, days) };
}

export const OVERPAYMENT_POLICY_MESSAGES: Record<OverpaymentPolicy, string> = {
  credit: "Fazla tutar öğrencinin alacağı (avans bakiyesi) olarak kaydedilecek ve sonraki seanslardan düşülecek.",
  warn: "Kurum ayarlarına göre fazla ödeme onay gerektirir.",
  block: "Kurum ayarlarına göre mevcut borçtan fazla ödeme alınamaz.",
};

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
