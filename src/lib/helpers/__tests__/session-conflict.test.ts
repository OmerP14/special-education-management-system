import { describe, expect, it } from "vitest";
import { checkSessionConflict } from "@/lib/helpers/session-conflict";
import type { Session } from "@/types";

function session(overrides: Partial<Session>): Session {
  return {
    id: "s1",
    tenantId: "tenant-1",
    studentId: "student-1",
    teacherId: "teacher-1",
    educationTypeId: "et-1",
    date: "2026-03-02T10:00:00.000Z",
    durationMinutes: 40,
    sessionCount: 1,
    studentPrice: 500,
    teacherEarning: 250,
    status: "planned",
    createdAt: "2026-03-01T00:00:00.000Z",
    ...overrides,
  };
}

const base = {
  studentId: "student-1",
  teacherId: "teacher-1",
  durationMinutes: 40,
};

describe("checkSessionConflict", () => {
  it("passes when nothing overlaps", () => {
    const result = checkSessionConflict({
      ...base,
      sessions: [session({})],
      startsAt: "2026-03-02T10:40:00.000Z",
    });
    expect(result.hasConflict).toBe(false);
  });

  it("flags a partial overlap for the same student and teacher", () => {
    const result = checkSessionConflict({
      ...base,
      sessions: [session({})],
      startsAt: "2026-03-02T10:20:00.000Z",
    });
    expect(result.hasConflict).toBe(true);
    expect(result.conflictType).toBe("both");
  });

  it("identifies a teacher-only conflict", () => {
    const result = checkSessionConflict({
      ...base,
      studentId: "student-2",
      sessions: [session({})],
      startsAt: "2026-03-02T10:00:00.000Z",
    });
    expect(result.conflictType).toBe("teacher");
  });

  it("ignores cancelled and no-show sessions", () => {
    const result = checkSessionConflict({
      ...base,
      sessions: [session({ status: "cancelled" }), session({ id: "s2", status: "no_show" })],
      startsAt: "2026-03-02T10:00:00.000Z",
    });
    expect(result.hasConflict).toBe(false);
  });

  it("does not conflict with the session being edited", () => {
    const result = checkSessionConflict({
      ...base,
      sessions: [session({})],
      startsAt: "2026-03-02T10:00:00.000Z",
      excludeSessionId: "s1",
    });
    expect(result.hasConflict).toBe(false);
  });

  it("detects an exact duplicate", () => {
    const result = checkSessionConflict({
      ...base,
      sessions: [session({})],
      startsAt: "2026-03-02T10:00:00.000Z",
      educationTypeId: "et-1",
      fee: 500,
    });
    expect(result.isDuplicate).toBe(true);
    expect(result.message).toBe("Bu seans zaten mevcut.");
  });

  it("only blocks exact matches when partial overlap is allowed", () => {
    const partial = checkSessionConflict({
      ...base,
      sessions: [session({})],
      startsAt: "2026-03-02T10:20:00.000Z",
      blockPartialOverlap: false,
    });
    expect(partial.hasConflict).toBe(false);
  });

  it("is disabled entirely when both checks are turned off", () => {
    const result = checkSessionConflict({
      ...base,
      sessions: [session({})],
      startsAt: "2026-03-02T10:00:00.000Z",
      preventStudentConflict: false,
      preventTeacherConflict: false,
    });
    expect(result.hasConflict).toBe(false);
  });
});
