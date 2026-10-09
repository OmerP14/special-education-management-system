import { describe, expect, it } from "vitest";
import { resolvePostLoginPath } from "@/lib/settings/landing-page";
import type { PermissionKey } from "@/types/auth";

const guardian = ["dashboard.view", "students.view"] as PermissionKey[];
const staff = ["dashboard.view", "students.view", "calendar.view", "sessions.view"] as PermissionKey[];

describe("resolvePostLoginPath", () => {
  it("honours an in-app ?next= the user may open", () => {
    expect(resolvePostLoginPath("/app/students", "dashboard", staff)).toBe("/app/students");
  });

  it("never follows ?next= off the app", () => {
    for (const next of ["https://kotusite.com", "//kotusite.com", "/login", "/apps-evil"]) {
      expect(resolvePostLoginPath(next, "dashboard", staff)).toBe("/app/dashboard");
    }
  });

  it("skips a ?next= page the user has no permission for", () => {
    expect(resolvePostLoginPath("/app/calendar", "dashboard", guardian)).toBe("/app/dashboard");
  });

  it("falls back to the dashboard when the landing page is off-limits", () => {
    expect(resolvePostLoginPath(null, "calendar", guardian)).toBe("/app/dashboard");
    expect(resolvePostLoginPath(null, "calendar", staff)).toBe("/app/calendar");
  });
});
