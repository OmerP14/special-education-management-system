import type { PersistedState } from "@/lib/data/store";
import type { Payment, Student } from "@/types";
import { assignReceiptNumber } from "@/lib/helpers/finance-rules";
import { assignStudentNumber } from "@/lib/helpers/student-rules";
import { normalizeInstitutionSettings } from "@/lib/settings/defaults";

// ─── Merging two devices' changes ───────────────────────────────────────────
//
// The whole state is saved as one document with a version number. When a
// save finds that another device saved first, this device's changes are
// replayed onto the newer state instead of overwriting it:
//
//   base   — the state this device last loaded/saved (the common ancestor)
//   local  — this device's state now
//   remote — what the other device saved
//
// Records are matched by `id`: a record this device added or edited replaces
// the remote one, a record it deleted is removed, everything else comes from
// the remote state. Settings merge per section the same way. When both
// devices edited the same record, their edits are combined field by field;
// only a field both of them changed takes this device's value.
//
// Receipt and student numbers are handed out on the device, so two devices
// adding at the same moment can pick the same one; a record this device added
// whose number is already taken gets the next free one.

type Json = unknown;

/** JSON with object keys sorted, so equal data gives equal text no matter how
 *  it was built (Postgres jsonb, for one, reorders keys). */
export function stableStringify(value: Json): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((v) => (v === undefined ? "null" : stableStringify(v))).join(",")}]`;
  const entries = Object.keys(value as Record<string, Json>)
    .filter((k) => (value as Record<string, Json>)[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, Json>)[k])}`);
  return `{${entries.join(",")}}`;
}

const same = (a: Json, b: Json) => stableStringify(a) === stableStringify(b);

type WithId = { id: string };

/** Both sides edited one record: start from the remote version and apply
 *  only the fields this device changed. */
function mergeFields(base: WithId, local: WithId, remote: WithId): WithId {
  const b = base as Record<string, unknown>;
  const l = local as Record<string, unknown>;
  const out: Record<string, unknown> = { ...(remote as Record<string, unknown>) };
  for (const key of new Set([...Object.keys(b), ...Object.keys(l)])) {
    if (same(l[key], b[key])) continue;
    if (l[key] === undefined) delete out[key];
    else out[key] = l[key];
  }
  return out as WithId;
}

function hasIds(list: unknown): list is WithId[] {
  return Array.isArray(list) && list.every((r) => r && typeof r === "object" && typeof (r as WithId).id === "string");
}

function mergeRecords(base: unknown, local: unknown, remote: unknown): unknown {
  if (!hasIds(base) || !hasIds(local) || !hasIds(remote)) {
    // Not a list of records: take this device's value if it changed it.
    return same(local, base) ? remote : local;
  }
  const baseById = new Map(base.map((r) => [r.id, r]));
  const localIds = new Set(local.map((r) => r.id));
  const changed = new Map<string, WithId>();
  for (const r of local) {
    const before = baseById.get(r.id);
    if (!before || !same(before, r)) changed.set(r.id, r);
  }
  const deleted = new Set(base.filter((r) => !localIds.has(r.id)).map((r) => r.id));

  const result: WithId[] = [];
  const placed = new Set<string>();
  for (const r of remote) {
    if (deleted.has(r.id)) continue;
    const mine = changed.get(r.id);
    const before = baseById.get(r.id);
    result.push(!mine ? r : before && !same(before, r) ? mergeFields(before, mine, r) : mine);
    placed.add(r.id);
  }
  for (const r of local) {
    if (changed.has(r.id) && !placed.has(r.id) && !baseById.has(r.id)) result.push(r);
  }
  return result;
}

function mergeSettings(base: unknown, local: unknown, remote: unknown): unknown {
  if (!base || !local || !remote || typeof local !== "object" || typeof remote !== "object" || typeof base !== "object") {
    return same(local, base) ? remote : local;
  }
  const out: Record<string, unknown> = { ...(remote as Record<string, unknown>) };
  for (const [section, value] of Object.entries(local as Record<string, unknown>)) {
    if (section === "metadata") continue;
    if (!same(value, (base as Record<string, unknown>)[section])) out[section] = value;
  }
  // Each section's "last changed" stamp follows whichever side it came from.
  const meta = (s: unknown) => ((s as { metadata?: Record<string, unknown> }).metadata ?? {}) as Record<string, unknown>;
  const metadata = { ...meta(remote) };
  for (const section of Object.keys(local as Record<string, unknown>)) {
    if (section !== "metadata" && out[section] === (local as Record<string, unknown>)[section] && meta(local)[section]) {
      metadata[section] = meta(local)[section];
    }
  }
  out.metadata = metadata;
  return out;
}

/** Re-numbers this device's new records whose number another record holds. */
function fixNumberClashes(merged: PersistedState, local: PersistedState, base: PersistedState, remote: PersistedState): PersistedState {
  const isNew = (id: string, ...lists: { id: string }[][]) => lists.every((l) => !l.some((r) => r.id === id));

  let payments = merged.payments ?? [];
  for (const p of local.payments ?? []) {
    if (!p.receiptNumber || !isNew(p.id, base.payments ?? [], remote.payments ?? [])) continue;
    const others = payments.filter((x) => x.id !== p.id);
    if (!others.some((x) => x.receiptNumber === p.receiptNumber)) continue;
    const renumbered = assignReceiptNumber({ ...p, receiptNumber: undefined, receiptSequence: undefined } as Payment, others);
    payments = payments.map((x) => (x.id === p.id ? renumbered : x));
  }

  const studentSettings = normalizeInstitutionSettings(merged.institutionSettings).students;
  let students = merged.students ?? [];
  for (const st of local.students ?? []) {
    if (!st.studentNumber || !isNew(st.id, base.students ?? [], remote.students ?? [])) continue;
    const others = students.filter((x) => x.id !== st.id);
    if (!others.some((x) => x.studentNumber === st.studentNumber)) continue;
    const renumbered = assignStudentNumber({ ...st, studentNumber: undefined, studentSequence: undefined } as Student, others, {
      ...studentSettings,
      autoGenerateStudentNumber: true,
    });
    students = students.map((x) => (x.id === st.id ? renumbered : x));
  }
  return { ...merged, payments, students };
}

export function mergeStates(base: PersistedState, local: PersistedState, remote: PersistedState): PersistedState {
  const out: Record<string, unknown> = { ...remote };
  const b = base as unknown as Record<string, unknown>;
  const r = remote as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(local as unknown as Record<string, unknown>)) {
    out[key] = key === "institutionSettings" ? mergeSettings(b[key], value, r[key]) : mergeRecords(b[key] ?? [], value, r[key] ?? []);
  }
  return fixNumberClashes(out as unknown as PersistedState, local, base, remote);
}
