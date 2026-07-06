import type { Teacher } from "@/types";

export const mockTeachers: Teacher[] = [
  {
    id: "teacher-1",
    tenantId: "tenant-1",
    fullName: "Ayşe Kaya",
    phone: "05321234567",
    email: "ayse.kaya@egitim.com",
    status: "active",
    specializations: ["et-3"], // Dil Terapisi
    earningType: "per_session",
    notes: "Lisanslı dil ve konuşma terapisti.",
    createdAt: "2024-01-15T00:00:00Z",
  },
  {
    id: "teacher-2",
    tenantId: "tenant-1",
    fullName: "Mehmet Demir",
    phone: "05339876543",
    email: "mehmet.demir@egitim.com",
    status: "active",
    specializations: ["et-1", "et-3"], // Bireysel Eğitim + Dil Terapisi
    earningType: "per_session",
    createdAt: "2024-02-01T00:00:00Z",
  },
  {
    id: "teacher-3",
    tenantId: "tenant-1",
    fullName: "Fatma Yıldız",
    phone: "05445556677",
    status: "active",
    specializations: ["et-4"], // Özel Algı Eğitimi
    earningType: "salary_plus_quota",
    monthlySalary: 15000,
    includedSessionQuota: 20,
    extraSessionEarning: 600,
    notes: "Duyusal entegrasyon sertifikalı.",
    createdAt: "2024-03-01T00:00:00Z",
  },
  {
    id: "teacher-4",
    tenantId: "tenant-1",
    fullName: "Ahmet Çelik",
    phone: "05557778899",
    status: "active",
    specializations: ["et-1", "et-2"], // Bireysel Eğitim + Grup Eğitimi
    earningType: "percentage",
    earningPercentage: 50,
    createdAt: "2024-04-01T00:00:00Z",
  },
  {
    id: "teacher-5",
    tenantId: "tenant-1",
    fullName: "Zeynep Arslan",
    phone: "05668889900",
    status: "inactive",
    specializations: ["et-2"], // Grup Eğitimi
    earningType: "per_session",
    createdAt: "2024-01-20T00:00:00Z",
  },
];
