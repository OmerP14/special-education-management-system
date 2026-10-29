import type { Student } from "@/types";

// ─── Guardians → student fields ─────────────────────────────────────────────
//
// Guardians used to be separate records linked to students (guardianIds /
// studentIds). They were removed: a student now carries an optional
// guardianName / guardianPhone. Data saved before that (the server document
// or an old backup file) is folded in on load, so no contact is lost.

interface LegacyGuardian {
  id?: unknown;
  fullName?: unknown;
  phone?: unknown;
  studentIds?: unknown;
}

type LegacyStudent = Student & { guardianIds?: unknown };

const text = (v: unknown) => (typeof v === "string" && v.trim() && v.trim() !== "—" ? v.trim() : undefined);

export function foldLegacyGuardians(students: Student[], guardians: unknown): Student[] {
  const list = Array.isArray(guardians) ? (guardians as LegacyGuardian[]) : [];
  return (students as LegacyStudent[]).map((student) => {
    if (!("guardianIds" in student)) return student;
    const { guardianIds, ...rest } = student;
    const ids = Array.isArray(guardianIds) ? guardianIds : [];
    // The first linked guardian was the primary one everywhere in the old UI.
    const guardian =
      ids.map((id) => list.find((g) => g.id === id)).find(Boolean) ??
      list.find((g) => Array.isArray(g.studentIds) && g.studentIds.includes(student.id));
    return {
      ...rest,
      guardianName: rest.guardianName ?? text(guardian?.fullName),
      guardianPhone: rest.guardianPhone ?? text(guardian?.phone),
    };
  });
}
