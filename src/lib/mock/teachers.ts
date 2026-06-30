import type { Teacher } from "@/types";

// ─── 3 Teachers (all active) ───────────────────────────────────────────────────
export const mockTeachers: Teacher[] = [
  {
    id: "teacher-1",
    tenantId: "tenant-1",
    fullName: "Ayşe Yılmaz",
    phone: "0532 111 22 33",
    email: "ayse.yilmaz@example.com",
    status: "active",
    specializations: ["et-1", "et-3"],
    createdAt: "2024-01-10T00:00:00Z",
  },
  {
    id: "teacher-2",
    tenantId: "tenant-1",
    fullName: "Mehmet Kara",
    phone: "0533 222 33 44",
    email: "mehmet.kara@example.com",
    status: "active",
    specializations: ["et-1", "et-2"],
    createdAt: "2024-01-15T00:00:00Z",
  },
  {
    id: "teacher-3",
    tenantId: "tenant-1",
    fullName: "Elif Demir",
    phone: "0535 333 44 55",
    email: "elif.demir@example.com",
    status: "active",
    specializations: ["et-4"],
    createdAt: "2024-02-01T00:00:00Z",
  },
];
