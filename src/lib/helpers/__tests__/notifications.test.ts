import { describe, expect, it } from "vitest";
import { getVisibleNotifications, type AppNotification } from "@/lib/helpers/notifications";
import { SYSTEM_ROLES } from "@/lib/auth/roles";
import type { CurrentUserScope } from "@/lib/auth/scope";

const perms = (key: string) => SYSTEM_ROLES.find((r) => r.key === key)!.permissions;
const unrestricted: CurrentUserScope = { isUnrestricted: true, teacherId: null, guardianId: null, linkedStudentIds: [] };
const teacherScope: CurrentUserScope = { isUnrestricted: false, teacherId: "teacher-1", guardianId: null, linkedStudentIds: [] };

const n = (event: AppNotification["event"], extra: Partial<AppNotification> = {}): AppNotification => ({
  id: event, event, title: event, message: "", createdAt: "2026-01-01T00:00:00Z", ...extra,
});
const all = [
  n("user_invited", { staffOnly: true }),
  n("payment_received", { studentId: "s1" }),
  n("session_cancelled", { teacherId: "teacher-1", studentId: "s1" }),
  n("teacher_earning_created", { teacherId: "teacher-1" }),
];
const events = (list: AppNotification[]) => list.map((x) => x.event).sort();

describe("getVisibleNotifications", () => {
  it("owner sees every event", () => {
    expect(getVisibleNotifications(all, unrestricted, perms("owner"))).toHaveLength(4);
  });

  it("a staff role only sees events of modules it can open", () => {
    // e.g. a custom front-desk role: sessions only, no finance, no user management
    const frontDesk = ["notifications.view", "sessions.view"] as never[];
    expect(events(getVisibleNotifications(all, unrestricted, frontDesk))).toEqual(["session_cancelled"]);
  });

  it("user invitations need user management permission", () => {
    expect(events(getVisibleNotifications(all, unrestricted, perms("admin")))).toContain("user_invited");
    const withoutUsers = perms("admin").filter((k) => k !== "settings.users.manage");
    expect(events(getVisibleNotifications(all, unrestricted, withoutUsers))).not.toContain("user_invited");
  });

  it("teacher sees own session and earning events only", () => {
    expect(events(getVisibleNotifications(all, teacherScope, perms("teacher")))).toEqual(["session_cancelled", "teacher_earning_created"]);
  });

  it("no notifications.view, no notifications", () => {
    expect(getVisibleNotifications(all, unrestricted, ["sessions.view"] as never[])).toEqual([]);
  });
});
