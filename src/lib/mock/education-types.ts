import type { EducationType } from "@/types";

export const mockEducationTypes: EducationType[] = [
  {
    id: "et-1",
    tenantId: "tenant-1",
    name: "Bireysel Eğitim",
    description: "Öğrenciye özel birebir seans",
    defaultStudentPrice: 400,
    defaultTeacherEarning: 200,
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "et-2",
    tenantId: "tenant-1",
    name: "Grup Eğitimi",
    description: "2-4 kişilik küçük grup seansı",
    defaultStudentPrice: 250,
    defaultTeacherEarning: 150,
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "et-3",
    tenantId: "tenant-1",
    name: "Dil Terapisi",
    description: "Konuşma ve dil gelişimi seansı",
    defaultStudentPrice: 450,
    defaultTeacherEarning: 225,
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "et-4",
    tenantId: "tenant-1",
    name: "Özel Algı Eğitimi",
    description: "Duyusal entegrasyon seansı",
    defaultStudentPrice: 500,
    defaultTeacherEarning: 250,
    createdAt: "2024-01-01T00:00:00Z",
  },
];
