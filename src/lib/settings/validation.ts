import type { InstitutionSettingsKey, InstitutionSettings } from "@/types/settings";

export type SettingsValidationErrors = Record<string, string>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Turkish mobile/landline, either spaced/dashed or bare digits — normalized
// (normalizePhone below) strips everything but digits before this ever runs.
const PHONE_DIGITS_RE = /^0?\d{10}$/;
const TAX_NUMBER_RE = /^\d{10}$|^\d{11}$/; // 10-digit vergi no or 11-digit TCKN
const MERSIS_RE = /^\d{16}$/;

export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

function isValidPhone(value: string): boolean {
  return PHONE_DIGITS_RE.test(normalizePhone(value));
}

/** Field-level validators per section — intentionally real for the sections
 *  the spec calls out by name (institution profile's email/phone/tax number),
 *  and structural (numeric range / non-empty) for the rest rather than
 *  exhaustive per-field business rules that don't exist anywhere else in the
 *  app either. Returns {} (valid) when a section has nothing to check. */
export function validateInstitutionSettingsSection<K extends InstitutionSettingsKey>(
  key: K,
  value: InstitutionSettings[K]
): SettingsValidationErrors {
  const errors: SettingsValidationErrors = {};

  if (key === "institution") {
    const v = value as InstitutionSettings["institution"];
    if (!v.name.trim()) errors.name = "Kurum adı zorunludur.";
    if (v.email && !isValidEmail(v.email)) {
      errors.email = "Geçerli bir e-posta adresi girin.";
    }
    if (v.contactPersonEmail && !isValidEmail(v.contactPersonEmail)) {
      errors.contactPersonEmail = "Geçerli bir e-posta adresi girin.";
    }
    if (v.phone && !isValidPhone(v.phone)) {
      errors.phone = "Telefon numarası 10 haneli olmalıdır (örn. 0532 123 45 67).";
    }
    if (v.contactPersonPhone && !isValidPhone(v.contactPersonPhone)) {
      errors.contactPersonPhone = "Telefon numarası 10 haneli olmalıdır.";
    }
    if (v.taxNumber && !TAX_NUMBER_RE.test(v.taxNumber.trim())) {
      errors.taxNumber = "Vergi numarası 10 haneli, TCKN ise 11 haneli olmalıdır.";
    }
    if (v.mersisNumber && !MERSIS_RE.test(v.mersisNumber.trim())) {
      errors.mersisNumber = "MERSİS numarası 16 haneli olmalıdır.";
    }
    if (v.website && !/^https?:\/\/.+\..+/.test(v.website.trim())) {
      errors.website = "Web sitesi http:// veya https:// ile başlamalıdır.";
    }
  }

  if (key === "sessions") {
    const v = value as InstitutionSettings["sessions"];
    if (v.minDurationMinutes >= v.maxDurationMinutes) {
      errors.minDurationMinutes = "Minimum süre, maksimum süreden küçük olmalıdır.";
    }
    if (v.defaultDurationMinutes < v.minDurationMinutes || v.defaultDurationMinutes > v.maxDurationMinutes) {
      errors.defaultDurationMinutes = "Varsayılan süre, minimum ve maksimum aralığında olmalıdır.";
    }
    if (v.defaultDurationMinutes <= 0) errors.defaultDurationMinutes = "Süre 0'dan büyük olmalıdır.";
  }

  if (key === "calendar") {
    const v = value as InstitutionSettings["calendar"];
    if (v.dayStartTime >= v.dayEndTime) {
      errors.dayEndTime = "Bitiş saati, başlangıç saatinden sonra olmalıdır.";
    }
    if (v.workingDays.length === 0) {
      errors.workingDays = "En az bir çalışma günü seçilmelidir.";
    }
  }

  if (key === "finance") {
    const v = value as InstitutionSettings["finance"];
    if (v.enabledPaymentMethods.length === 0) {
      errors.enabledPaymentMethods = "En az bir ödeme yöntemi aktif olmalıdır.";
    }
    if (!v.enabledPaymentMethods.includes(v.defaultPaymentMethod)) {
      errors.defaultPaymentMethod = "Varsayılan yöntem, aktif yöntemlerden biri olmalıdır.";
    }
  }

  if (key === "teacherEarnings") {
    const v = value as InstitutionSettings["teacherEarnings"];
    if (v.availableEarningTypes.length === 0) {
      errors.availableEarningTypes = "En az bir ücretlendirme türü seçilmelidir.";
    }
    if (!v.availableEarningTypes.includes(v.defaultEarningType)) {
      errors.defaultEarningType = "Varsayılan tür, kullanılabilir türlerden biri olmalıdır.";
    }
    if (v.payPeriodStartDay < 1 || v.payPeriodStartDay > 28) {
      errors.payPeriodStartDay = "Ayın 1 ile 28. günü arasında olmalıdır.";
    }
  }

  return errors;
}

export function hasValidationErrors(errors: SettingsValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}
