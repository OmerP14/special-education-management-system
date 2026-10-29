import { describe, expect, it } from "vitest";
import { foldLegacyGuardians } from "@/lib/data/migrate-guardians";
import type { Student } from "@/types";

// Data saved while guardians were separate records.
const legacy = (id: string, guardianIds: string[], extra: Partial<Student> = {}) =>
  ({ id, tenantId: "t", fullName: id, birthDate: "", status: "active", educationTypeIds: [], createdAt: "", guardianIds, ...extra }) as unknown as Student;

describe("foldLegacyGuardians", () => {
  const guardians = [
    { id: "g1", fullName: "Hatice Kaya", phone: "0532 111 22 33", studentIds: ["s1"] },
    { id: "g2", fullName: "Mehmet Demir", phone: "—", studentIds: ["s2", "s3"] },
  ];

  it("copies the primary guardian's name and phone onto the student and drops the link", () => {
    const [ali] = foldLegacyGuardians([legacy("s1", ["g1"])], guardians);
    expect(ali).toMatchObject({ guardianName: "Hatice Kaya", guardianPhone: "0532 111 22 33" });
    expect("guardianIds" in ali!).toBe(false);
  });

  it("finds the guardian from its own student list too, and ignores the '—' placeholder phone", () => {
    const [zeynep] = foldLegacyGuardians([legacy("s3", [])], guardians);
    expect(zeynep).toMatchObject({ guardianName: "Mehmet Demir", guardianPhone: undefined });
  });

  it("never overwrites fields already on the student, and leaves new-style students alone", () => {
    const [kept] = foldLegacyGuardians([legacy("s1", ["g1"], { guardianName: "Yeni Veli" })], guardians);
    expect(kept!.guardianName).toBe("Yeni Veli");
    const modern = { id: "x", tenantId: "t", fullName: "x", birthDate: "", status: "active", educationTypeIds: [], createdAt: "" } as Student;
    expect(foldLegacyGuardians([modern], guardians)[0]).toBe(modern);
  });
});
