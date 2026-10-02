import type { Guardian, Student } from "@/types";
import type { StudentSettings } from "@/types/settings";

// ─── Institution student rules (Ayarlar → Öğrenci ve Veli) ───────────────────

/** "OGR-{0000}" → "OGR-0012"; {YYYY} becomes the current year. */
export function formatStudentNumber(format: string, sequence: number, now: Date = new Date()): string {
  return format
    .replaceAll("{YYYY}", String(now.getFullYear()))
    .replace(/\{(0+)\}/g, (_, zeros: string) => String(sequence).padStart(zeros.length, "0"));
}

export function getNextStudentSequence(students: Student[]): number {
  return students.reduce((max, s) => Math.max(max, s.studentSequence ?? 0), 0) + 1;
}

/** Gives a student an auto-generated number when the setting is on and it has none. */
export function assignStudentNumber(student: Student, existing: Student[], settings: StudentSettings): Student {
  if (!settings.autoGenerateStudentNumber || student.studentNumber) return student;
  const sequence = getNextStudentSequence(existing);
  return { ...student, studentSequence: sequence, studentNumber: formatStudentNumber(settings.studentNumberFormat, sequence) };
}

/** Numbers every unnumbered student (oldest first) — used once on load. */
export function backfillStudentNumbers(students: Student[], settings: StudentSettings): Student[] {
  if (!settings.autoGenerateStudentNumber || students.every((s) => s.studentNumber)) return students;
  const order = [...students].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  let numbered = students;
  for (const s of order) {
    if (s.studentNumber) continue;
    const withNumber = assignStudentNumber(s, numbered, settings);
    numbered = numbered.map((x) => (x.id === s.id ? withNumber : x));
  }
  return numbered;
}

export interface StudentFormFields {
  fullName: string;
  birthDate: string;
  guardianId: string;
  studentNumber: string;
  kvkkConsent: boolean;
  healthInfo: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
}

/** Field errors for the student form under the institution's required-field rules. */
export function validateStudentFields(
  form: StudentFormFields,
  settings: StudentSettings,
  others: Student[]
): Partial<Record<keyof StudentFormFields, string>> {
  const errors: Partial<Record<keyof StudentFormFields, string>> = {};
  if (!form.fullName.trim()) errors.fullName = "Ad soyad zorunludur.";
  if (settings.requireBirthDate && !form.birthDate) errors.birthDate = "Doğum tarihi zorunludur.";
  if (settings.guardianRequired && !form.guardianId) errors.guardianId = "Veli seçimi zorunludur.";
  if (settings.requireKvkkConsent && !form.kvkkConsent) errors.kvkkConsent = "KVKK onayı alınmalıdır.";
  if (settings.requireHealthInfo && !form.healthInfo.trim()) errors.healthInfo = "Sağlık bilgisi zorunludur.";
  if (settings.requireEmergencyContact && (!form.emergencyContactName.trim() || !form.emergencyContactPhone.trim())) {
    errors.emergencyContactName = "Acil durum kişisi ve telefonu zorunludur.";
  }
  const number = form.studentNumber.trim();
  if (number && others.some((s) => s.studentNumber?.toLowerCase() === number.toLowerCase())) {
    errors.studentNumber = "Bu öğrenci numarası başka bir öğrencide kullanılıyor.";
  }
  return errors;
}

/** Students that already belong to a guardian other than `guardianId` — used
 *  to stop a second guardian when "Birden fazla veliye izin ver" is off. */
export function getStudentIdsWithOtherGuardian(guardians: Guardian[], guardianId: string | undefined): Set<string> {
  const ids = new Set<string>();
  for (const g of guardians) {
    if (g.id === guardianId) continue;
    for (const sid of g.studentIds) ids.add(sid);
  }
  return ids;
}

/** Link for Ayarlar → Öğrenci ve Veli → Veli İletişim Tercihi. */
export function getGuardianContactLink(
  guardian: Pick<Guardian, "phone" | "email">,
  preference: StudentSettings["guardianContactPreference"]
): { href: string; label: string } | null {
  const digits = guardian.phone.replace(/\D/g, "");
  if (preference === "email") {
    return guardian.email ? { href: `mailto:${guardian.email}`, label: "E-posta gönder" } : null;
  }
  if (!digits) return null;
  if (preference === "whatsapp") {
    // Turkish numbers: 05xx… / 5xx… → 905xx…
    const intl = digits.startsWith("90") ? digits : `90${digits.replace(/^0/, "")}`;
    return { href: `https://wa.me/${intl}`, label: "WhatsApp'tan yaz" };
  }
  return { href: `tel:${digits}`, label: "Ara" };
}
