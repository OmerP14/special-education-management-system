import type { Session } from "@/types";

// ─── 15 Sessions – June & May 2026 ────────────────────────────────────────────
//
// Status mix  : 9 completed · 2 planned · 1 no_show · 1 makeup · 1 cancelled
// Billable    : completed + no_show + makeup = 12 sessions drive debt calculations
//
// Per-student billable totals (used to verify debt):
//   student-1  Yusuf   : s5(450) + s9(400) + s12(400)          = 1 250 ₺
//   student-2  Elif    : s2(400) + s11(400) + s13(400) + s15(400) = 1 600 ₺
//   student-3  Ahmet   : s3(450) + s7(250) + s14(450)          = 1 150 ₺
//   student-4  Selin   : s4(500) + s10(500)                    = 1 000 ₺
//   student-5  Nisa    : s8(450)                               =   450 ₺
//
export const mockSessions: Session[] = [
  // ── June 2026 ─────────────────────────────────────────────────────────────

  // session-1: Yusuf · Ayşe · Bireysel · PLANNED (upcoming)
  {
    id: "session-1",
    tenantId: "tenant-1",
    studentId: "student-1",
    teacherId: "teacher-1",
    educationTypeId: "et-1",
    date: "2026-06-25T09:00:00Z",
    durationMinutes: 50,
    sessionCount: 1,
    studentPrice: 400,
    teacherEarning: 200,
    status: "planned",
    createdAt: "2026-06-22T00:00:00Z",
  },

  // session-2: Elif · Mehmet · Bireysel · COMPLETED
  {
    id: "session-2",
    tenantId: "tenant-1",
    studentId: "student-2",
    teacherId: "teacher-2",
    educationTypeId: "et-1",
    date: "2026-06-23T10:00:00Z",
    durationMinutes: 50,
    sessionCount: 1,
    studentPrice: 400,
    teacherEarning: 200,
    status: "completed",
    createdAt: "2026-06-20T00:00:00Z",
  },

  // session-3: Ahmet · Ayşe · Dil Terapisi · COMPLETED
  {
    id: "session-3",
    tenantId: "tenant-1",
    studentId: "student-3",
    teacherId: "teacher-1",
    educationTypeId: "et-3",
    date: "2026-06-22T11:00:00Z",
    durationMinutes: 50,
    sessionCount: 1,
    studentPrice: 450,
    teacherEarning: 225,
    status: "completed",
    createdAt: "2026-06-19T00:00:00Z",
  },

  // session-4: Selin · Elif D. · Özel Algı · NO_SHOW (billable)
  {
    id: "session-4",
    tenantId: "tenant-1",
    studentId: "student-4",
    teacherId: "teacher-3",
    educationTypeId: "et-4",
    date: "2026-06-22T13:00:00Z",
    durationMinutes: 50,
    sessionCount: 1,
    studentPrice: 500,
    teacherEarning: 250,
    status: "no_show",
    createdAt: "2026-06-19T00:00:00Z",
  },

  // session-5: Yusuf · Ayşe · Dil Terapisi · COMPLETED
  {
    id: "session-5",
    tenantId: "tenant-1",
    studentId: "student-1",
    teacherId: "teacher-1",
    educationTypeId: "et-3",
    date: "2026-06-20T09:00:00Z",
    durationMinutes: 50,
    sessionCount: 1,
    studentPrice: 450,
    teacherEarning: 225,
    status: "completed",
    createdAt: "2026-06-17T00:00:00Z",
  },

  // session-6: Elif · Mehmet · Bireysel · CANCELLED (not billable)
  {
    id: "session-6",
    tenantId: "tenant-1",
    studentId: "student-2",
    teacherId: "teacher-2",
    educationTypeId: "et-1",
    date: "2026-06-19T10:00:00Z",
    durationMinutes: 50,
    sessionCount: 1,
    studentPrice: 400,
    teacherEarning: 200,
    status: "cancelled",
    createdAt: "2026-06-17T00:00:00Z",
  },

  // session-7: Ahmet · Mehmet · Grup Eğitimi · COMPLETED
  {
    id: "session-7",
    tenantId: "tenant-1",
    studentId: "student-3",
    teacherId: "teacher-2",
    educationTypeId: "et-2",
    date: "2026-06-18T14:00:00Z",
    durationMinutes: 50,
    sessionCount: 1,
    studentPrice: 250,
    teacherEarning: 150,
    status: "completed",
    createdAt: "2026-06-15T00:00:00Z",
  },

  // session-8: Nisa · Ayşe · Dil Terapisi · MAKEUP (billable)
  {
    id: "session-8",
    tenantId: "tenant-1",
    studentId: "student-5",
    teacherId: "teacher-1",
    educationTypeId: "et-3",
    date: "2026-06-17T11:00:00Z",
    durationMinutes: 50,
    sessionCount: 1,
    studentPrice: 450,
    teacherEarning: 225,
    status: "makeup",
    createdAt: "2026-06-14T00:00:00Z",
  },

  // session-9: Yusuf · Ayşe · Bireysel · COMPLETED
  {
    id: "session-9",
    tenantId: "tenant-1",
    studentId: "student-1",
    teacherId: "teacher-1",
    educationTypeId: "et-1",
    date: "2026-06-16T09:00:00Z",
    durationMinutes: 50,
    sessionCount: 1,
    studentPrice: 400,
    teacherEarning: 200,
    status: "completed",
    createdAt: "2026-06-13T00:00:00Z",
  },

  // session-10: Selin · Elif D. · Özel Algı · COMPLETED
  {
    id: "session-10",
    tenantId: "tenant-1",
    studentId: "student-4",
    teacherId: "teacher-3",
    educationTypeId: "et-4",
    date: "2026-06-12T13:00:00Z",
    durationMinutes: 50,
    sessionCount: 1,
    studentPrice: 500,
    teacherEarning: 250,
    status: "completed",
    createdAt: "2026-06-09T00:00:00Z",
  },

  // session-11: Elif · Mehmet · Bireysel · COMPLETED
  {
    id: "session-11",
    tenantId: "tenant-1",
    studentId: "student-2",
    teacherId: "teacher-2",
    educationTypeId: "et-1",
    date: "2026-06-09T10:00:00Z",
    durationMinutes: 50,
    sessionCount: 1,
    studentPrice: 400,
    teacherEarning: 200,
    status: "completed",
    createdAt: "2026-06-06T00:00:00Z",
  },

  // ── May 2026 ──────────────────────────────────────────────────────────────

  // session-12: Yusuf · Ayşe · Bireysel · COMPLETED
  {
    id: "session-12",
    tenantId: "tenant-1",
    studentId: "student-1",
    teacherId: "teacher-1",
    educationTypeId: "et-1",
    date: "2026-05-30T09:00:00Z",
    durationMinutes: 50,
    sessionCount: 1,
    studentPrice: 400,
    teacherEarning: 200,
    status: "completed",
    createdAt: "2026-05-27T00:00:00Z",
  },

  // session-13: Elif · Mehmet · Bireysel · COMPLETED
  {
    id: "session-13",
    tenantId: "tenant-1",
    studentId: "student-2",
    teacherId: "teacher-2",
    educationTypeId: "et-1",
    date: "2026-05-28T10:00:00Z",
    durationMinutes: 50,
    sessionCount: 1,
    studentPrice: 400,
    teacherEarning: 200,
    status: "completed",
    createdAt: "2026-05-25T00:00:00Z",
  },

  // session-14: Ahmet · Ayşe · Dil Terapisi · COMPLETED
  {
    id: "session-14",
    tenantId: "tenant-1",
    studentId: "student-3",
    teacherId: "teacher-1",
    educationTypeId: "et-3",
    date: "2026-05-25T11:00:00Z",
    durationMinutes: 50,
    sessionCount: 1,
    studentPrice: 450,
    teacherEarning: 225,
    status: "completed",
    createdAt: "2026-05-22T00:00:00Z",
  },

  // session-15: Elif · Mehmet · Bireysel · COMPLETED
  {
    id: "session-15",
    tenantId: "tenant-1",
    studentId: "student-2",
    teacherId: "teacher-2",
    educationTypeId: "et-1",
    date: "2026-05-10T10:00:00Z",
    durationMinutes: 50,
    sessionCount: 1,
    studentPrice: 400,
    teacherEarning: 200,
    status: "completed",
    createdAt: "2026-05-07T00:00:00Z",
  },
];
