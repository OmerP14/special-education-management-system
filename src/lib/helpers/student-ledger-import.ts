// ─── "Öğrenci Bazlı Ders Takip Defteri" detection & extraction ─────────────────
// A common historical-migration workbook shape: one "LİSTE" summary sheet plus one
// sheet PER STUDENT, each with a small metadata block (student/teacher/weekly count
// near the top) followed by a lesson table (Tarih / Ders Saati-Sayısı / Ders Ücreti /
// Tutar). Detected generically by sheet content, never by filename, so it works for
// any center's export that happens to share this shape — see workbook-analyzer.ts
// for how this plugs into the rule registry.
//
// First-time migration: this format is very often the FIRST file a center ever
// imports, meaning none of its students exist yet. buildStudentLedgerImport creates
// any roster student that doesn't already resolve — sourced from the "LİSTE" sheet
// (if present) AND each lesson sheet's own metadata name, so it still works with no
// LİSTE sheet at all — BEFORE resolving lesson rows into sessions, so a fresh system
// can migrate this file in one pass instead of requiring a separate Students import
// first.

import type { ImportEntityMatch, ImportMode, Student, Teacher, Session, TeacherCustomPrice, SessionBillingMode } from "@/types";
import {
  cellToDisplayString,
  parseCellAsDateString,
  parseCellAsNumber,
  parseCellAsTimeString,
  type ParsedSheet,
  type RawCell,
} from "@/lib/helpers/import-parse";
import { newId, type StagedRow } from "@/lib/helpers/import";
import {
  resolveStudentByName,
  resolveTeacherByName,
  findDuplicateSession,
  buildStudentIndex,
  addStudentToIndex,
  buildTeacherIndex,
  addTeacherToIndex,
  buildSessionDuplicateIndex,
  addSessionToDuplicateIndex,
  type StudentIndex,
  type TeacherIndex,
  type SessionDuplicateIndex,
} from "@/lib/helpers/import-match";
import {
  buildSessionConflictIndex,
  addSessionToConflictIndex,
  checkSessionConflictIndexed,
  DEFAULT_CONFLICT_DURATION_MINUTES,
  type SessionConflictIndex,
} from "@/lib/helpers/session-conflict";
import { calculateTeacherSessionEarning } from "@/lib/helpers/finance";
import { registerAnalyzerRule, type AnalyzerRule } from "@/lib/helpers/workbook-analyzer";

function normalizeForTokenMatch(s: string): string {
  return s.toLocaleLowerCase("tr-TR");
}

// Sheet names that mean "this is just a roster of student names, not a lesson
// sheet" — LİSTE, Liste, Öğrenci Listesi, Master Liste, and small variations.
// Deliberately matched by normalized equality/startsWith, not a loose substring
// check, so an actual student never coincidentally matches.
const ROSTER_SHEET_NAME_TOKENS = ["liste", "öğrenci listesi", "ogrenci listesi", "master liste"];

export function isRosterSheetName(name: string): boolean {
  const n = normalizeForTokenMatch(name.trim());
  return ROSTER_SHEET_NAME_TOKENS.some((t) => n === t || n.startsWith(`${t} `) || n.startsWith(`${t}-`));
}

/** Excel auto-suffixes duplicate sheet names as "BOŞ (2)", "BOŞ (3)", … — an exact
 *  "boş" match alone misses every copy past the first. */
export function isBlankTemplateSheetName(name: string): boolean {
  const n = normalizeForTokenMatch(name.trim());
  return /^bo[şs](\s*\(\d+\))?$/.test(n);
}

/** Strips slashes/hyphens/colons/dots (real files write "ADI/SOYADI:", "ADI-SOYADI",
 *  "ADI / SOYADI" interchangeably) so label tokens match regardless of punctuation. */
function normalizeForLabelMatch(s: string): string {
  return normalizeForTokenMatch(s).replace(/[/\-:.]/g, " ").replace(/\s+/g, " ").trim();
}

function sheetContainsToken(sheet: ParsedSheet, token: string, maxRows = 20): boolean {
  const scanRows: (string | RawCell)[][] = [sheet.headers, ...sheet.rows.slice(0, maxRows)];
  return scanRows.some((row) => row.some((cell) => normalizeForLabelMatch(cellToDisplayString(cell as RawCell)).includes(token)));
}

// "Öğrenci Adı Soyadı" / "Adı Soyadı" / "Adı-Soyadı" / "Adı/Soyadı" are the documented
// labels (normalizeForLabelMatch makes the exact punctuation irrelevant); real files
// also just use the bare "Ad Soyad" a classic Students table would use — this alone
// never over-qualifies a sheet (isLikelyStudentLedgerSheet still requires the
// ledger-specific ders saati/ücreti/tutar/haftalık tokens too, which an ordinary
// Students sheet never has).
const STUDENT_LEDGER_NAME_TOKENS = ["öğrenci adı", "adı soyadı", "ad soyad"];

function scoreStudentLedgerShape(sheet: ParsedSheet): { score: number; reasons: string[] } {
  const hasNameLabel = STUDENT_LEDGER_NAME_TOKENS.some((t) => sheetContainsToken(sheet, t));
  const hasTeacherLabel = sheetContainsToken(sheet, "öğretmen");
  const hasWeeklyCountLabel = sheetContainsToken(sheet, "haftalık ders sayısı") || sheetContainsToken(sheet, "haftalik ders sayisi");
  const hasDateLabel = sheetContainsToken(sheet, "tarih");
  const hasHourOrCountLabel =
    sheetContainsToken(sheet, "ders saati") || sheetContainsToken(sheet, "ders sayısı") || sheetContainsToken(sheet, "ders sayisi");
  const hasFeeLabel = sheetContainsToken(sheet, "ders ücreti") || sheetContainsToken(sheet, "ders ucreti");
  const hasAmountLabel = sheetContainsToken(sheet, "tutar");

  const reasons: string[] = [];
  if (hasNameLabel) reasons.push("Öğrenci adı etiketi bulundu");
  if (hasTeacherLabel) reasons.push("Öğretmen etiketi bulundu");
  if (hasWeeklyCountLabel) reasons.push("Haftalık ders sayısı etiketi bulundu");
  if (hasDateLabel) reasons.push("Tarih sütunu bulundu");
  if (hasHourOrCountLabel) reasons.push("Ders saati/sayısı sütunu bulundu");
  if (hasFeeLabel) reasons.push("Ders ücreti sütunu bulundu");
  if (hasAmountLabel) reasons.push("Tutar sütunu bulundu");

  return { score: reasons.length, reasons };
}

const STUDENT_LEDGER_MIN_SCORE = 4;

function isLikelyStudentLedgerSheet(sheet: ParsedSheet): { qualifies: boolean; score: number; reasons: string[] } {
  if (isBlankTemplateSheetName(sheet.name) || isRosterSheetName(sheet.name)) return { qualifies: false, score: 0, reasons: [] };

  const { score, reasons } = scoreStudentLedgerShape(sheet);
  const hasNameLabel = reasons.some((r) => r.startsWith("Öğrenci adı"));
  const hasDateLabel = reasons.some((r) => r.startsWith("Tarih"));
  if (!(score >= STUDENT_LEDGER_MIN_SCORE && hasDateLabel)) return { qualifies: false, score, reasons };

  // A labeled name is the strongest signal; some real files never label it at all
  // (the name just sits there, unlabeled, above the lesson table) — extraction's own
  // unlabeled-name fallback covers that case, so require ONE of the two here too.
  const { studentName } = extractLedgerSheetMetadata(sheet);
  if (!hasNameLabel && !studentName) return { qualifies: false, score, reasons };

  // A blank copy of the template (unfilled name cell, every lesson row zeroed out)
  // scores identically to a real one on labels alone — reject it if there's no
  // actual student name AND no non-zero lesson row underneath.
  if (!studentName) {
    const hasAnyRealRow = sheet.rows.some((row) => row.some((cell) => typeof cell === "number" && cell !== 0));
    if (!hasAnyRealRow) return { qualifies: false, score, reasons };
  }

  return { qualifies: true, score, reasons };
}

export interface StudentLedgerWorkbookDetection {
  isStudentLedgerWorkbook: boolean;
  listSheet: ParsedSheet | null;
  ledgerSheets: { sheet: ParsedSheet; score: number; reasons: string[] }[];
}

/** Workbook-level detection — a single sheet coincidentally having a "Tarih" column
 *  isn't enough; this only fires when several sheets share the shape (or the
 *  telltale "LİSTE" sheet is present alongside at least one). */
export function detectStudentLedgerWorkbook(sheets: ParsedSheet[]): StudentLedgerWorkbookDetection {
  const listSheet = sheets.find((s) => isRosterSheetName(s.name)) ?? null;
  const candidates = sheets
    .map((sheet) => ({ sheet, ...isLikelyStudentLedgerSheet(sheet) }))
    .filter((c) => c.qualifies);

  const isStudentLedgerWorkbook = candidates.length >= 2 || (candidates.length >= 1 && !!listSheet);

  return {
    isStudentLedgerWorkbook,
    listSheet,
    ledgerSheets: isStudentLedgerWorkbook ? candidates.map(({ sheet, score, reasons }) => ({ sheet, score, reasons })) : [],
  };
}

// ─── Per-sheet metadata + lesson-row extraction ─────────────────────────────────

// Every label this file ever looks for — used to stop the "grab the next non-empty
// cell" fallback from grabbing ANOTHER label instead of a real value. Real files
// commonly lay the metadata block out as one row of labels ("ÖĞRENCİ ADI-SOYADI |
// | ÖĞRETMEN | | LİSTE") followed by one row of values in the same columns, so a
// naive "next cell in this row" scan runs straight into the next label, not a value.
const KNOWN_METADATA_LABELS = ["öğrenci adı", "adı soyadı", "ad soyad", "öğretmen", "liste", "haftalık ders sayısı", "tarih", "ders saati", "ders sayısı", "ders ücreti", "tutar"];

function looksLikeKnownMetadataLabel(s: string): boolean {
  const n = normalizeForLabelMatch(s);
  if (!n) return false;
  return KNOWN_METADATA_LABELS.some((label) => n === label || n.startsWith(label));
}

function extractMetadataValue(displayGrid: string[][], labelTokens: string[], maxRow: number): string | null {
  for (let r = 0; r < Math.min(maxRow, displayGrid.length); r++) {
    const row = displayGrid[r]!;
    for (let i = 0; i < row.length; i++) {
      const cellText = normalizeForLabelMatch(row[i]!);
      if (labelTokens.some((t) => cellText.includes(t))) {
        const raw = row[i]!;
        const afterColon = raw.split(":").slice(1).join(":").trim();
        if (afterColon && !looksLikeKnownMetadataLabel(afterColon)) return afterColon;

        // Same row, next non-empty cell — but never another label (e.g. the "LİSTE"
        // column header sitting two cells after "ÖĞRETMEN" in the same label row).
        for (let j = i + 1; j < row.length; j++) {
          if (row[j] && !looksLikeKnownMetadataLabel(row[j]!)) return row[j]!;
        }

        // Label-row-then-value-row layout: the value sits directly below, same column.
        const below = displayGrid[r + 1]?.[i];
        if (below && !looksLikeKnownMetadataLabel(below)) return below;
      }
    }
  }
  return null;
}

/** True when a sheet has an actual lesson table (Tarih + Ders Ücreti/Tutar header) —
 *  used to tell a pure name roster apart from a sheet that's ALSO a real lesson
 *  sheet despite being named like a roster. */
export function sheetHasLedgerLessonHeader(sheet: ParsedSheet): boolean {
  const displayGrid: string[][] = [sheet.headers, ...sheet.rows.map((r) => r.map((c) => cellToDisplayString(c)))];
  return findLedgerHeaderRowIndex(displayGrid) >= 0;
}

function findLedgerHeaderRowIndex(displayGrid: string[][]): number {
  for (let i = 0; i < displayGrid.length; i++) {
    const normalized = displayGrid[i]!.map((c) => normalizeForTokenMatch(c));
    const hasDate = normalized.some((c) => c.startsWith("tarih"));
    const hasFeeOrAmount = normalized.some((c) => c.includes("ders ücreti") || c.includes("ders ucreti") || c.includes("tutar"));
    if (hasDate && hasFeeOrAmount) return i;
  }
  return -1;
}

interface LedgerSheetMetadata {
  displayGrid: string[][];
  headerRowIdx: number;
  studentName: string | null;
  teacherName: string | null;
  weeklySessionCount: number | null;
}

// Words that mean "this cell is a LABEL, not a person's name" — guards the unlabeled-
// name fallback below from misreading e.g. "HAFTALIK DERS SAYISI:4" as a name.
const METADATA_LABEL_GUARD_WORDS = ["öğretmen", "liste", "haftalık", "haftalik", "tarih", "ders", "tutar", "ücret", "ucret"];

/** A small, real-world minority of sheets never label the student name at all — it's
 *  just the first plausible-looking name sitting above the lesson table. Requires
 *  2+ Title-Case-ish words (never a single stray cell like "S") and none of the
 *  known label vocabulary, so this never misreads an actual label as a name. */
function looksLikePlausibleUnlabeledName(s: string): boolean {
  const trimmed = s.trim();
  if (!trimmed) return false;
  const words = trimmed.split(/\s+/);
  if (words.length < 2 || words.length > 5) return false;
  const normalized = normalizeForTokenMatch(trimmed);
  if (METADATA_LABEL_GUARD_WORDS.some((w) => normalized.includes(w))) return false;
  return /[a-zçğıiöşüA-ZÇĞİİÖŞÜ]/.test(trimmed);
}

/** Shared by extraction AND roster collection so the "where's the student name"
 *  logic exists in exactly one place. */
function extractLedgerSheetMetadata(sheet: ParsedSheet): LedgerSheetMetadata {
  const displayGrid: string[][] = [sheet.headers, ...sheet.rows.map((r) => r.map((c) => cellToDisplayString(c)))];
  const headerRowIdx = findLedgerHeaderRowIndex(displayGrid);
  const metadataScanRows = headerRowIdx >= 0 ? headerRowIdx : 10;

  let studentName = extractMetadataValue(displayGrid, STUDENT_LEDGER_NAME_TOKENS, metadataScanRows);
  if (!studentName) {
    for (let r = 0; r < Math.min(metadataScanRows, displayGrid.length); r++) {
      const candidate = displayGrid[r]?.[0] ?? "";
      if (looksLikePlausibleUnlabeledName(candidate)) {
        studentName = candidate.trim();
        break;
      }
    }
  }
  const teacherName = extractMetadataValue(displayGrid, ["öğretmen"], metadataScanRows);
  const weeklyCountRaw = extractMetadataValue(displayGrid, ["haftalık ders sayısı", "haftalik ders sayisi"], metadataScanRows);
  const weeklySessionCount = weeklyCountRaw ? parseCellAsNumber(weeklyCountRaw) : null;

  return { displayGrid, headerRowIdx, studentName, teacherName, weeklySessionCount };
}

function isExplicitTimeValue(cell: RawCell): boolean {
  if (cell instanceof Date) return true;
  if (typeof cell === "string") return /^\d{1,2}:\d{2}/.test(cell.trim());
  return false;
}

function splitTeacherNames(raw: string): string[] {
  return raw.split("+").map((s) => s.trim()).filter(Boolean);
}

/** Real files title every teacher name in the metadata block with a trailing
 *  "HOCA" honorific ("EKREM HOCA") that never matches how the teacher is actually
 *  named in the system ("Ekrem") — stripped before matching and surfaced as an
 *  INFO note (never blocks the row) whenever the stripped form is what resolved. */
function stripHocaHonorific(name: string): string {
  return name.replace(/\s+hoca\.?$/i, "").trim();
}

/** "TOPLAM" (subtotal) rows carry a real TUTAR value, so they'd otherwise slip
 *  past the no-date/no-amount skip below and surface as a fake "invalid date"
 *  error — they're a summary line, never a lesson, and must never block import. */
function isSummaryMarkerCell(cellText: string): boolean {
  return cellText.trim().toLocaleUpperCase("tr-TR").includes("TOPLAM");
}

export interface StudentLedgerSheetResult {
  sheetName: string;
  studentName: string | null;
  teacherName: string | null;
  weeklySessionCount: number | null;
  headerRowFound: boolean;
  rows: StagedRow[];
  /** Rows silently dropped per rule: no date AND zero/blank amount — never shown,
   *  never counted as an error (they're just non-rows, e.g. trailing blank lines). */
  skippedRowCount: number;
}

/** Extracts one student's lesson sheet into Session candidates. `studentIndex` must
 *  already contain this sheet's student (buildStudentLedgerImport creates any
 *  missing roster student before calling this) — this function only ever *resolves*,
 *  never creates, matching every other FK-resolution site in the import pipeline. */
export function extractStudentLedgerSheet(
  sheet: ParsedSheet,
  studentIndex: StudentIndex,
  teacherIndex: TeacherIndex,
  defaultEducationTypeId: string,
  sessionDuplicateIndex: SessionDuplicateIndex,
  sessionConflictIndex: SessionConflictIndex,
  mode: ImportMode,
  /** False when "Öğretmenler" isn't among the selected import types this run — a
   *  teacher name that doesn't resolve (even after HOCA-suffix normalization) is
   *  then reported as an error instead of silently fabricating a new Teacher. */
  allowTeacherAutoCreate: boolean,
  teacherCustomPrices: TeacherCustomPrice[],
  /** The user's explicit choice in the import wizard for how THIS batch's
   *  sessions should behave financially — see SessionBillingMode. Never
   *  inferred/defaulted here; the caller must always pass it explicitly so a
   *  historical migration can never silently create debt (or silently avoid it). */
  billingMode: SessionBillingMode
): StudentLedgerSheetResult {
  const { displayGrid, headerRowIdx, studentName, teacherName: teacherNameMeta, weeklySessionCount } = extractLedgerSheetMetadata(sheet);

  if (headerRowIdx < 0) {
    return {
      sheetName: sheet.name,
      studentName,
      teacherName: teacherNameMeta,
      weeklySessionCount,
      headerRowFound: false,
      rows: [],
      skippedRowCount: 0,
    };
  }

  const headerCells = displayGrid[headerRowIdx]!.map((c) => normalizeForTokenMatch(c));
  const dateCol = headerCells.findIndex((c) => c.startsWith("tarih"));
  const hourOrCountCol = headerCells.findIndex((c) => c.includes("ders saati") || c.includes("ders sayısı") || c.includes("ders sayisi"));
  const feeCol = headerCells.findIndex((c) => c.includes("ders ücreti") || c.includes("ders ucreti"));
  const amountCol = headerCells.findIndex((c) => c.includes("tutar"));
  const teacherCol = headerCells.findIndex((c) => c.includes("öğretmen") || c.includes("hoca"));
  const noteCol = headerCells.findIndex((c) => c.includes("not") || c.includes("açıklama") || c.includes("aciklama"));

  // Real files rarely LABEL this column — it exists only to say which of several
  // "+"-joined teachers (from the metadata block) taught THIS specific lesson, so
  // its header cell is blank. Only trusted as a per-row teacher override when the
  // metadata itself names more than one teacher — a blank trailing column on an
  // ordinary single-teacher sheet is never assumed to mean anything.
  const knownCols = new Set([dateCol, hourOrCountCol, feeCol, amountCol, teacherCol, noteCol].filter((c) => c >= 0));
  const maxKnownCol = knownCols.size > 0 ? Math.max(...knownCols) : -1;
  const hasMultipleTeachersInMeta = splitTeacherNames(teacherNameMeta ?? "").length > 1;
  const extraTeacherCol = teacherCol < 0 && hasMultipleTeachersInMeta ? maxKnownCol + 1 : -1;

  // displayGrid[0] === sheet.headers, displayGrid[k] === sheet.rows[k-1] for k>=1 —
  // so data rows within sheet.rows start right after the header row's position.
  const dataRows = headerRowIdx === 0 ? sheet.rows : sheet.rows.slice(headerRowIdx);

  const studentRes = studentName ? resolveStudentByName(studentName, studentIndex) : null;
  const rows: StagedRow[] = [];
  let skippedRowCount = 0;
  let rowNumber = headerRowIdx;

  for (const raw of dataRows) {
    rowNumber++;
    const dateCell = dateCol >= 0 ? raw[dateCol] : null;
    const dateStr = parseCellAsDateString(dateCell);
    const amountCell = amountCol >= 0 ? raw[amountCol] : null;
    const amount = amountCell != null ? parseCellAsNumber(amountCell) : null;
    // Read once, up front, so a row that errors out on date/student BEFORE the
    // real hour/fee resolution below still carries a best-effort fee/time hint
    // for the repair panel to pre-fill — never used for the actual staged
    // record, only for repair-panel display (see ImportRowRepairHints).
    const feeCell = feeCol >= 0 ? raw[feeCol] : null;
    const fee = feeCell != null ? parseCellAsNumber(feeCell) : null;
    const hourOrCountCellForHint = hourOrCountCol >= 0 ? raw[hourOrCountCol] : null;
    const timeHint =
      hourOrCountCellForHint != null && isExplicitTimeValue(hourOrCountCellForHint)
        ? parseCellAsTimeString(hourOrCountCellForHint) ?? undefined
        : undefined;
    const feeHint = fee ?? (amount !== null ? amount : undefined);
    const repairHints = feeHint !== undefined || timeHint !== undefined ? { fee: feeHint, time: timeHint } : undefined;

    if (isSummaryMarkerCell(cellToDisplayString(dateCell))) {
      skippedRowCount++;
      continue;
    }

    if (!dateStr && (amount === null || amount === 0)) {
      skippedRowCount++;
      continue;
    }

    const displayText = `${studentName ?? sheet.name} — ${dateStr ?? cellToDisplayString(dateCell)}`;

    if (!dateStr) {
      rows.push({
        preview: {
          rowNumber,
          displayText,
          status: "error",
          issues: [`Geçersiz veya eksik tarih: '${cellToDisplayString(dateCell)}'`],
          entityMatches: [],
          include: false,
          repairHints,
        },
        staged: [],
      });
      continue;
    }

    if (!studentName || !studentRes?.student) {
      rows.push({
        preview: {
          rowNumber,
          displayText,
          status: "error",
          issues: [studentName ? `'${studentName}' adlı öğrenci sistemde bulunamadı` : "Sayfa başında öğrenci adı bulunamadı"],
          entityMatches: studentName ? [{ entityType: "Öğrenci", value: studentName, matched: false }] : [],
          include: false,
          repairHints,
        },
        staged: [],
      });
      continue;
    }

    const hourOrCountCell = hourOrCountCol >= 0 ? raw[hourOrCountCol] : null;
    let sessionCount = 1;
    let timeStr = "09:00";
    // INFO-level notes (parser assumptions the user should see but that never
    // block the row) are tracked separately from WARNING-level ones — only the
    // latter flips the row's status away from "valid".
    const infoNotes: string[] = [];
    let hasWarning = false;
    const warn = (msg: string) => {
      infoNotes.push(msg);
      hasWarning = true;
    };
    if (hourOrCountCell != null && cellToDisplayString(hourOrCountCell) !== "") {
      if (isExplicitTimeValue(hourOrCountCell)) {
        const t = parseCellAsTimeString(hourOrCountCell);
        if (t) timeStr = t;
        else infoNotes.push("Saat bilgisi bulunmadığı için varsayılan saat (09:00) kullanıldı");
      } else {
        const n = parseCellAsNumber(hourOrCountCell);
        if (n && n > 0) sessionCount = Math.round(n);
        infoNotes.push("Bu sütun saat değil ders sayısı olarak yorumlandı; varsayılan saat (09:00) kullanıldı");
      }
    } else {
      infoNotes.push("Saat bilgisi bulunmadığı için varsayılan saat (09:00) kullanıldı");
    }

    const rowTeacherRaw =
      teacherCol >= 0 ? cellToDisplayString(raw[teacherCol]) : extraTeacherCol >= 0 ? cellToDisplayString(raw[extraTeacherCol]) : "";
    const teacherNameRaw = rowTeacherRaw || teacherNameMeta || "";
    const teacherCandidates = splitTeacherNames(teacherNameRaw);
    if (teacherCandidates.length > 1) {
      warn(`Birden fazla öğretmen tespit edildi ('${teacherNameRaw}'); ilk öğretmen kullanılacak — çoklu ders`);
    }
    const firstTeacherName = teacherCandidates[0] ?? "";

    // Real files title every metadata teacher name with a trailing "HOCA"
    // honorific that never matches how the teacher is actually named in the
    // system — try the exact name first, then the honorific-stripped form.
    let teacherRes = firstTeacherName ? resolveTeacherByName(firstTeacherName, teacherIndex) : null;
    let resolvedTeacherName = firstTeacherName;
    if (firstTeacherName && !teacherRes?.teacher) {
      const stripped = stripHocaHonorific(firstTeacherName);
      if (stripped && stripped !== firstTeacherName) {
        const strippedRes = resolveTeacherByName(stripped, teacherIndex);
        if (strippedRes.teacher) {
          teacherRes = strippedRes;
          resolvedTeacherName = stripped;
          infoNotes.push(`Öğretmen adı '${firstTeacherName}' → '${stripped}' olarak normalize edildi (HOCA eki kaldırıldı)`);
        }
      }
    }

    let teacher = teacherRes?.teacher ?? null;
    if (!teacher && firstTeacherName && allowTeacherAutoCreate) {
      teacher = {
        id: newId("teacher", rowNumber),
        tenantId: "tenant-1",
        fullName: stripHocaHonorific(firstTeacherName) || firstTeacherName,
        phone: "—",
        status: "active",
        specializations: [],
        createdAt: new Date().toISOString(),
      };
      addTeacherToIndex(teacherIndex, teacher);
      resolvedTeacherName = teacher.fullName;
      warn(`'${firstTeacherName}' adlı öğretmen sistemde bulunamadığı için otomatik oluşturuldu`);
    } else if (teacher && teacherRes?.ambiguous) {
      warn(`'${resolvedTeacherName}' adında birden fazla öğretmen bulundu; ilk eşleşme kullanılacak`);
    }

    const matches: ImportEntityMatch[] = [
      { entityType: "Öğrenci", value: studentName, matched: true },
      ...(firstTeacherName ? [{ entityType: "Öğretmen" as const, value: resolvedTeacherName, matched: !!teacherRes?.teacher }] : []),
    ];

    if (!firstTeacherName || !teacher) {
      rows.push({
        preview: {
          rowNumber,
          displayText,
          status: "error",
          issues: [...infoNotes, firstTeacherName ? `'${firstTeacherName}' adlı öğretmen sistemde bulunamadı` : "Öğretmen bilgisi bulunamadı"],
          entityMatches: matches,
          include: false,
          repairHints: { fee: feeHint, time: timeStr },
        },
        staged: [],
      });
      continue;
    }

    const unitFee = fee ?? (amount !== null && sessionCount > 0 ? amount / sessionCount : null);
    if (unitFee === null) {
      rows.push({
        preview: {
          rowNumber,
          displayText,
          status: "error",
          issues: [...infoNotes, "Ders ücreti veya tutar bilgisi bulunamadı"],
          entityMatches: matches,
          include: false,
          repairHints: { time: timeStr },
        },
        staged: [],
      });
      continue;
    }
    if (fee !== null && amount !== null && Math.abs(fee * sessionCount - amount) > 1) {
      warn(`Tutar (${amount}) ile Ders Ücreti × Ders Sayısı (${fee * sessionCount}) uyuşmuyor`);
    }

    const startsAt = `${dateStr}T${timeStr}:00`;
    const duplicate = findDuplicateSession(studentRes.student.id, teacher.id, defaultEducationTypeId, startsAt, sessionDuplicateIndex);
    if (duplicate) {
      rows.push({ preview: { rowNumber, displayText, status: "duplicate", issues: ["Bu seans zaten mevcut"], entityMatches: matches, include: false }, staged: [] });
      continue;
    }

    const conflict = checkSessionConflictIndexed(sessionConflictIndex, {
      studentId: studentRes.student.id,
      teacherId: teacher.id,
      startsAt,
      durationMinutes: DEFAULT_CONFLICT_DURATION_MINUTES,
    });
    if (conflict.hasConflict) warn(conflict.message ?? "Bu öğrenci veya öğretmen aynı saatte başka bir seansa kayıtlı");

    // This file format only ever carries student billing (Ders Ücreti / Tutar) —
    // never teacher payout. calculateTeacherSessionEarning returns null when the
    // teacher has no configured earning model/price; that must never be silently
    // presented as a real ₺0 hakediş in the financial preview (see teacherEarningUnknown).
    const calculatedTeacherEarning = calculateTeacherSessionEarning(teacher, defaultEducationTypeId, unitFee, teacherCustomPrices);
    const teacherEarningUnknown = calculatedTeacherEarning === null;
    const teacherEarning = calculatedTeacherEarning ?? 0;
    if (teacherEarningUnknown) {
      infoNotes.push("Öğretmen hakedişi hesaplanamadı; öğretmen ücret ayarları tamamlandıktan sonra sistem tarafından hesaplanacaktır");
    }

    const noteCell = noteCol >= 0 ? cellToDisplayString(raw[noteCol]) : "";
    const notes = [
      `Kaynak: '${sheet.name}' ders takip sayfası`,
      teacherCandidates.length > 1 ? `Orijinal öğretmen: ${teacherNameRaw}` : null,
      noteCell || null,
    ]
      .filter((n): n is string => !!n)
      .join(" · ");

    const session: Session = {
      id: newId("session", rowNumber),
      tenantId: "tenant-1",
      studentId: studentRes.student.id,
      teacherId: teacher.id,
      educationTypeId: defaultEducationTypeId,
      date: startsAt,
      durationMinutes: DEFAULT_CONFLICT_DURATION_MINUTES,
      sessionCount,
      studentPrice: unitFee,
      teacherEarning,
      status: mode === "historical" ? "completed" : "planned",
      notes,
      createdAt: new Date().toISOString(),
      billingMode,
      teacherEarningStatus: teacherEarningUnknown ? "unknown" : "calculated",
    };
    addSessionToDuplicateIndex(sessionDuplicateIndex, session);
    addSessionToConflictIndex(sessionConflictIndex, session);

    const includeByDefault = conflict.hasConflict ? mode === "historical" : true;
    const staged: StagedRow["staged"] = teacherRes?.teacher ? [] : [{ kind: "teachers", record: teacher }];
    staged.push({ kind: "sessions", record: session });

    if (billingMode === "historical_non_billable") {
      infoNotes.push("Geçmiş kayıt — borca dahil değil");
    }

    rows.push({
      preview: {
        rowNumber,
        displayText,
        status: hasWarning ? "warning" : "valid",
        issues: infoNotes,
        entityMatches: matches,
        include: includeByDefault,
        teacherEarningUnknown,
      },
      staged,
    });
  }

  return {
    sheetName: sheet.name,
    studentName,
    teacherName: teacherNameMeta,
    weeklySessionCount,
    headerRowFound: true,
    rows,
    skippedRowCount,
  };
}

// ─── Roster-based student creation (first-time migration) ──────────────────────

// A roster sheet is usually just a bare column of names with NO real header row at
// all — but the generic parser always treats row 1 as `sheet.headers` regardless, so
// a roster's very first name silently lands in `.headers` instead of `.rows` unless
// that first cell is actually one of these known label words.
const ROSTER_HEADER_LABELS = new Set(["öğrenci adı", "adı soyadı", "ad soyad", "isim", "öğrenci", "sıra no", "sıra", "no", "ad-soyad"]);

function looksLikeRosterHeaderLabel(s: string): boolean {
  return ROSTER_HEADER_LABELS.has(normalizeForTokenMatch(s.trim()));
}

/** Canonical student roster for the workbook: every LİSTE row (if present) UNION
 *  every lesson sheet's own metadata name — inclusive on purpose, since LİSTE is
 *  only present "if present" and a lesson sheet's own name must still resolve even
 *  when LİSTE is missing or incomplete. */
export function collectStudentLedgerRoster(listSheet: ParsedSheet | null, lessonSheets: ParsedSheet[]): string[] {
  const names = new Set<string>();
  if (listSheet) {
    const firstCell = listSheet.headers[0] ?? "";
    const firstRowIsRealHeader = looksLikeRosterHeaderLabel(firstCell);
    const allRows = firstRowIsRealHeader ? listSheet.rows : [listSheet.headers, ...listSheet.rows];
    for (const row of allRows) {
      const name = cellToDisplayString(row[0]);
      if (name) names.add(name);
    }
  }
  for (const sheet of lessonSheets) {
    const { studentName } = extractLedgerSheetMetadata(sheet);
    if (studentName) names.add(studentName);
  }
  return [...names];
}

function buildStudentLedgerStudentCreationRows(rosterNames: string[], studentIndex: StudentIndex): StagedRow[] {
  const rows: StagedRow[] = [];
  let rowNumber = 1;

  for (const name of rosterNames) {
    rowNumber++;
    // Exact-name resolution only (no phone/guardian corroboration exists in this
    // format) — matches how every other FK lookup in this file already treats an
    // existing same-name record as the same person, which is what makes re-running
    // the same ledger import idempotent instead of creating duplicates each time.
    const existing = resolveStudentByName(name, studentIndex);
    if (existing.student) continue;

    const student: Student = {
      id: newId("student", rowNumber),
      tenantId: "tenant-1",
      fullName: name,
      birthDate: "",
      status: "active",
      guardianIds: [],
      educationTypeIds: [],
      notes: "Öğrenci Bazlı Ders Takip Defteri içe aktarımından otomatik oluşturuldu",
      createdAt: new Date().toISOString(),
    };
    addStudentToIndex(studentIndex, student);

    rows.push({
      preview: {
        rowNumber,
        displayText: name,
        status: "valid",
        issues: [],
        entityMatches: [{ entityType: "Öğrenci", value: name, matched: false }],
        include: true,
      },
      staged: [{ kind: "students", record: student }],
    });
  }

  return rows;
}

// ─── Workbook-level orchestration ────────────────────────────────────────────

export interface StudentLedgerImportResult {
  studentCreationRows: StagedRow[];
  sheetResults: StudentLedgerSheetResult[];
}

/** No Payment records are ever created from this path — this file is lesson/tahakkuk
 *  data, never payment history (rule 13). Creates any roster student missing from
 *  `existingStudents` BEFORE resolving lesson rows, so a first-time migration (the
 *  common case for this format) doesn't fail every row for want of Students imported
 *  first. Duplicate/conflict checks accumulate across every sheet in the same run. */
export function buildStudentLedgerImport(
  lessonSheets: ParsedSheet[],
  listSheet: ParsedSheet | null,
  existingStudents: Student[],
  existingTeachers: Teacher[],
  defaultEducationTypeId: string,
  existingSessions: Session[],
  mode: ImportMode,
  /** False unless "Öğretmenler" is one of the selected import types this run —
   *  see [[extractStudentLedgerSheet]]'s allowTeacherAutoCreate parameter. */
  allowTeacherAutoCreate: boolean,
  teacherCustomPrices: TeacherCustomPrice[],
  /** See [[extractStudentLedgerSheet]]'s billingMode parameter — applies to
   *  every session this whole workbook stages. */
  billingMode: SessionBillingMode
): StudentLedgerImportResult {
  const studentIndex = buildStudentIndex(existingStudents);
  const teacherIndex = buildTeacherIndex(existingTeachers);
  const sessionDuplicateIndex = buildSessionDuplicateIndex(existingSessions);
  const sessionConflictIndex = buildSessionConflictIndex(existingSessions);

  const roster = collectStudentLedgerRoster(listSheet, lessonSheets);
  const studentCreationRows = buildStudentLedgerStudentCreationRows(roster, studentIndex);

  const sheetResults = lessonSheets.map((sheet) =>
    extractStudentLedgerSheet(
      sheet,
      studentIndex,
      teacherIndex,
      defaultEducationTypeId,
      sessionDuplicateIndex,
      sessionConflictIndex,
      mode,
      allowTeacherAutoCreate,
      teacherCustomPrices,
      billingMode
    )
  );

  return { studentCreationRows, sheetResults };
}

// ─── Self-registering analyzer rule (see workbook-analyzer.ts registry) ────────

export const STUDENT_LEDGER_RESULT_LABEL = "Öğrenci Bazlı Ders Takip Defteri";

const studentLedgerAnalyzerRule: AnalyzerRule = {
  id: "student-ledger",
  resultType: "studentLedger",
  label: STUDENT_LEDGER_RESULT_LABEL,
  evaluate: ({ sheet, allSheets }) => {
    // A roster sheet (LİSTE / Öğrenci Listesi / Master Liste) that's just a bare
    // name column is recognized on its own — it never needs a sibling ledger sheet
    // to make sense of it, and it must never fall through to "unknown".
    if (isRosterSheetName(sheet.name) && !sheetHasLedgerLessonHeader(sheet)) {
      return { confidence: 0.95, reasons: ["Sayfa adı öğrenci listesi/roster kalıbıyla eşleşti", "Sadece isim sütunu içeriyor, ders satırı yok"] };
    }

    // An unfilled copy of the per-student template ("BOŞ", "BOŞ (2)", …) must never
    // fall through to a classic-table rule just because its (empty) header row still
    // contains the ledger's field labels — it belongs in this same bucket so it's
    // recognized and skipped, never routed to a manual mapping screen it has nothing
    // real to map.
    if (isBlankTemplateSheetName(sheet.name)) {
      return { confidence: 0.9, reasons: ["Sayfa adı boş şablon kalıbıyla eşleşti (BOŞ)", "Doldurulmuş öğrenci adı veya ders satırı bulunamadı"] };
    }

    const detection = detectStudentLedgerWorkbook(allSheets);
    if (!detection.isStudentLedgerWorkbook) return null;
    const match = detection.ledgerSheets.find((c) => c.sheet === sheet);
    if (!match) return null;
    return { confidence: Math.min(1, match.score / 7), reasons: match.reasons };
  },
};

registerAnalyzerRule(studentLedgerAnalyzerRule);
