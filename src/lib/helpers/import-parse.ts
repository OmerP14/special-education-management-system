// ─── File parsing (Excel Import) ────────────────────────────────────────────────
// Real client-side parsing — no server round-trip. CSV is hand-rolled (no
// dependency needed); .xlsx/.xls go through the `xlsx` (SheetJS) package, the one
// new dependency this feature needs since binary spreadsheet parsing isn't
// feasible without a library.

import * as XLSX from "xlsx";

export type RawCell = string | number | boolean | Date | null | undefined;

export interface ParsedSheet {
  name: string;
  headers: string[];
  rows: RawCell[][];
  /** Raw-workbook signals for the Workbook Analyzer — undefined for CSV (no
   *  merge/dimension concept) and always present for .xlsx/.xls sheets. */
  mergedCellCount?: number;
  totalCellCount?: number;
  sheetRowCount?: number;
  sheetColCount?: number;
}

// ─── CSV ────────────────────────────────────────────────────────────────────────

/** Turkish-locale exports commonly use ";" (since "," is the decimal separator). */
function detectDelimiter(text: string): "," | ";" {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const commaCount = (firstLine.match(/,/g) ?? []).length;
  const semicolonCount = (firstLine.match(/;/g) ?? []).length;
  return semicolonCount > commaCount ? ";" : ",";
}

/** Minimal RFC4180-style parser — handles quoted fields with embedded delimiters,
 *  newlines, and escaped ("") quotes. */
export function parseCsvText(text: string, delimiter: "," | ";" = ","): string[][] {
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
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

async function parseCsvFile(file: File): Promise<ParsedSheet> {
  const text = await file.text();
  const delimiter = detectDelimiter(text);
  const aoa = parseCsvText(text, delimiter);
  const [headerRow, ...dataRows] = aoa;
  const headers = (headerRow ?? []).map((h) => h.trim());
  return { name: file.name.replace(/\.csv$/i, ""), headers, rows: dataRows };
}

// ─── XLSX / XLS ─────────────────────────────────────────────────────────────────

async function parseWorkbookFile(file: File): Promise<ParsedSheet[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });

  return workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name]!;
    const aoa = XLSX.utils.sheet_to_json<RawCell[]>(sheet, {
      header: 1,
      raw: true,
      defval: "",
    });
    const [headerRow, ...dataRows] = aoa;
    const headers = (headerRow ?? []).map((h) => String(h ?? "").trim());
    const rows = dataRows.filter((r) =>
      r.some((cell) => cell !== "" && cell !== null && cell !== undefined)
    );

    const merges = sheet["!merges"] ?? [];
    const ref = sheet["!ref"];
    let sheetRowCount = 0;
    let sheetColCount = 0;
    if (ref) {
      const range = XLSX.utils.decode_range(ref);
      sheetRowCount = range.e.r - range.s.r + 1;
      sheetColCount = range.e.c - range.s.c + 1;
    }

    return {
      name,
      headers,
      rows,
      mergedCellCount: merges.length,
      totalCellCount: sheetRowCount * sheetColCount,
      sheetRowCount,
      sheetColCount,
    };
  }).filter((sheet) => sheet.headers.length > 0);
}

// ─── Unified entry point ────────────────────────────────────────────────────────

export function getFileExtension(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

export function isSupportedImportFile(fileName: string): boolean {
  return ["csv", "xlsx", "xls"].includes(getFileExtension(fileName));
}

/** Parses an uploaded file into one or more sheets. A .csv file always yields
 *  exactly one sheet (named after the file); .xlsx/.xls may yield several. */
export async function parseSpreadsheetFile(file: File): Promise<ParsedSheet[]> {
  const ext = getFileExtension(file.name);
  if (ext === "csv") return [await parseCsvFile(file)];
  if (ext === "xlsx" || ext === "xls") return parseWorkbookFile(file);
  throw new Error("Desteklenmeyen dosya türü. Lütfen .xlsx, .xls veya .csv yükleyin.");
}

// ─── Cell helpers ───────────────────────────────────────────────────────────────

export function cellToDisplayString(cell: RawCell): string {
  if (cell === null || cell === undefined) return "";
  if (cell instanceof Date) return formatCellDateForDisplay(cell);
  return String(cell).trim();
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

  const s = String(cell).trim();
  if (!s) return null;

  // YYYY-MM-DD / YYYY/MM/DD
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    return isValidCalendarDate(year, month, day) ? `${m[1]}-${pad2(month)}-${pad2(day)}` : null;
  }

  // DD.MM.YYYY / DD/MM/YYYY / DD-MM-YYYY
  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = Number(m[3]);
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

/** Resolves a raw cell into a number, tolerant of "1.500,50"/"1500,50"/"1500.50"
 *  Turkish/international thousand-separator formats. Returns null if not numeric. */
export function parseCellAsNumber(cell: RawCell): number | null {
  if (cell === null || cell === undefined || cell === "") return null;
  if (typeof cell === "number") return cell;
  let s = String(cell).trim().replace(/[₺\s]/g, "");
  if (s === "") return null;
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // Whichever separator appears last is the decimal separator.
    s = s.lastIndexOf(",") > s.lastIndexOf(".")
      ? s.replace(/\./g, "").replace(",", ".")
      : s.replace(/,/g, "");
  } else if (hasComma) {
    s = s.replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
