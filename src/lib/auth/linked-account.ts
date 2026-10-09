// ─── Accounts linked to a teacher/guardian record ────────────────────────────
//
// A login account linked to a teacher or guardian record takes its name and
// e-mail from that record — one source of truth, so the same person never
// shows two addresses. The record is edited (Öğretmenler / Veliler), and the
// account follows; the account form shows both fields read-only.

import type { Guardian, Teacher } from "@/types";
import type { Role } from "@/types/auth";
import type { AppUser } from "@/types/settings";
import { getRoleRecordScope } from "@/lib/auth/roles";

export interface LinkedRecord {
  kind: "teacher" | "guardian";
  id: string;
  fullName: string;
  email?: string;
}

export function getLinkedRecord(
  user: Pick<AppUser, "roleId" | "teacherId" | "guardianId">,
  roles: Role[],
  teachers: Teacher[],
  guardians: Guardian[]
): LinkedRecord | null {
  const scope = getRoleRecordScope(roles.find((r) => r.id === user.roleId));
  if (scope === "teacher" && user.teacherId) {
    const t = teachers.find((x) => x.id === user.teacherId);
    return t ? { kind: "teacher", id: t.id, fullName: t.fullName, email: t.email?.trim() || undefined } : null;
  }
  if (scope === "guardian" && user.guardianId) {
    const g = guardians.find((x) => x.id === user.guardianId);
    return g ? { kind: "guardian", id: g.id, fullName: g.fullName, email: g.email?.trim() || undefined } : null;
  }
  return null;
}

/** Copies name/e-mail from each linked record onto its account. An e-mail
 *  already used by another account is left alone (it would make sign-in
 *  ambiguous). Returns the same array when nothing changed. */
export function syncLinkedAccounts(
  users: AppUser[],
  roles: Role[],
  teachers: Teacher[],
  guardians: Guardian[]
): AppUser[] {
  let changed = false;
  const next = users.map((u) => {
    const record = getLinkedRecord(u, roles, teachers, guardians);
    if (!record) return u;
    const emailFree =
      !!record.email &&
      !users.some((o) => o.id !== u.id && o.email.toLowerCase() === record.email!.toLowerCase());
    const name = record.fullName;
    const email = emailFree ? record.email! : u.email;
    if (name === u.name && email === u.email) return u;
    changed = true;
    return { ...u, name, email };
  });
  return changed ? next : users;
}
