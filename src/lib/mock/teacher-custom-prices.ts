import type { TeacherCustomPrice } from "@/types";

// Per-teacher overrides on the default education-type earning rate.
// When present, these take precedence over EducationType.defaultTeacherEarning.
export const mockTeacherCustomPrices: TeacherCustomPrice[] = [
  // Ayşe Yılmaz (teacher-1) – slightly higher rates due to seniority
  {
    id: "tcp-1",
    tenantId: "tenant-1",
    teacherId: "teacher-1",
    educationTypeId: "et-1", // Bireysel Eğitim: default 200 → custom 220
    customEarning: 220,
    createdAt: "2024-03-01T00:00:00Z",
  },
  {
    id: "tcp-2",
    tenantId: "tenant-1",
    teacherId: "teacher-1",
    educationTypeId: "et-3", // Dil Terapisi: default 225 → custom 250
    customEarning: 250,
    createdAt: "2024-03-01T00:00:00Z",
  },
  // Mehmet Kara (teacher-2) – custom rate on group sessions
  {
    id: "tcp-3",
    tenantId: "tenant-1",
    teacherId: "teacher-2",
    educationTypeId: "et-2", // Grup Eğitimi: default 150 → custom 175
    customEarning: 175,
    createdAt: "2024-03-15T00:00:00Z",
  },
  // Elif Demir (teacher-3) – higher rate for specialised sensory integration
  {
    id: "tcp-4",
    tenantId: "tenant-1",
    teacherId: "teacher-3",
    educationTypeId: "et-4", // Özel Algı Eğitimi: default 250 → custom 275
    customEarning: 275,
    createdAt: "2024-04-01T00:00:00Z",
  },
  // Can Şahin (teacher-4) – inactive; one historic custom rate still on file
  {
    id: "tcp-5",
    tenantId: "tenant-1",
    teacherId: "teacher-4",
    educationTypeId: "et-2", // Grup Eğitimi: default 150 → custom 160
    customEarning: 160,
    createdAt: "2024-02-20T00:00:00Z",
  },
];
