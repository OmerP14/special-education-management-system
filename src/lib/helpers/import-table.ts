// ─── Plain-table clean-up (Excel Import) ────────────────────────────────────
// A "row = record" sheet as people actually keep it: a title or logo rows above
// the header, merged header cells, two-row headers, empty or unnamed columns,
// the header repeated further down (printed pages). normalizeTableSheet turns
// that into headers + data rows; prepareSheetsForImport applies it to every
// sheet except the per-student lesson ledgers, which read the raw layout
// themselves (see student-ledger-import.ts).

import {
  cellToDisplayString,
  parseCellAsDateString,
  parseCellAsNumber,
  type ParsedSheet,
  type RawCell,
} from "@/lib/helpers/import-parse";
import {
  detectStudentLedgerWorkbook,
  isBlankTemplateSheetName,
  isLikelyStudentLedgerSheet,
  isRosterSheetName,
  ledgerSheetStudentName,
} from "@/lib/helpers/student-ledger-import";

/** Rows searched for the header row. */
const HEADER_SCAN_ROWS = 15;

const isEmpty = (c: RawCell) => cellToDisplayString(c) === "";

function isLabelCell(c: RawCell): boolean {
  if (typeof c !== "string") return false;
  const s = cellToDisplayString(c);
  return s !== "" && s.length <= 60 && parseCellAsNumber(s) === null && parseCellAsDateString(s) === null;
}

/** Spreadsheet column letter for a 0-based index (0 → A, 27 → AB). */
export function columnLetter(index: number): string {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/** Copies merged values: across columns everywhere (a merged header spans its
 *  columns) and down rows only for text — a merged amount copied into three
 *  rows would be counted three times. */
function fillMerges(grid: RawCell[][], merges: ParsedSheet["merges"]): RawCell[][] {
  const out = grid.map((r) => [...r]);
  for (const m of merges ?? []) {
    const value = out[m.s.r]?.[m.s.c];
    if (value === undefined || isEmpty(value)) continue;
    const fillDown = typeof value === "string" && parseCellAsNumber(value) === null;
    for (let r = m.s.r; r <= m.e.r; r++) {
      if (r !== m.s.r && !fillDown) continue;
      const row = out[r];
      if (!row) continue;
      for (let c = m.s.c; c <= m.e.c; c++) if (isEmpty(row[c])) row[c] = value;
    }
  }
  return out;
}

/** Index (in grid) of the row that most looks like the header: several
 *  distinct short labels with data under them. */
export function detectHeaderRowIndex(grid: RawCell[][]): number {
  let best = 0;
  let bestScore = -Infinity;
  const limit = Math.min(grid.length, HEADER_SCAN_ROWS);
  for (let r = 0; r < limit; r++) {
    const row = grid[r] ?? [];
    const filled = row.map((c, i) => (isEmpty(c) ? -1 : i)).filter((i) => i >= 0);
    if (filled.length < 2) continue;
    const labels = filled.map((i) => cellToDisplayString(row[i]).toLocaleLowerCase("tr-TR")).filter((_, k) => isLabelCell(row[filled[k]!]));
    if (labels.length < 2) continue;
    const unique = new Set(labels).size / labels.length;
    const below = grid.slice(r + 1, r + 9);
    const fill =
      below.length === 0
        ? 0
        : below.reduce((sum, b) => sum + filled.filter((i) => !isEmpty(b[i])).length / filled.length, 0) / below.length;
    const dataLike = filled.length - labels.length;
    const score = labels.length * unique * (0.25 + fill) - dataLike;
    if (score > bestScore + 1e-9) {
      best = r;
      bestScore = score;
    }
  }
  return best;
}

/** True when row h+1 is the second line of a two-row header under row h:
 *  only labels, and either row h groups columns with a merged cell or row
 *  h+1 repeats a label that row h tells apart ("Kayıt / Ödeme" over "Tarih"). */
function isSubHeaderRow(grid: RawCell[][], h: number, merges: ParsedSheet["merges"]): boolean {
  const next = grid[h + 1];
  if (!next || !grid[h + 2]) return false;
  const filled = next.filter((c) => !isEmpty(c));
  if (filled.length < 2 || !filled.every(isLabelCell)) return false;
  const groupsColumns = (merges ?? []).some((m) => m.s.r <= h && m.e.r >= h && m.e.c > m.s.c);
  const labels = filled.map((c) => cellToDisplayString(c).toLocaleLowerCase("tr-TR"));
  return groupsColumns || new Set(labels).size < labels.length;
}

const SUMMARY_ROW = /^(genel |ara )?(toplam|total)\b/;

function isSummaryRow(cells: RawCell[]): boolean {
  const first = cells.find((c) => !isEmpty(c));
  if (first === undefined) return false;
  return SUMMARY_ROW.test(cellToDisplayString(first).toLocaleLowerCase("tr-TR").replace(/[:.]/g, " ").trim());
}

/** Cleans a plain-table sheet. `headerRowIndex` (in [headers, ...rows]
 *  coordinates) overrides the detected header row. */
export function normalizeTableSheet(sheet: ParsedSheet, headerRowIndex?: number): ParsedSheet {
  const rawGrid: RawCell[][] = [sheet.headers, ...sheet.rows];
  const rowNumberOf = (i: number) => (i === 0 ? sheet.headerRowNumber ?? 1 : sheet.rowNumbers?.[i - 1] ?? i + 1);
  const grid = fillMerges(rawGrid, sheet.merges);
  let h = Math.min(Math.max(headerRowIndex ?? detectHeaderRowIndex(grid), 0), grid.length - 1);
  if (headerRowIndex === undefined && isSubHeaderRow(grid, h, sheet.merges)) h += 1;
  const headerRow = grid[h] ?? [];
  const aboveRow = h > 0 ? grid[h - 1] ?? [] : [];
  const dataIdx = grid.map((_, i) => i).filter((i) => i > h);
  const width = Math.max(headerRow.length, ...dataIdx.map((i) => grid[i]!.length), 0);

  // Columns: named, or unnamed but holding data.
  const columns: number[] = [];
  for (let c = 0; c < width; c++) {
    if (!isEmpty(headerRow[c]) || dataIdx.some((i) => !isEmpty(grid[i]![c]))) columns.push(c);
  }

  // Header names: a two-row header ("Ödeme" over "Tarih | Tutar") gives
  // "Ödeme Tarih"; repeats get " (2)"; unnamed columns get their letter.
  const base = columns.map((c) => cellToDisplayString(headerRow[c]));
  const counts = new Map<string, number>();
  base.forEach((n) => counts.set(n.toLocaleLowerCase("tr-TR"), (counts.get(n.toLocaleLowerCase("tr-TR")) ?? 0) + 1));
  const named = columns.map((c, k) => {
    const own = base[k]!;
    const group = cellToDisplayString(aboveRow[c]);
    if (!own) return group || `Sütun ${columnLetter(c)}`;
    const repeated = (counts.get(own.toLocaleLowerCase("tr-TR")) ?? 0) > 1;
    return repeated && group && group.toLocaleLowerCase("tr-TR") !== own.toLocaleLowerCase("tr-TR") ? `${group} ${own}` : own;
  });
  const seen = new Map<string, number>();
  const headers = named.map((n) => {
    const key = n.toLocaleLowerCase("tr-TR");
    const k = (seen.get(key) ?? 0) + 1;
    seen.set(key, k);
    return k === 1 ? n : `${n} (${k})`;
  });

  // Rows: drop blank rows, repeats of the header row and summary rows
  // ("TOPLAM", "Genel Toplam", "Ara toplam:", "Total") — otherwise a total
  // line under a student list becomes a student named "TOPLAM".
  const headerKey = columns.map((c) => cellToDisplayString(headerRow[c]).toLocaleLowerCase("tr-TR")).join("\u0000");
  const rows: RawCell[][] = [];
  const rowNumbers: number[] = [];
  for (const i of dataIdx) {
    const cells = columns.map((c) => grid[i]![c] ?? "");
    if (cells.every(isEmpty)) continue;
    if (isSummaryRow(cells)) continue;
    if (cells.map((c) => cellToDisplayString(c).toLocaleLowerCase("tr-TR")).join("\u0000") === headerKey) continue;
    rows.push(cells.map((c) => (typeof c === "string" ? cellToDisplayString(c) : c)));
    rowNumbers.push(rowNumberOf(i));
  }

  return joinSplitNameColumns({
    ...sheet,
    headers,
    rows,
    rowNumbers,
    headerRowNumber: rowNumberOf(h),
    merges: undefined,
  });
}

// "Adı" + "Soyadı", "Veli Adı" + "Veli Soyadı", "İsim" + "Soyisim": many lists
// keep first and last name apart, while every import field wants the full name.
const FIRST_NAME = /^(.*?)\s*(ad|adı|adi|isim|ismi|isim)$/;
const LAST_NAME = /^(.*?)\s*(soyad|soyadı|soyadi|soyisim|soyismi)$/;

function nameKey(header: string): string {
  return header.toLocaleLowerCase("tr-TR").replace(/[^\p{L}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

/** Joins each first-name column with the last-name column that shares its
 *  prefix into one "<prefix> Ad Soyad" column, in the first one's place. */
export function joinSplitNameColumns(sheet: ParsedSheet): ParsedSheet {
  const pairs: [number, number][] = [];
  sheet.headers.forEach((header, first) => {
    const f = nameKey(cellToDisplayString(header)).match(FIRST_NAME);
    if (!f) return;
    const last = sheet.headers.findIndex((h) => {
      const l = nameKey(cellToDisplayString(h)).match(LAST_NAME);
      return !!l && l[1] === f[1];
    });
    if (last >= 0 && last !== first) pairs.push([first, last]);
  });
  if (pairs.length === 0) return sheet;

  const drop = new Set(pairs.map(([, last]) => last));
  const lastOf = new Map(pairs);
  const keep = sheet.headers.map((_, i) => i).filter((i) => !drop.has(i));
  const headers = keep.map((i) => {
    if (!lastOf.has(i)) return sheet.headers[i]!;
    const prefix = nameKey(cellToDisplayString(sheet.headers[i])).match(FIRST_NAME)![1]!;
    return prefix ? `${cellToDisplayString(sheet.headers[i]).replace(/\s*\S+$/, "")} Ad Soyad` : "Ad Soyad";
  });
  const rows = sheet.rows.map((row) =>
    keep.map((i) => {
      const last = lastOf.get(i);
      if (last === undefined) return row[i] ?? "";
      return [cellToDisplayString(row[i]), cellToDisplayString(row[last])].filter(Boolean).join(" ");
    })
  );
  return { ...sheet, headers, rows };
}

/** Every sheet of one file, ready for the analyzer: plain tables cleaned,
 *  per-student lesson ledgers (and their roster/blank-template sheets) left
 *  as written. */
export function prepareSheetsForImport(sheets: ParsedSheet[]): ParsedSheet[] {
  const ledger = detectStudentLedgerWorkbook(sheets);
  const ledgerSheets = new Set(ledger.ledgerSheets.map((l) => l.sheet));
  return sheets.map((s) => {
    if (ledger.isStudentLedgerWorkbook && (isRosterSheetName(s.name) || isBlankTemplateSheetName(s.name))) return s;
    if (ledgerSheets.has(s)) return s;
    // A lone sheet is a ledger only with a student name above its lesson
    // table; a plain lesson list with the same column names is a table.
    if (isLikelyStudentLedgerSheet(s).qualifies && ledgerSheetStudentName(s)) return s;
    return normalizeTableSheet(s);
  });
}
