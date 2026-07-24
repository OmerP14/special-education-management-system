import type { TeacherEducationTypeAssignment } from "@/types";

// 1:1 structural conversion of the old Teacher.specializations + TeacherCustomPrice
// seed data — every specialization becomes one active assignment row; a
// specialization with no matching price row becomes earningAmount: null (teacher-5
// below), which is the natural "missing pricing" QA fixture rather than something
// invented for this task.
export const mockTeacherEducationTypeAssignments: TeacherEducationTypeAssignment[] = [
  {
    // Ayşe Kaya — Dil Terapisi
    id: "tea-1",
    tenantId: "tenant-1",
    teacherId: "teacher-1",
    educationTypeId: "et-3",
    earningAmount: 275,
    status: "active",
    createdAt: "2024-01-15T00:00:00Z",
  },
  {
    // Mehmet Demir — Bireysel Eğitim
    id: "tea-2",
    tenantId: "tenant-1",
    teacherId: "teacher-2",
    educationTypeId: "et-1",
    earningAmount: 220,
    status: "active",
    createdAt: "2024-02-01T00:00:00Z",
  },
  {
    // Mehmet Demir — Dil Terapisi
    id: "tea-3",
    tenantId: "tenant-1",
    teacherId: "teacher-2",
    educationTypeId: "et-3",
    earningAmount: 250,
    status: "active",
    createdAt: "2024-02-01T00:00:00Z",
  },
  {
    // Fatma Yıldız (salary_plus_quota) — Özel Algı Eğitimi. earningAmount is
    // unused for this earning type; the row only gates which education types
    // she may provide.
    id: "tea-4",
    tenantId: "tenant-1",
    teacherId: "teacher-3",
    educationTypeId: "et-4",
    earningAmount: null,
    status: "active",
    createdAt: "2024-03-01T00:00:00Z",
  },
  {
    // Ahmet Çelik (percentage) — Bireysel Eğitim. earningAmount unused.
    id: "tea-5",
    tenantId: "tenant-1",
    teacherId: "teacher-4",
    educationTypeId: "et-1",
    earningAmount: null,
    status: "active",
    createdAt: "2024-04-01T00:00:00Z",
  },
  {
    // Ahmet Çelik (percentage) — Grup Eğitimi. earningAmount unused.
    id: "tea-6",
    tenantId: "tenant-1",
    teacherId: "teacher-4",
    educationTypeId: "et-2",
    earningAmount: null,
    status: "active",
    createdAt: "2024-04-01T00:00:00Z",
  },
  {
    // Zeynep Arslan (inactive, per_session) — Grup Eğitimi, no price ever set.
    // Demonstrates "missing_pricing" configuration status.
    id: "tea-7",
    tenantId: "tenant-1",
    teacherId: "teacher-5",
    educationTypeId: "et-2",
    earningAmount: null,
    status: "active",
    createdAt: "2024-01-20T00:00:00Z",
  },
];
