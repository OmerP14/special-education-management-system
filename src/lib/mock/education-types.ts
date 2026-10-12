import type { EducationType } from "@/types";

export const mockEducationTypes: EducationType[] = [
  {
    id: "et-1",
    tenantId: "tenant-1",
    name: "Bireysel Eğitim",
    description: "Öğrenciye özel birebir seans",
    color: "#2563eb",
    defaultStudentPrice: 400,
    status: "active",
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "et-2",
    tenantId: "tenant-1",
    name: "Grup Eğitimi",
    description: "2-4 kişilik küçük grup seansı",
    color: "#059669",
    defaultStudentPrice: 250,
    status: "active",
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "et-3",
    tenantId: "tenant-1",
    name: "Dil Terapisi",
    description: "Konuşma ve dil gelişimi seansı",
    color: "#d97706",
    defaultStudentPrice: 450,
    status: "active",
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "et-4",
    tenantId: "tenant-1",
    name: "Özel Algı Eğitimi",
    description: "Duyusal entegrasyon seansı",
    color: "#7c3aed",
    defaultStudentPrice: 500,
    status: "active",
    createdAt: "2024-01-01T00:00:00Z",
  },
];
