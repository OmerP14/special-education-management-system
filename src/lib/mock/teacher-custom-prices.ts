import type { TeacherCustomPrice } from "@/types";

// ─── Teacher custom earning overrides ─────────────────────────────────────────
// These take precedence over EducationType.defaultTeacherEarning when present.
export const mockTeacherCustomPrices: TeacherCustomPrice[] = [
  // Ayşe Yılmaz (teacher-1) – senior rates
  {
    id: "tcp-1",
    tenantId: "tenant-1",
    teacherId: "teacher-1",
    educationTypeId: "et-1", // Bireysel: default 200 → 220
    customEarning: 220,
    createdAt: "2024-03-01T00:00:00Z",
  },
  {
    id: "tcp-2",
    tenantId: "tenant-1",
    teacherId: "teacher-1",
    educationTypeId: "et-3", // Dil Terapisi: default 225 → 250
    customEarning: 250,
    createdAt: "2024-03-01T00:00:00Z",
  },
  // Mehmet Kara (teacher-2) – custom group rate
  {
    id: "tcp-3",
    tenantId: "tenant-1",
    teacherId: "teacher-2",
    educationTypeId: "et-2", // Grup Eğitimi: default 150 → 175
    customEarning: 175,
    createdAt: "2024-03-15T00:00:00Z",
  },
  // Elif Demir (teacher-3) – specialised sensory integration rate
  {
    id: "tcp-4",
    tenantId: "tenant-1",
    teacherId: "teacher-3",
    educationTypeId: "et-4", // Özel Algı: default 250 → 275
    customEarning: 275,
    createdAt: "2024-04-01T00:00:00Z",
  },
];
