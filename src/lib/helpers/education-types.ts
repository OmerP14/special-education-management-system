import type {
  EducationType,
  Session,
  Student,
  Teacher,
  WeeklySessionPlan,
  TeacherCustomPrice,
} from "@/types";
import { normalizeName } from "@/lib/helpers/import-match";

// ─── Color palette ──────────────────────────────────────────────────────────────
// Fixed, pre-vetted palette so a newly created education type always gets a safe,
// distinguishable color without the user having to pick one — see
// getReadableTextColor for the contrast guarantee against whichever swatch is used.

export const EDUCATION_TYPE_COLOR_PALETTE: string[] = [
  "#2563eb", // blue
  "#059669", // emerald
  "#d97706", // amber
  "#dc2626", // red
  "#7c3aed", // violet
  "#0891b2", // cyan
  "#db2777", // pink
  "#65a30d", // lime
  "#4f46e5", // indigo
  "#ea580c", // orange
];

export function getDefaultEducationTypeColor(existingCount: number): string {
  return EDUCATION_TYPE_COLOR_PALETTE[existingCount % EDUCATION_TYPE_COLOR_PALETTE.length];
}

/** Relative-luminance contrast check (WCAG-style) so text/icons drawn on a
 *  colored fill (calendar legend, filter badges) never land on an unreadable
 *  combination — always resolves to pure black or white, never a "close enough" color. */
export function getReadableTextColor(hex: string): "#111827" | "#ffffff" {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  const linear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const luminance = 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
  return luminance > 0.55 ? "#111827" : "#ffffff";
}

// ─── Name normalization ─────────────────────────────────────────────────────────
// Reuses the same trim/lowercase/whitespace-collapse rule the import matcher
// already applies to student/teacher names — one normalization rule, not two.

export const normalizeEducationTypeName = normalizeName;

// ─── Canonical lookups ──────────────────────────────────────────────────────────

export function getEducationTypeById(
  id: string | undefined | null,
  educationTypes: EducationType[]
): EducationType | undefined {
  if (!id) return undefined;
  return educationTypes.find((et) => et.id === id);
}

export function getActiveEducationTypes(educationTypes: EducationType[]): EducationType[] {
  return educationTypes.filter((et) => et.status === "active");
}

/** Never returns a raw id — falls back to "—" so a stale/unknown reference
 *  never leaks an internal identifier into the UI. */
export function getEducationTypeLabel(
  id: string | undefined | null,
  educationTypes: EducationType[]
): string {
  return getEducationTypeById(id, educationTypes)?.name ?? "—";
}

// ─── Usage / delete-safety ──────────────────────────────────────────────────────

export interface EducationTypeUsage {
  sessions: number;
  students: number;
  teachers: number;
  weeklyPlans: number;
  customPrices: number;
  total: number;
}

export function getEducationTypeUsage(
  educationTypeId: string,
  data: {
    sessions: Session[];
    students: Student[];
    teachers: Teacher[];
    weeklySessionPlans: WeeklySessionPlan[];
    teacherCustomPrices: TeacherCustomPrice[];
  }
): EducationTypeUsage {
  const sessions = data.sessions.filter((s) => s.educationTypeId === educationTypeId).length;
  const students = data.students.filter((s) => s.educationTypeIds.includes(educationTypeId)).length;
  const teachers = data.teachers.filter((t) => t.specializations.includes(educationTypeId)).length;
  const weeklyPlans = data.weeklySessionPlans.filter(
    (p) => p.educationTypeId === educationTypeId
  ).length;
  const customPrices = data.teacherCustomPrices.filter(
    (cp) => cp.educationTypeId === educationTypeId
  ).length;

  return {
    sessions,
    students,
    teachers,
    weeklyPlans,
    customPrices,
    total: sessions + students + teachers + weeklyPlans + customPrices,
  };
}

export function canDeleteEducationType(usage: EducationTypeUsage): boolean {
  return usage.total === 0;
}

export const EDUCATION_TYPE_DELETE_BLOCKED_MESSAGE =
  "Bu eğitim türü mevcut kayıtlarda kullanıldığı için silinemez. Pasife alabilirsiniz.";

// ─── Form validation ─────────────────────────────────────────────────────────────

export interface EducationTypeFormValues {
  name: string;
  defaultDurationMinutes: number;
  defaultStudentPrice: number;
}

export interface EducationTypeFormErrors {
  name?: string;
  defaultDurationMinutes?: string;
  defaultStudentPrice?: string;
}

/** `excludeId` is the record being edited (so it doesn't collide with itself
 *  in the duplicate-name check). */
export function validateEducationTypeForm(
  values: EducationTypeFormValues,
  existingEducationTypes: EducationType[],
  excludeId?: string
): EducationTypeFormErrors {
  const errors: EducationTypeFormErrors = {};
  const trimmedName = values.name.trim();

  if (!trimmedName) {
    errors.name = "Eğitim türü adı zorunludur.";
  } else {
    const normalized = normalizeEducationTypeName(trimmedName);
    const duplicate = existingEducationTypes.some(
      (et) => et.id !== excludeId && normalizeEducationTypeName(et.name) === normalized
    );
    if (duplicate) {
      errors.name = "Bu isimde bir eğitim türü zaten mevcut.";
    }
  }

  if (!Number.isFinite(values.defaultDurationMinutes) || values.defaultDurationMinutes <= 0) {
    errors.defaultDurationMinutes = "Varsayılan süre pozitif bir değer olmalıdır.";
  }

  if (!Number.isFinite(values.defaultStudentPrice) || values.defaultStudentPrice < 0) {
    errors.defaultStudentPrice = "Varsayılan öğrenci ücreti negatif olamaz.";
  }

  return errors;
}
