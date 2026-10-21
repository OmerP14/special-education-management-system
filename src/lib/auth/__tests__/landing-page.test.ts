import { describe, expect, it } from "vitest";
import { resolvePostLoginPath } from "@/lib/settings/landing-page";

describe("resolvePostLoginPath", () => {
  it("honours an in-app ?next=", () => {
    expect(resolvePostLoginPath("/app/students")).toBe("/app/students");
  });

  it("never follows ?next= off the app", () => {
    for (const next of ["https://kotusite.com", "//kotusite.com", "/login", "/apps-evil"]) {
      expect(resolvePostLoginPath(next)).toBe("/app/dashboard");
    }
  });

  it("falls back to the dashboard", () => {
    expect(resolvePostLoginPath(null)).toBe("/app/dashboard");
  });
});
