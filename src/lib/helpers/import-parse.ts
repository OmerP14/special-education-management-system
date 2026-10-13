// ─── File parsing (Excel Import) ────────────────────────────────────────────────
// Real client-side parsing — no server round-trip. Text files (.csv/.tsv/.txt)
// are hand-rolled so the encoding (UTF-8 or Turkish Windows-1254) and the
// delimiter (, ; tab |) can be detected; every spreadsheet format SheetJS reads
// (.xlsx/.xlsm/.xlsb/.xls/.ods/.numbers) goes through the `xlsx` package.
//
// A ParsedSheet is the sheet as written: `headers` is its first non-empty row,
// whatever that row holds. Finding the real header row of a plain table (title
// rows above it, merged cells, …) is import-table.ts's job.

import * as XLSX from "xlsx";

export type RawCell = string | number | boolean | Date | null | undefined;

export interface ParsedSheet {
  name: string;
  headers: string[];
  rows: RawCell[][];
  /** Spreadsheet row number (1-based) of each entry in `rows` — empty rows are
   *  dropped, so the index alone doesn't give the row the user sees in Excel.
   *  Absent → rows are consecutive from row 2. */
  rowNumbers?: number[];
  /** Spreadsheet row number of `headers`. Absent → 1. */
  headerRowNumber?: number;
  /** Merged ranges, in the coordinates of [headers, ...rows] (row 0 = headers). */
  merges?: { s: { r: number; c: number }; e: { r: number; c: number } }[];
  /** Raw-workbook signals for the Workbook Analyzer — undefined for CSV (no
   *  merge/dimension concept) and always present for .xlsx/.xls sheets. */
  mergedCellCount?: number;
  totalCellCount?: number;
  sheetRowCount?: number;
  sheetColCount?: number;
}

// ─── CSV ────────────────────────────────────────────────────────────────────────

export type CsvDelimiter = "," | ";" | "\t" | "|";
const DELIMITERS: CsvDelimiter[] = [";", "\t", ",", "|"];

/** Picks the delimiter that splits the first lines into the most columns, the
 *  same number on each line. Turkish exports usually use ";" since "," is the
 *  decimal separator. */
export function detectDelimiter(text: string): CsvDelimiter {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "").slice(0, 10);
  let best: CsvDelimiter = ",";
  let bestScore = 0;
  for (const d of DELIMITERS) {
    const counts = lines.map((l) => parseCsvText(l, d)[0]?.length ?? 1);
    const columns = Math.min(...counts);
    if (columns < 2) continue;
    const consistent = counts.filter((c) => c === counts[0]).length / counts.length;
    const score = columns * consistent;
    if (score > bestScore) {
      best = d;
      bestScore = score;
    }
  }
  return best;
}

/** UTF-8 when the bytes are valid UTF-8, otherwise Windows-1254 (Turkish
 *  Excel's "CSV" save) — so "Öğrenci" never arrives as "�renci". */
export function decodeTextFile(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-1254").decode(buffer);
  }
}

/** Minimal RFC4180-style parser — handles quoted fields with embedded delimiters,
 *  newlines, and escaped ("") quotes. */
export function parseCsvText(text: string, delimiter: CsvDelimiter = ","): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let sawAnyField = false;

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      sawAnyField = true;
      continue;
    }
    if (c === delimiter) {
      row.push(field);
      field = "";
      sawAnyField = true;
      continue;
    }
    if (c === "\r") continue;
    if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      sawAnyField = false;
      continue;
    }
    field += c;
    sawAnyField = true;
  }
  if (field.length > 0 || sawAnyField || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const isBlankRow = (r: RawCell[]) => r.every((cell) => cell === "" || cell === null || cell === undefined || (typeof cell === "string" && cell.trim() === ""));

/** [headers, ...rows] from a grid whose index i is spreadsheet row
 *  firstRowNumber + i, keeping each kept row's spreadsheet row number. */
function sheetFromGrid(name: string, grid: RawCell[][], firstRowNumber: number): ParsedSheet | null {
  const kept: { row: RawCell[]; rowNumber: number }[] = [];
  grid.forEach((row, i) => {
    if (!isBlankRow(row)) kept.push({ row, rowNumber: firstRowNumber + i });
  });
  const [head, ...rest] = kept;
  if (!head) return null;
  return {
    name,
    headers: head.row.map((h) => cellToDisplayString(h)),
    rows: rest.map((k) => k.row),
    headerRowNumber: head.rowNumber,
    rowNumbers: rest.map((k) => k.rowNumber),
  };
}

async function parseTextFile(file: File): Promise<ParsedSheet[]> {
  const text = decodeTextFile(await file.arrayBuffer());
  const grid = parseCsvText(text, detectDelimiter(text));
  const sheet = sheetFromGrid(file.name.replace(/\.[^.]+$/, ""), grid, 1);
  return sheet ? [sheet] : [];
}

// ─── XLSX / XLS ─────────────────────────────────────────────────────────────────

/** Formats stored as a zip archive; anything else under these names is not a
 *  real file of that type (.xls is left out: web apps often save HTML or XML
 *  tables as .xls, and SheetJS reads those). */
const ZIP_EXTENSIONS = ["xlsx", "xlsm", "ods", "numbers"];

async function parseWorkbookFile(file: File): Promise<ParsedSheet[]> {
  const buffer = await file.arrayBuffer();
  const head = new Uint8Array(buffer.slice(0, 2));
  if (ZIP_EXTENSIONS.includes(getFileExtension(file.name)) && !(head[0] === 0x50 && head[1] === 0x4b)) {
    throw new Error(`"${file.name}" okunamadı. Dosya bozuk olabilir; Excel'de açıp .xlsx olarak yeniden kaydedin.`);
  }
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  } catch (e) {
    const message = e instanceof Error ? e.message.toLowerCase() : "";
    if (message.includes("password") || message.includes("encrypt")) {
      throw new Error(`"${file.name}" şifreli. Excel'de şifresini kaldırıp tekrar yükleyin.`);
    }
    throw new Error(`"${file.name}" okunamadı. Dosya bozuk olabilir; Excel'de açıp .xlsx olarak yeniden kaydedin.`);
  }

  const sheets: ParsedSheet[] = [];
  for (const name of workbook.SheetNames) {
    const ws = workbook.Sheets[name];
    const ref = ws?.["!ref"];
    if (!ws || !ref) continue;
    const range = XLSX.utils.decode_range(ref);
    // Row i of the grid is spreadsheet row range.s.r + 1 + i; blank rows are
    // kept here so that mapping stays exact.
    const grid = XLSX.utils.sheet_to_json<RawCell[]>(ws, { header: 1, raw: true, defval: "", blankrows: true });
    const sheet = sheetFromGrid(name, grid, range.s.r + 1);
    if (!sheet) continue;
    const sheetRowCount = range.e.r - range.s.r + 1;
    const sheetColCount = range.e.c - range.s.c + 1;
    // Merges in [headers, ...rows] coordinates; a merge touching a dropped
    // (blank) row is clipped to the rows that remain.
    const rowIndexOf = new Map<number, number>([[sheet.headerRowNumber!, 0]]);
    sheet.rowNumbers!.forEach((n, i) => rowIndexOf.set(n, i + 1));
    const merges = (ws["!merges"] ?? []).flatMap((m) => {
      const rows: number[] = [];
      for (let r = m.s.r; r <= m.e.r; r++) {
        const idx = rowIndexOf.get(r + 1);
        if (idx !== undefined) rows.push(idx);
      }
      if (rows.length === 0) return [];
      return [{ s: { r: rows[0]!, c: m.s.c - range.s.c }, e: { r: rows[rows.length - 1]!, c: m.e.c - range.s.c } }];
    });
    sheets.push({
      ...sheet,
      merges,
      mergedCellCount: (ws["!merges"] ?? []).length,
      totalCellCount: sheetRowCount * sheetColCount,
      sheetRowCount,
      sheetColCount,
    });
  }
  return sheets;
}

// ─── Unified entry point ────────────────────────────────────────────────────────

export function getFileExtension(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

const TEXT_EXTENSIONS = ["csv", "tsv", "txt"];
const WORKBOOK_EXTENSIONS = ["xlsx", "xlsm", "xlsb", "xls", "ods", "fods", "numbers"];
export const SUPPORTED_IMPORT_EXTENSIONS = [...WORKBOOK_EXTENSIONS, ...TEXT_EXTENSIONS];
export const SUPPORTED_IMPORT_ACCEPT = SUPPORTED_IMPORT_EXTENSIONS.map((e) => `.${e}`).join(",");
export const UNSUPPORTED_IMPORT_FILE_MESSAGE =
  "Desteklenmeyen dosya türü. Excel (.xlsx, .xls, .xlsm, .xlsb), LibreOffice (.ods), Numbers veya CSV/TXT yükleyin.";

export function isSupportedImportFile(fileName: string): boolean {
  return SUPPORTED_IMPORT_EXTENSIONS.includes(getFileExtension(fileName));
}

/** Parses an uploaded file into one or more sheets. A text file yields one
 *  sheet (named after the file); a workbook may yield several. */
export async function parseSpreadsheetFile(file: File): Promise<ParsedSheet[]> {
  const ext = getFileExtension(file.name);
  if (TEXT_EXTENSIONS.includes(ext)) return parseTextFile(file);
  if (WORKBOOK_EXTENSIONS.includes(ext)) return parseWorkbookFile(file);
  throw new Error(UNSUPPORTED_IMPORT_FILE_MESSAGE);
}

/** Spreadsheet row number of data row `index` of a sheet. */
export function sheetRowNumber(sheet: ParsedSheet, index: number): number {
  return sheet.rowNumbers?.[index] ?? index + 2;
}

// ─── Cell helpers ───────────────────────────────────────────────────────────────

export function cellToDisplayString(cell: RawCell): string {
  if (cell === null || cell === undefined) return "";
  if (cell instanceof Date) return formatCellDateForDisplay(cell);
  // Non-breaking and other odd spaces (common in copy-pasted/exported data) count as spaces.
  return String(cell).replace(/[\u00a0\u2007\u202f\u200b]/g, " ").replace(/\s+/g, " ").trim();
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Rejects calendar-impossible dates (31 February, month 13, day 40, day 0, …) by
 *  round-tripping through Date.UTC and confirming the components didn't overflow —
 *  a regex only confirms the SHAPE "DD.MM.YYYY" looks right, never that the date
 *  actually exists. */
function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

/** Turkish month names by their first three letters ("eki" → Ekim). */
const MONTH_BY_PREFIX = ["oca", "şub", "mar", "nis", "may", "haz", "tem", "ağu", "eyl", "eki", "kas", "ara"];

function formatCellDateForDisplay(d: Date): string {
  // SheetJS (cellDates:true) constructs dates from the serial number using UTC —
  // read UTC components, never local, or the day can shift by a timezone offset.
  return `${pad2(d.getUTCDate())}.${pad2(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
}

/**
 * Resolves any raw cell that's supposed to represent a date into a canonical
 * "YYYY-MM-DD" string, entirely via local/UTC-safe component extraction — never
 * `new Date(str).toISOString()`, which shifts by the browser's timezone offset.
 * Returns null when the cell can't be parsed as a date.
 */
export function parseCellAsDateString(cell: RawCell): string | null {
  if (cell === null || cell === undefined || cell === "") return null;

  if (cell instanceof Date) {
    if (Number.isNaN(cell.getTime())) return null;
    return `${cell.getUTCFullYear()}-${pad2(cell.getUTCMonth() + 1)}-${pad2(cell.getUTCDate())}`;
  }

  if (typeof cell === "number") {
    // Excel serial date (days since 1899-12-30, accounting for the 1900 leap-year bug).
    const utcMs = Math.round((cell - 25569) * 86400 * 1000);
    const d = new Date(utcMs);
    if (Number.isNaN(d.getTime())) return null;
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  }

  // A trailing time ("13.10.2026 14:30", "2026-10-13T14:30:00") is ignored here.
  const s = String(cell).trim().replace(/[T\s]+\d{1,2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/i, "");
  if (!s) return null;

  // "13 Ekim 2026", "13 Eki 2026"
  const named = s.toLocaleLowerCase("tr-TR").match(/^(\d{1,2})\s+([a-zçğıöşü]+)\.?\s+(\d{4})$/);
  if (named) {
    const month = MONTH_BY_PREFIX.findIndex((p) => named[2]!.startsWith(p)) + 1;
    const day = Number(named[1]);
    const year = Number(named[3]);
    return month > 0 && isValidCalendarDate(year, month, day) ? `${year}-${pad2(month)}-${pad2(day)}` : null;
  }

  // YYYY-MM-DD / YYYY/MM/DD / YYYY.MM.DD
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    return isValidCalendarDate(year, month, day) ? `${m[1]}-${pad2(month)}-${pad2(day)}` : null;
  }

  // DD.MM.YYYY / DD/MM/YYYY / DD-MM-YYYY, and two-digit years (13.10.26 → 2026)
  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4}|\d{2})$/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = m[3]!.length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return isValidCalendarDate(year, month, day) ? `${year}-${pad2(month)}-${pad2(day)}` : null;
  }

  return null;
}

/** Resolves a raw cell (possibly a "HH:MM"/"HH:MM:SS" string or an Excel time
 *  fraction) into a canonical "HH:MM" string, or null if absent/unparseable. */
export function parseCellAsTimeString(cell: RawCell): string | null {
  if (cell === null || cell === undefined || cell === "") return null;

  if (cell instanceof Date) {
    return `${pad2(cell.getUTCHours())}:${pad2(cell.getUTCMinutes())}`;
  }

  if (typeof cell === "number") {
    // Excel time-of-day fraction (0..1 = 00:00..24:00).
    const totalMinutes = Math.round(cell * 24 * 60);
    return `${pad2(Math.floor(totalMinutes / 60) % 24)}:${pad2(totalMinutes % 60)}`;
  }

  const s = String(cell).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (m) return `${pad2(Number(m[1]))}:${pad2(Number(m[2]))}`;
  return null;
}

/** Resolves a raw cell into a number, tolerant of Turkish and international
 *  formats: "1.500,50", "1500,50", "1500.50", "1.500" (= 1500), "₺1.500",
 *  "1.500 TL", "-250", "(250)" (= -250). Returns null if not numeric. */
export function parseCellAsNumber(cell: RawCell): number | null {
  if (cell === null || cell === undefined || cell === "") return null;
  if (typeof cell === "number") return Number.isFinite(cell) ? cell : null;
  if (typeof cell !== "string") return null;
  let s = cell.trim().replace(/[₺$€£\s\u00a0]|tl$|try$/gi, "");
  if (s === "") return null;
  let sign = 1;
  if (/^\(.*\)$/.test(s)) {
    sign = -1;
    s = s.slice(1, -1);
  }
  if (s.startsWith("-")) {
    sign = -sign;
    s = s.slice(1);
  } else if (s.startsWith("+")) {
    s = s.slice(1);
  }
  if (!/^[\d.,]+$/.test(s)) return null;
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // Whichever separator appears last is the decimal separator.
    s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (hasDot && /^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, ""); // "1.500" / "12.000.000" — Turkish thousands
  } else if (hasComma && /^\d{1,3}(,\d{3}){2,}$/.test(s)) {
    s = s.replace(/,/g, ""); // "1,500,000" — English thousands
  } else if (hasComma) {
    s = s.replace(",", "."); // "1500,50" — Turkish decimal
  }
  const n = Number(s);
  return Number.isFinite(n) ? sign * n : null;
}
