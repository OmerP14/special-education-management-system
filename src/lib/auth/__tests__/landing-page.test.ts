import { describe, expect, it } from "vitest";
import { resolvePostLoginPath } from "@/lib/settings/landing-page";

describe("resolvePostLoginPath", () => {
  it("honours an in-app ?next=", () => {
    expect(resolvePostLoginPath("/app/students", "dashboard")).toBe("/app/students");
  });

  it("never follows ?next= off the app", () => {
    for (const next of ["https://kotusite.com", "//kotusite.com", "/login", "/apps-evil"]) {
      expect(resolvePostLoginPath(next, "dashboard")).toBe("/app/dashboard");
    }
  });

  it("falls back to the institution's landing page", () => {
    expect(resolvePostLoginPath(null, "calendar")).toBe("/app/calendar");
    expect(resolvePostLoginPath(null, "sessions")).toBe("/app/sessions");
  });
});
