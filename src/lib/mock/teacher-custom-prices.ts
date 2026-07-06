import type { TeacherCustomPrice } from "@/types";

export const mockTeacherCustomPrices: TeacherCustomPrice[] = [
  {
    // Ayşe Kaya — Dil Terapisi özel fiyatı
    id: "tcp-1",
    tenantId: "tenant-1",
    teacherId: "teacher-1",
    educationTypeId: "et-3",
    customEarning: 275,
    createdAt: "2024-01-15T00:00:00Z",
  },
  {
    // Mehmet Demir — Bireysel Eğitim özel fiyatı
    id: "tcp-2",
    tenantId: "tenant-1",
    teacherId: "teacher-2",
    educationTypeId: "et-1",
    customEarning: 220,
    createdAt: "2024-02-01T00:00:00Z",
  },
  {
    // Mehmet Demir — Dil Terapisi özel fiyatı
    id: "tcp-3",
    tenantId: "tenant-1",
    teacherId: "teacher-2",
    educationTypeId: "et-3",
    customEarning: 250,
    createdAt: "2024-02-01T00:00:00Z",
  },
];
