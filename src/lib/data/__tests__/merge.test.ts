import { describe, expect, it } from "vitest";
import { mergeStates, stableStringify } from "@/lib/data/merge";
import type { PersistedState } from "@/lib/data/store";

// Builds a state with only the collections a test cares about.
function state(parts: Record<string, unknown>): PersistedState {
  return { students: [], sessions: [], institutionSettings: {}, ...parts } as unknown as PersistedState;
}

const s = (id: string, name: string) => ({ id, fullName: name });

describe("stableStringify", () => {
  it("ignores key order and undefined fields", () => {
    expect(stableStringify({ b: 1, a: { d: 2, c: undefined } })).toBe(stableStringify({ a: { d: 2 }, b: 1 }));
    expect(stableStringify([1, { y: 2, x: 1 }])).toBe('[1,{"x":1,"y":2}]');
  });
});

describe("mergeStates", () => {
  const base = state({ students: [s("1", "Ali"), s("2", "Ayşe")] });

  it("keeps both devices' new records", () => {
    const local = state({ students: [...base.students, s("3", "Can")] });
    const remote = state({ students: [...base.students, s("4", "Deniz")] });
    const merged = mergeStates(base, local, remote);
    expect(merged.students.map((x) => x.id)).toEqual(["1", "2", "4", "3"]);
  });

  it("applies this device's edits and deletes on top of the other device's", () => {
    const local = state({ students: [s("1", "Ali Kaya")] }); // edited 1, deleted 2
    const remote = state({ students: [s("1", "Ali"), s("2", "Ayşe Y."), s("5", "Ece")] }); // edited 2, added 5
    const merged = mergeStates(base, local, remote);
    expect(merged.students).toEqual([s("1", "Ali Kaya"), s("5", "Ece")]);
  });

  it("keeps the other device's edits to records this device didn't touch", () => {
    const local = state({ students: [s("1", "Ali"), s("2", "Ayşe"), s("3", "Can")] });
    const remote = state({ students: [s("1", "Ali Veli"), s("2", "Ayşe")] });
    expect(mergeStates(base, local, remote).students).toEqual([s("1", "Ali Veli"), s("2", "Ayşe"), s("3", "Can")]);
  });

  it("combines two devices' edits to different fields of the same record", () => {
    const b = state({ guardians: [{ id: "g", fullName: "Ali", phone: "1", address: "A" }] });
    const local = state({ guardians: [{ id: "g", fullName: "Ali", phone: "2", address: "A" }] });
    const remote = state({ guardians: [{ id: "g", fullName: "Ali", phone: "1", address: "B" }] });
    expect(mergeStates(b, local, remote).guardians).toEqual([{ id: "g", fullName: "Ali", phone: "2", address: "B" }]);
  });

  it("when both changed the same field, this device's value wins", () => {
    const b = state({ guardians: [{ id: "g", phone: "1", note: "x" }] });
    const local = state({ guardians: [{ id: "g", phone: "2" }] }); // also cleared the note
    const remote = state({ guardians: [{ id: "g", phone: "3", note: "x", city: "İst" }] });
    expect(mergeStates(b, local, remote).guardians).toEqual([{ id: "g", phone: "2", city: "İst" }]);
  });

  it("does not bring back a record the other device deleted", () => {
    const local = state({ students: [s("1", "Ali"), s("2", "Ayşe")] });
    const remote = state({ students: [s("1", "Ali")] });
    expect(mergeStates(base, local, remote).students).toEqual([s("1", "Ali")]);
  });

  it("gives this device's new receipt the next free number when the other device took it", () => {
    const pay = (id: string, seq: number) => ({ id, date: "2026-10-21", amount: 1, receiptSequence: seq, receiptNumber: `MKB-2026-${seq}` });
    const b = state({ payments: [pay("p0", 1000)] });
    const local = state({ payments: [pay("p0", 1000), pay("mine", 1001)] });
    const remote = state({ payments: [pay("p0", 1000), pay("theirs", 1001)] });
    const merged = mergeStates(b, local, remote).payments;
    expect(merged.find((p) => p.id === "theirs")?.receiptNumber).toBe("MKB-2026-1001");
    expect(merged.find((p) => p.id === "mine")?.receiptNumber).toBe("MKB-2026-1002");
  });

  it("re-numbers a clashing new student number too", () => {
    const st = (id: string, seq: number) => ({ id, fullName: id, createdAt: "2026-01-01", studentSequence: seq, studentNumber: `OGR-${String(seq).padStart(4, "0")}` });
    const local = state({ students: [st("mine", 1)] });
    const remote = state({ students: [st("theirs", 1)] });
    const merged = mergeStates(state({}), local, remote).students;
    expect(merged.map((x) => x.studentNumber).sort()).toEqual(["OGR-0001", "OGR-0002"]);
    expect(merged.find((x) => x.id === "theirs")?.studentNumber).toBe("OGR-0001");
  });

  it("merges settings per section", () => {
    const settings = (inst: string, ses: number, meta: Record<string, string> = {}) => ({
      institution: { name: inst },
      sessions: { breakMinutes: ses },
      metadata: meta,
    });
    const b = state({ institutionSettings: settings("A", 10) });
    const local = state({ institutionSettings: settings("B", 10, { institution: "local" }) });
    const remote = state({ institutionSettings: settings("A", 15, { sessions: "remote" }) });
    expect(mergeStates(b, local, remote).institutionSettings).toEqual(
      settings("B", 15, { institution: "local", sessions: "remote" })
    );
  });

  it("adds collections only one side has", () => {
    const local = state({ students: base.students, payments: [{ id: "p1", amount: 5 }] });
    expect(mergeStates(base, local, base).payments).toEqual([{ id: "p1", amount: 5 }]);
  });
});
