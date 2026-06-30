import type { Student, Guardian } from "@/types";

// ─── 3 Guardians ──────────────────────────────────────────────────────────────
// guardian-1 has two children (student-1 + student-5 are siblings)
export const mockGuardians: Guardian[] = [
  {
    id: "guardian-1",
    tenantId: "tenant-1",
    fullName: "Fatma Çelik",
    phone: "0530 100 10 10",
    email: "fatma.celik@example.com",
    relationship: "Anne",
    studentIds: ["student-1", "student-5"],
    createdAt: "2024-01-20T00:00:00Z",
  },
  {
    id: "guardian-2",
    tenantId: "tenant-1",
    fullName: "Ali Arslan",
    phone: "0531 200 20 20",
    email: "ali.arslan@example.com",
    relationship: "Baba",
    studentIds: ["student-2"],
    createdAt: "2024-01-22T00:00:00Z",
  },
  {
    id: "guardian-3",
    tenantId: "tenant-1",
    fullName: "Zeynep Koç",
    phone: "0532 300 30 30",
    relationship: "Anne",
    studentIds: ["student-3", "student-4"],
    createdAt: "2024-02-05T00:00:00Z",
  },
];

// ─── 5 Students ───────────────────────────────────────────────────────────────
// Mix of statuses: 4 active + 1 on_hold (student-5 is Yusuf's younger sibling)
export const mockStudents: Student[] = [
  {
    id: "student-1",
    tenantId: "tenant-1",
    fullName: "Yusuf Çelik",
    birthDate: "2016-03-15",
    status: "active",
    guardianIds: ["guardian-1"],
    educationTypeIds: ["et-1", "et-3"],
    notes: "Otizm spektrum bozukluğu tanısı mevcut.",
    createdAt: "2024-01-20T00:00:00Z",
  },
  {
    id: "student-2",
    tenantId: "tenant-1",
    fullName: "Elif Arslan",
    birthDate: "2017-07-22",
    status: "active",
    guardianIds: ["guardian-2"],
    educationTypeIds: ["et-1"],
    createdAt: "2024-01-22T00:00:00Z",
  },
  {
    id: "student-3",
    tenantId: "tenant-1",
    fullName: "Ahmet Koç",
    birthDate: "2015-11-08",
    status: "active",
    guardianIds: ["guardian-3"],
    educationTypeIds: ["et-2", "et-3"],
    notes: "Dikkate güçlük çekiyor.",
    createdAt: "2024-02-05T00:00:00Z",
  },
  {
    id: "student-4",
    tenantId: "tenant-1",
    fullName: "Selin Koç",
    birthDate: "2018-04-03",
    status: "active",
    guardianIds: ["guardian-3"],
    educationTypeIds: ["et-4"],
    createdAt: "2024-02-05T00:00:00Z",
  },
  {
    id: "student-5",
    tenantId: "tenant-1",
    fullName: "Nisa Çelik",
    birthDate: "2019-08-11",
    status: "on_hold",
    guardianIds: ["guardian-1"],
    educationTypeIds: ["et-3"],
    notes: "Aile geçici olarak devamsızlık bildirdi.",
    createdAt: "2024-03-10T00:00:00Z",
  },
];
