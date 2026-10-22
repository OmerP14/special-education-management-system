import type { Student } from "@/types";
import type { StudentSettings } from "@/types/settings";

// ─── Institution student rules (Ayarlar → Öğrenci) ───────────────────

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
  guardianName: string;
  guardianPhone: string;
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

/** The student's optional guardian contact, or null when neither field is set. */
export function getStudentGuardianContact(
  student: Pick<Student, "guardianName" | "guardianPhone"> | null | undefined
): { fullName: string; phone: string } | null {
  if (!student || (!student.guardianName && !student.guardianPhone)) return null;
  return { fullName: student.guardianName ?? "", phone: student.guardianPhone ?? "" };
}

/** Call / WhatsApp link for the student card's guardian phone. */
export function getGuardianContactLink(
  phone: string | undefined,
  preference: StudentSettings["guardianContactPreference"]
): { href: string; label: string } | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return null;
  if (preference === "whatsapp") {
    // Turkish numbers: 05xx… / 5xx… → 905xx…
    const intl = digits.startsWith("90") ? digits : `90${digits.replace(/^0/, "")}`;
    return { href: `https://wa.me/${intl}`, label: "WhatsApp'tan yaz" };
  }
  return { href: `tel:${digits}`, label: "Ara" };
}
