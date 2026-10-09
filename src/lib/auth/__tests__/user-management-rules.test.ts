import { describe, expect, it } from "vitest";
import { canAssignRole, canDeactivateUser, canEditUser, canSaveRole } from "@/lib/auth/user-management-rules";
import { SYSTEM_ROLES } from "@/lib/auth/roles";
import type { Role } from "@/types/auth";
import type { AppUser } from "@/types/settings";

const [OWNER, ADMIN, TEACHER] = SYSTEM_ROLES;
const custom: Role = { ...TEACHER, id: "role-custom", key: "custom", isSystemRole: false, permissions: ["students.view"] };
const roles = [...SYSTEM_ROLES, custom];
const u = (id: string, roleId: string, status: AppUser["status"] = "active") =>
  ({ id, roleId, status, name: id, email: id, tenantId: "t", createdAt: "" }) as AppUser;

const owner = u("owner", OWNER.id);
const mudur = u("mudur", ADMIN.id);
const teacher = u("teacher", TEACHER.id);
const users = [owner, mudur, teacher];
const asOwner = { userId: "owner", role: OWNER };
const asMudur = { userId: "mudur", role: ADMIN };

describe("user management rules", () => {
  it("Müdür can't make anyone (incl. themselves) an owner", () => {
    expect(canAssignRole(asMudur, teacher, OWNER, users, roles)).toContain("yalnızca bir sahip");
    expect(canAssignRole(asMudur, null, OWNER, users, roles)).toContain("yalnızca bir sahip");
  });

  it("nobody changes their own role", () => {
    expect(canAssignRole(asMudur, mudur, TEACHER, users, roles)).toContain("Kendi rolünüzü");
  });

  it("Müdür can't edit or demote an owner", () => {
    expect(canEditUser(asMudur, owner, roles)).toContain("Sahip hesaplarını");
    expect(canAssignRole(asMudur, owner, ADMIN, users, roles)).toContain("Sahip hesaplarını");
    expect(canDeactivateUser(asMudur, owner, users, roles)).toContain("Sahip hesaplarını");
  });

  it("the sole active owner can't be demoted, even by another owner; a second owner unlocks it", () => {
    const owner2 = u("owner2", OWNER.id);
    expect(canAssignRole({ userId: "owner2", role: OWNER }, owner, ADMIN, users, roles)).toContain("Tek aktif sahib");
    expect(canAssignRole({ userId: "owner2", role: OWNER }, owner, ADMIN, [...users, owner2], roles)).toBeNull();
  });

  it("nobody deactivates themselves", () => {
    expect(canDeactivateUser(asOwner, owner, users, roles)).toContain("Kendi hesabınızı");
  });

  it("Müdür can still manage ordinary users and roles", () => {
    expect(canAssignRole(asMudur, teacher, custom, users, roles)).toBeNull();
    expect(canAssignRole(asMudur, null, TEACHER, users, roles)).toBeNull();
    expect(canDeactivateUser(asMudur, teacher, users, roles)).toBeNull();
    expect(canSaveRole(asMudur, custom, ["students.view", "sessions.view"])).toBeNull();
  });

  it("Müdür can't grant itself (or any role) a permission it lacks", () => {
    expect(canSaveRole(asMudur, ADMIN, [...ADMIN.permissions, "settings.security.manage"])).toContain("Kendi rolünüzü");
    expect(canSaveRole(asMudur, custom, ["settings.security.manage"])).toContain("Sahip olmadığınız");
    expect(canSaveRole(asMudur, null, ["settings.security.manage"])).toContain("Sahip olmadığınız");
    expect(canSaveRole(asMudur, OWNER, [])).toContain("Sahip rolünü");
  });

  it("an owner can do all of it", () => {
    expect(canSaveRole(asOwner, ADMIN, [...ADMIN.permissions, "settings.security.manage"])).toBeNull();
    expect(canAssignRole(asOwner, mudur, OWNER, users, roles)).toBeNull();
  });
});
