// ─── Record identity ────────────────────────────────────────────────────────
//
// Every record id and the institution id come from here, so a backend can
// take them over in one place.

/** The one institution this installation serves. A multi-institution backend
 *  sets this from the signed-in account instead. */
export const TENANT_ID = "tenant-1";

/** A new, globally unique record id: "<prefix>-<uuid>". Unique across devices
 *  and across fast repeated saves — never derived from the clock. */
export function createId(prefix: string): string {
  return `${prefix}-${uuid()}`;
}

function uuid(): string {
  const c = globalThis.crypto;
  // randomUUID exists only in secure contexts (https, localhost).
  if (typeof c?.randomUUID === "function") return c.randomUUID();
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
