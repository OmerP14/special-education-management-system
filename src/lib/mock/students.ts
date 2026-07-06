import type { Student, Guardian } from "@/types";

// ─── Demo Guardians ────────────────────────────────────────────────────────────

export const DEMO_GUARDIANS: Guardian[] = [
  {
    id: "guardian-1",
    tenantId: "tenant-1",
    fullName: "Ahmet Yıldırım",
    phone: "05075184137",
    email: "ahmet@gmail.com",
    relationship: "Baba",
    studentIds: ["student-1"],
    address: "Meram",
    createdAt: "2026-01-10T00:00:00Z",
  },
  {
    id: "guardian-2",
    tenantId: "tenant-1",
    fullName: "Zeynep Demir",
    phone: "05552223344",
    email: "zeynep@test.com",
    relationship: "Anne",
    studentIds: ["student-2"],
    address: "Selçuklu",
    createdAt: "2026-01-12T00:00:00Z",
  },
];

// ─── Demo Students ─────────────────────────────────────────────────────────────

export const DEMO_STUDENTS: Student[] = [
  {
    id: "student-1",
    tenantId: "tenant-1",
    fullName: "Efe Yıldırım",
    birthDate: "2018-05-15",
    status: "active",
    guardianIds: ["guardian-1"],
    educationTypeIds: ["et-2"], // Grup Eğitimi
    weeklySessionCount: 2,
    createdAt: "2026-01-10T00:00:00Z",
  },
  {
    id: "student-2",
    tenantId: "tenant-1",
    fullName: "Mina Demir",
    birthDate: "2020-03-22",
    status: "active",
    guardianIds: ["guardian-2"],
    educationTypeIds: ["et-3"], // Dil Terapisi
    weeklySessionCount: 1,
    createdAt: "2026-01-12T00:00:00Z",
  },
];

// ─── Exports used by store initial state ──────────────────────────────────────

export const mockGuardians: Guardian[] = DEMO_GUARDIANS;
export const mockStudents: Student[] = DEMO_STUDENTS;
