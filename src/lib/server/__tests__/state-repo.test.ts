import { describe, expect, it } from "vitest";
import { stripNul } from "@/lib/server/state-repo";

describe("stripNul", () => {
  it("drops the NUL character Postgres can't store, everywhere in the document", () => {
    const dirty = { students: [{ id: "1", fullName: "Ali\u0000 Veli", tags: ["a\u0000"] }], ["k\u0000"]: 1, n: 5, ok: null };
    expect(stripNul(dirty)).toEqual({ students: [{ id: "1", fullName: "Ali Veli", tags: ["a"] }], k: 1, n: 5, ok: null });
  });
});
