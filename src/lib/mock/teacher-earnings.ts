import type { TeacherEarning } from "@/types";

// ─── 13 Teacher Earnings ───────────────────────────────────────────────────────
//
// One earning per billable session (completed / no_show / makeup).
// May sessions → all paid.  June sessions → mix of paid & pending.
//
// Per-teacher summary:
//   teacher-1 Ayşe  : sessions 3,5,8,9,12,14  → paid 875 + pending 425 = 1 300 ₺
//   teacher-2 Mehmet: sessions 2,7,11,13,15    → paid 550 + pending 400 =   950 ₺
//   teacher-3 Elif D: sessions 4,10             → paid 250 + pending 250 =   500 ₺
//
export const mockTeacherEarnings: TeacherEarning[] = [
  // ── teacher-1 (Ayşe Yılmaz) ───────────────────────────────────────────────

  // session-3: Ahmet · Dil Terapisi · June 22 · PAID
  {
    id: "earning-1",
    tenantId: "tenant-1",
    teacherId: "teacher-1",
    sessionId: "session-3",
    amount: 225,
    status: "paid",
    paidAt: "2026-06-23T00:00:00Z",
    createdAt: "2026-06-22T00:00:00Z",
  },
  // session-5: Yusuf · Dil Terapisi · June 20 · PENDING
  {
    id: "earning-2",
    tenantId: "tenant-1",
    teacherId: "teacher-1",
    sessionId: "session-5",
    amount: 225,
    status: "pending",
    createdAt: "2026-06-20T00:00:00Z",
  },
  // session-8: Nisa · Dil Terapisi · June 17 · PAID (makeup)
  {
    id: "earning-3",
    tenantId: "tenant-1",
    teacherId: "teacher-1",
    sessionId: "session-8",
    amount: 225,
    status: "paid",
    paidAt: "2026-06-18T00:00:00Z",
    createdAt: "2026-06-17T00:00:00Z",
  },
  // session-9: Yusuf · Bireysel · June 16 · PENDING
  {
    id: "earning-4",
    tenantId: "tenant-1",
    teacherId: "teacher-1",
    sessionId: "session-9",
    amount: 200,
    status: "pending",
    createdAt: "2026-06-16T00:00:00Z",
  },
  // session-12: Yusuf · Bireysel · May 30 · PAID
  {
    id: "earning-5",
    tenantId: "tenant-1",
    teacherId: "teacher-1",
    sessionId: "session-12",
    amount: 200,
    status: "paid",
    paidAt: "2026-06-01T00:00:00Z",
    createdAt: "2026-05-30T00:00:00Z",
  },
  // session-14: Ahmet · Dil Terapisi · May 25 · PAID
  {
    id: "earning-6",
    tenantId: "tenant-1",
    teacherId: "teacher-1",
    sessionId: "session-14",
    amount: 225,
    status: "paid",
    paidAt: "2026-06-01T00:00:00Z",
    createdAt: "2026-05-25T00:00:00Z",
  },

  // ── teacher-2 (Mehmet Kara) ───────────────────────────────────────────────

  // session-2: Elif · Bireysel · June 23 · PENDING
  {
    id: "earning-7",
    tenantId: "tenant-1",
    teacherId: "teacher-2",
    sessionId: "session-2",
    amount: 200,
    status: "pending",
    createdAt: "2026-06-23T00:00:00Z",
  },
  // session-7: Ahmet · Grup Eğitimi · June 18 · PAID
  {
    id: "earning-8",
    tenantId: "tenant-1",
    teacherId: "teacher-2",
    sessionId: "session-7",
    amount: 150,
    status: "paid",
    paidAt: "2026-06-20T00:00:00Z",
    createdAt: "2026-06-18T00:00:00Z",
  },
  // session-11: Elif · Bireysel · June 09 · PENDING
  {
    id: "earning-9",
    tenantId: "tenant-1",
    teacherId: "teacher-2",
    sessionId: "session-11",
    amount: 200,
    status: "pending",
    createdAt: "2026-06-09T00:00:00Z",
  },
  // session-13: Elif · Bireysel · May 28 · PAID
  {
    id: "earning-10",
    tenantId: "tenant-1",
    teacherId: "teacher-2",
    sessionId: "session-13",
    amount: 200,
    status: "paid",
    paidAt: "2026-06-01T00:00:00Z",
    createdAt: "2026-05-28T00:00:00Z",
  },
  // session-15: Elif · Bireysel · May 10 · PAID
  {
    id: "earning-11",
    tenantId: "tenant-1",
    teacherId: "teacher-2",
    sessionId: "session-15",
    amount: 200,
    status: "paid",
    paidAt: "2026-05-15T00:00:00Z",
    createdAt: "2026-05-10T00:00:00Z",
  },

  // ── teacher-3 (Elif Demir) ────────────────────────────────────────────────

  // session-4: Selin · Özel Algı · June 22 · PENDING (no_show)
  {
    id: "earning-12",
    tenantId: "tenant-1",
    teacherId: "teacher-3",
    sessionId: "session-4",
    amount: 250,
    status: "pending",
    createdAt: "2026-06-22T00:00:00Z",
  },
  // session-10: Selin · Özel Algı · June 12 · PAID
  {
    id: "earning-13",
    tenantId: "tenant-1",
    teacherId: "teacher-3",
    sessionId: "session-10",
    amount: 250,
    status: "paid",
    paidAt: "2026-06-15T00:00:00Z",
    createdAt: "2026-06-12T00:00:00Z",
  },
];
