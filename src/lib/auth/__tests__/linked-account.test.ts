import { describe, expect, it } from "vitest";
import { getLinkedRecord, syncLinkedAccounts } from "@/lib/auth/linked-account";
import { SYSTEM_ROLES } from "@/lib/auth/roles";
import type { Guardian, Teacher } from "@/types";
import type { AppUser } from "@/types/settings";

const teachers = [{ id: "t1", fullName: "Ayşe Kaya", email: "ayse@kurum.com" }] as Teacher[];
const guardians = [
  { id: "g1", fullName: "Ahmet Yıldırım", email: "ahmet@gmail.com" },
  { id: "g2", fullName: "E-postasız Veli", email: "" },
] as Guardian[];
const u = (over: Partial<AppUser>) => ({ id: "u", tenantId: "t", name: "x", email: "x", roleId: "role-guardian", status: "active", createdAt: "", ...over }) as AppUser;

describe("linked accounts", () => {
  it("a guardian/teacher account takes name and e-mail from its record", () => {
    const users = [u({ id: "a", guardianId: "g1", name: "Eski", email: "veli" }), u({ id: "b", roleId: "role-teacher", teacherId: "t1" })];
    const out = syncLinkedAccounts(users, SYSTEM_ROLES, teachers, guardians);
    expect(out.map((x) => [x.name, x.email])).toEqual([["Ahmet Yıldırım", "ahmet@gmail.com"], ["Ayşe Kaya", "ayse@kurum.com"]]);
  });

  it("keeps the account e-mail when the record has none", () => {
    const out = syncLinkedAccounts([u({ guardianId: "g2", email: "elle@kurum.com" })], SYSTEM_ROLES, teachers, guardians);
    expect(out[0]).toMatchObject({ name: "E-postasız Veli", email: "elle@kurum.com" });
  });

  it("never takes an e-mail another account already signs in with", () => {
    const users = [u({ id: "a", guardianId: "g1", email: "veli" }), u({ id: "b", roleId: "role-admin", email: "ahmet@gmail.com" })];
    expect(syncLinkedAccounts(users, SYSTEM_ROLES, teachers, guardians)[0].email).toBe("veli");
  });

  it("ignores links that don't match the role's scope, and unlinked staff", () => {
    expect(getLinkedRecord(u({ roleId: "role-admin", guardianId: "g1" }), SYSTEM_ROLES, teachers, guardians)).toBeNull();
    const users = [u({ roleId: "role-admin", name: "Müdür", email: "mudur" })];
    expect(syncLinkedAccounts(users, SYSTEM_ROLES, teachers, guardians)).toBe(users);
  });
});
