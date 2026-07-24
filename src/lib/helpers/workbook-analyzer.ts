// ─── Workbook Analyzer ───────────────────────────────────────────────────────
// Classifies each sheet in an uploaded workbook BEFORE the mapping screen, so the
// importer never assumes every sheet is a flat "row = record" table. Detection is
// driven entirely by a registry of small, independent rules (ANALYZER_RULES) —
// adding support for a future customer's Excel shape means registering one more
// rule, never touching the scoring/classification logic below.

import type { ImportEntityType, ImportEntityMatch, ImportMode, Student, Teacher, Session, TeacherEducationTypeAssignment } from "@/types";
import { cellToDisplayString, parseCellAsDateString, type ParsedSheet, type RawCell } from "@/lib/helpers/import-parse";
import {
  IMPORT_ENTITY_TYPES,
  getImportTypeLabel,
  getSystemFieldsForImportType,
  suggestColumnMappings,
  newId,
  type StagedRow,
} from "@/lib/helpers/import";
import {
  resolveStudentByName,
  resolveTeacherByName,
  findDuplicateSession,
  buildStudentIndex,
  buildTeacherIndex,
  buildSessionDuplicateIndex,
  addSessionToDuplicateIndex,
} from "@/lib/helpers/import-match";
import {
  buildSessionConflictIndex,
  addSessionToConflictIndex,
  checkSessionConflictIndexed,
  DEFAULT_CONFLICT_DURATION_MINUTES,
} from "@/lib/helpers/session-conflict";
import { calculateTeacherSessionEarning } from "@/lib/helpers/finance";
import { isTeacherAssignedToEducationType } from "@/lib/helpers/teacher-assignments";

// ─── Signals ─────────────────────────────────────────────────────────────────

export interface SheetSignals {
  /** How much the first row looks like a proper header row (unique, non-numeric, filled). */
  headerConfidence: number;
  mergedCellRatio: number;
  numericTextRatio: number;
  emptyRowFrequency: number;
  avgCols: number;
  avgRows: number;
  duplicateHeaderCount: number;
  hasMultipleHeaderRows: boolean;
  isMonthlySheetName: boolean;
  /** Fraction of headers that look like person names or month labels — a proxy
   *  for "columns are actually teacher names / months", i.e. a matrix, not a table. */
  repeatingBlockScore: number;
  /** Absolute count backing repeatingBlockScore — a ratio alone lets a 1-column
   *  sheet hit 100%; matrices need several repeated entity-like columns, not one. */
  repeatingBlockCount: number;
  detectedDateCount: number;
  detectedPhoneCount: number;
  detectedMoneyCount: number;
  detectedNameCount: number;
}

const MONTH_NAMES_TR = [
  "ocak", "şubat", "subat", "mart", "nisan", "mayıs", "mayis", "haziran",
  "temmuz", "ağustos", "agustos", "eylül", "eylul", "ekim", "kasım", "kasim", "aralık", "aralik",
];

function isMonthlySheetName(name: string): boolean {
  const lower = name.trim().toLocaleLowerCase("tr-TR");
  if (MONTH_NAMES_TR.some((m) => lower.includes(m))) return true;
  return /\b(0?[1-9]|1[0-2])[./-]\d{4}\b/.test(lower);
}

function looksLikePersonName(s: string): boolean {
  const trimmed = s.trim();
  if (!trimmed) return false;
  const words = trimmed.split(/\s+/);
  if (words.length < 2 || words.length > 4) return false;
  return words.every((w) => /^[A-ZÇĞİÖŞÜ][a-zçğıöşüA-ZÇĞİÖŞÜ.]*$/.test(w));
}

// A header built entirely from these words describes a COLUMN'S PURPOSE ("Veli Adı",
// "Doğum Tarihi", "Ödeme Şekli") — it is not an actual person/entity name, even though
// it shares the "2-4 Title-Case words" shape with one. Without this exclusion, almost
// every well-labelled classic Turkish table (Students, Sessions, Opening Balances…)
// gets misread as "columns are entity names", i.e. a timetable matrix.
const FIELD_LABEL_WORDS = new Set([
  "ad", "adı", "adi", "soyad", "soyadı", "soyadi", "veli", "öğrenci", "ogrenci",
  "öğretmen", "ogretmen", "telefon", "tarih", "tarihi", "doğum", "dogum", "tutar",
  "ücret", "ucret", "ücreti", "ucreti", "durum", "not", "notlar", "adres", "eğitim",
  "egitim", "türü", "turu", "tür", "tur", "seans", "sayısı", "sayisi", "ödeme", "odeme",
  "şekli", "sekli", "yakınlık", "yakinlik", "e-posta", "eposta", "email", "bakiye",
  "borç", "borc", "alacak", "açıklama", "aciklama", "hakediş", "hakedis", "fiyat",
  "saat", "hafta", "haftalık", "haftalik", "yöntemi", "yontemi",
]);

function isFieldLabelWord(word: string): boolean {
  return FIELD_LABEL_WORDS.has(word.toLocaleLowerCase("tr-TR").replace(/[():.,]/g, ""));
}

/** The signal actually used for matrix detection: a date-shaped header always counts
 *  (a real column of dates/months is never a "field label"); a name-shaped header only
 *  counts if none of its words are common column-purpose vocabulary. */
function looksLikeRepeatingEntityHeader(s: string): boolean {
  if (isMonthlySheetName(s)) return true;
  if (!looksLikePersonName(s)) return false;
  return !s.trim().split(/\s+/).some(isFieldLabelWord);
}

function looksLikePhone(s: string): boolean {
  const digits = s.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 13;
}

function looksLikeMoney(cell: RawCell): boolean {
  if (typeof cell === "number") return cell > 0;
  if (typeof cell !== "string") return false;
  return /₺/.test(cell) || /\d+[.,]\d{2}\b/.test(cell);
}

function computeGenericHeaderConfidence(sheet: ParsedSheet): number {
  const headers = sheet.headers.filter((h) => h.trim() !== "");
  if (headers.length === 0) return 0;
  const uniqueRatio = new Set(headers.map((h) => h.trim().toLocaleLowerCase("tr-TR"))).size / headers.length;
  const allNonNumeric = headers.every((h) => Number.isNaN(Number(h.replace(",", "."))));
  const fillRatio = headers.length / Math.max(sheet.headers.length, 1);
  return Math.min(1, uniqueRatio * 0.5 + (allNonNumeric ? 0.3 : 0) + fillRatio * 0.2);
}

export function computeSheetSignals(sheet: ParsedSheet): SheetSignals {
  let numericCells = 0;
  let textCells = 0;
  let dateCount = 0;
  let phoneCount = 0;
  let moneyCount = 0;
  let nameCount = 0;
  let emptyRows = 0;

  for (const row of sheet.rows) {
    const nonEmptyCount = row.filter((c) => cellToDisplayString(c) !== "").length;
    if (row.length === 0 || nonEmptyCount / Math.max(row.length, 1) < 0.34) emptyRows++;
    for (const cell of row) {
      const display = cellToDisplayString(cell);
      if (display === "") continue;
      if (typeof cell === "number") numericCells++;
      else textCells++;
      if (parseCellAsDateString(cell)) dateCount++;
      if (looksLikePhone(display)) phoneCount++;
      if (looksLikeMoney(cell)) moneyCount++;
      if (looksLikePersonName(display)) nameCount++;
    }
  }

  const totalDataCells = numericCells + textCells;

  const headerCounts = new Map<string, number>();
  for (const h of sheet.headers) {
    const key = h.trim().toLocaleLowerCase("tr-TR");
    if (!key) continue;
    headerCounts.set(key, (headerCounts.get(key) ?? 0) + 1);
  }
  const duplicateHeaderCount = [...headerCounts.values()].filter((c) => c > 1).length;

  const firstDataRow = sheet.rows[0];
  const hasMultipleHeaderRows =
    !!firstDataRow &&
    firstDataRow.some((c) => cellToDisplayString(c) !== "") &&
    firstDataRow.every((c) => {
      const d = cellToDisplayString(c);
      return d === "" || Number.isNaN(Number(d.replace(",", ".")));
    });

  const headerLikeCols = sheet.headers.filter((h) => looksLikeRepeatingEntityHeader(h));
  const repeatingBlockScore = sheet.headers.length > 0 ? headerLikeCols.length / sheet.headers.length : 0;
  const repeatingBlockCount = headerLikeCols.length;

  const mergedCellRatio =
    sheet.totalCellCount && sheet.totalCellCount > 0 ? (sheet.mergedCellCount ?? 0) / sheet.totalCellCount : 0;

  return {
    headerConfidence: computeGenericHeaderConfidence(sheet),
    mergedCellRatio,
    numericTextRatio: totalDataCells > 0 ? numericCells / totalDataCells : 0,
    emptyRowFrequency: sheet.rows.length > 0 ? emptyRows / sheet.rows.length : 0,
    avgCols: sheet.sheetColCount ?? sheet.headers.length,
    avgRows: sheet.sheetRowCount ?? sheet.rows.length,
    duplicateHeaderCount,
    hasMultipleHeaderRows,
    isMonthlySheetName: isMonthlySheetName(sheet.name),
    repeatingBlockScore,
    repeatingBlockCount,
    detectedDateCount: dateCount,
    detectedPhoneCount: phoneCount,
    detectedMoneyCount: moneyCount,
    detectedNameCount: nameCount,
  };
}

// ─── Rule registry ───────────────────────────────────────────────────────────

export type AnalyzerResultType = ImportEntityType | "scheduleMatrix" | "studentLedger" | "unknown";

export interface AnalyzerRuleContext {
  sheet: ParsedSheet;
  signals: SheetSignals;
  allSheets: ParsedSheet[];
}

export interface AnalyzerRule {
  id: string;
  resultType: AnalyzerResultType;
  /** Human label for UI dropdowns / debugging. */
  label: string;
  /** Returns null when the rule plainly doesn't apply (avoids polluting allScores). */
  evaluate: (ctx: AnalyzerRuleContext) => { confidence: number; reasons: string[] } | null;
}

/** Scores a sheet against one classic entity type by reusing the SAME header-alias
 *  table the mapping screen already trusts (suggestColumnMappings) — one source of
 *  truth for "what does a Students/Payments/... sheet look like". */
function scoreHeaderMatchForType(sheet: ParsedSheet, type: ImportEntityType): { confidence: number; reasons: string[] } {
  const mapping = suggestColumnMappings(sheet, type);
  const systemFields = getSystemFieldsForImportType(type);
  const requiredKeys = systemFields.filter((f) => f.required).map((f) => f.key);
  const matchedKeys = new Set(mapping.map((m) => m.systemField).filter((f): f is string => f !== null));
  const requiredMatched = requiredKeys.filter((k) => matchedKeys.has(k));
  const requiredRatio = requiredKeys.length > 0 ? requiredMatched.length / requiredKeys.length : 0;
  const overallRatio = systemFields.length > 0 ? matchedKeys.size / systemFields.length : 0;
  const confidence = requiredRatio * 0.7 + overallRatio * 0.3;
  const reasons = systemFields.filter((f) => matchedKeys.has(f.key)).map((f) => `'${f.label}' sütunu bulundu`);
  return { confidence, reasons };
}

function classicTableRule(type: ImportEntityType): AnalyzerRule {
  return {
    id: `classic-${type}`,
    resultType: type,
    label: getImportTypeLabel(type),
    evaluate: ({ sheet, signals }) => {
      const { confidence, reasons } = scoreHeaderMatchForType(sheet, type);
      if (confidence <= 0) return null;
      // A sheet that's mostly merged cells / a repeating name-or-date grid is more
      // likely a matrix than a real table, even if a couple of header aliases happen
      // to match — but require several repeated entity-like columns (>=3), not just a
      // high ratio, so a small well-labelled table (4-6 ordinary Turkish headers) never
      // trips this off a single coincidental match.
      const looksLikeMatrixShape = signals.mergedCellRatio > 0.15 || (signals.repeatingBlockScore > 0.5 && signals.repeatingBlockCount >= 3);
      const shapeAdjustment = looksLikeMatrixShape ? -0.25 : 0;
      return { confidence: Math.max(0, Math.min(1, confidence + shapeAdjustment)), reasons };
    },
  };
}

const scheduleMatrixRule: AnalyzerRule = {
  id: "schedule-matrix",
  resultType: "scheduleMatrix",
  label: "Zaman Çizelgesi Matrisi",
  evaluate: ({ signals }) => {
    const reasons: string[] = [];
    let score = 0;
    if (signals.mergedCellRatio > 0.05) {
      score += 0.35;
      reasons.push("Birleştirilmiş hücreler tespit edildi");
    }
    if (signals.repeatingBlockScore > 0.4 && signals.repeatingBlockCount >= 3) {
      score += 0.35;
      reasons.push("Tekrarlayan zaman çizelgesi düzeni tespit edildi");
    }
    if (signals.isMonthlySheetName) {
      score += 0.15;
      reasons.push("Aylık sayfa adı tespit edildi");
    }
    if (signals.hasMultipleHeaderRows) {
      score += 0.15;
      reasons.push("Birden fazla başlık satırı tespit edildi");
    }
    if (score === 0) return null;
    return { confidence: Math.min(1, score), reasons };
  },
};

/** Data-driven registry — evaluated in full for every sheet, highest confidence wins.
 *  Extra shapes (see student-ledger-import.ts) self-register via registerAnalyzerRule
 *  instead of requiring changes here. */
export const ANALYZER_RULES: AnalyzerRule[] = [
  ...IMPORT_ENTITY_TYPES.map((type) => classicTableRule(type)),
  scheduleMatrixRule,
];

export function registerAnalyzerRule(rule: AnalyzerRule): void {
  ANALYZER_RULES.push(rule);
}

// ─── Classification ──────────────────────────────────────────────────────────

export interface SheetClassification {
  sheet: ParsedSheet;
  signals: SheetSignals;
  resultType: AnalyzerResultType;
  confidence: number;
  reasons: string[];
  allScores: { resultType: AnalyzerResultType; confidence: number }[];
}

const UNKNOWN_FLOOR_CONFIDENCE = 0.3;

export function classifyWorkbook(sheets: ParsedSheet[]): SheetClassification[] {
  return sheets.map((sheet) => {
    const signals = computeSheetSignals(sheet);
    const scored = ANALYZER_RULES.map((rule) => {
      const evaluated = rule.evaluate({ sheet, signals, allSheets: sheets });
      return evaluated ? { rule, ...evaluated } : null;
    })
      .filter((r): r is { rule: AnalyzerRule; confidence: number; reasons: string[] } => r !== null)
      .sort((a, b) => b.confidence - a.confidence);

    const allScores = scored.map((s) => ({ resultType: s.rule.resultType, confidence: s.confidence }));
    const best = scored[0];

    if (!best || best.confidence < UNKNOWN_FLOOR_CONFIDENCE) {
      return {
        sheet,
        signals,
        resultType: "unknown" as const,
        confidence: best?.confidence ?? 0,
        reasons: best?.reasons ?? ["Bilinen bir yapıyla eşleşmedi"],
        allScores,
      };
    }

    return {
      sheet,
      signals,
      resultType: best.rule.resultType,
      confidence: best.confidence,
      reasons: best.reasons,
      allScores,
    };
  });
}

// ─── Matrix → Session conversion ─────────────────────────────────────────────
// Generic, best-effort: never fabricates a Student/Teacher, never invents a clock
// time the sheet doesn't have, and only ever stages a real Session record when
// BOTH the date and the student can be resolved AND a teacher can be implied from
// the sheet name (a common real-world convention — one timetable sheet per
// teacher). Every staged row is deliberately marked "warning", never "valid",
// since a matrix-derived session is inherently a best guess about a default time.
// Anything short of that is reported as a skipped warning row instead of a guess.
export function convertMatrixSheetToSessionCandidates(
  sheet: ParsedSheet,
  teachers: Teacher[],
  students: Student[],
  educationTypeId: string,
  existingSessions: Session[],
  mode: ImportMode,
  assignments: TeacherEducationTypeAssignment[] = []
): StagedRow[] {
  const colHeaders = sheet.headers.slice(1);
  const rowLabels = sheet.rows.map((r) => cellToDisplayString(r[0]));

  const colDateCount = colHeaders.filter((h) => parseCellAsDateString(h)).length;
  const rowDateCount = rowLabels.filter((r) => parseCellAsDateString(r)).length;
  const dateAxis: "row" | "col" | null =
    rowDateCount === 0 && colDateCount === 0 ? null : rowDateCount >= colDateCount ? "row" : "col";

  const teacherIndex = buildTeacherIndex(teachers);
  const studentIndex = buildStudentIndex(students);
  const sessionDuplicateIndex = buildSessionDuplicateIndex(existingSessions);
  const sessionConflictIndex = buildSessionConflictIndex(existingSessions);
  const impliedTeacher = resolveTeacherByName(sheet.name, teacherIndex).teacher;
  const rows: StagedRow[] = [];
  let rowNumber = 1;

  sheet.rows.forEach((raw, rIdx) => {
    const rowLabel = rowLabels[rIdx] ?? "";
    colHeaders.forEach((colHeader, cIdx) => {
      const cell = raw[cIdx + 1];
      const display = cellToDisplayString(cell);
      if (!display) return;
      rowNumber++;

      const dateStr =
        dateAxis === "row" ? parseCellAsDateString(rowLabel) : dateAxis === "col" ? parseCellAsDateString(colHeader) : null;
      const nameValue = dateAxis === "row" ? colHeader : dateAxis === "col" ? rowLabel : null;
      const displayText = `${rowLabel} × ${colHeader} = ${display}`;

      if (!dateStr) {
        rows.push({ preview: { rowNumber, displayText, status: "warning", issues: ["Bu hücre için tarih tespit edilemedi"], entityMatches: [], include: false }, staged: [] });
        return;
      }
      if (!nameValue) {
        rows.push({ preview: { rowNumber, displayText, status: "warning", issues: ["Bu hücre için öğrenci bilgisi tespit edilemedi"], entityMatches: [], include: false }, staged: [] });
        return;
      }

      const studentRes = resolveStudentByName(nameValue, studentIndex);
      const baseMatches: ImportEntityMatch[] = [];
      if (!studentRes.student) {
        rows.push({
          preview: { rowNumber, displayText, status: "warning", issues: [`'${nameValue}' adlı öğrenci sistemde bulunamadı`], entityMatches: [{ entityType: "Öğrenci", value: nameValue, matched: false }], include: false },
          staged: [],
        });
        return;
      }
      baseMatches.push({ entityType: "Öğrenci", value: nameValue, matched: true });

      if (!impliedTeacher) {
        rows.push({
          preview: { rowNumber, displayText, status: "warning", issues: [`Bu sayfa için öğretmen tespit edilemedi ('${sheet.name}' adında bir öğretmen bulunamadı)`], entityMatches: baseMatches, include: false },
          staged: [],
        });
        return;
      }
      baseMatches.push({ entityType: "Öğretmen", value: impliedTeacher.fullName, matched: true });

      const fee = typeof cell === "number" ? cell : null;
      const startsAt = `${dateStr}T09:00:00`;

      const duplicate = findDuplicateSession(studentRes.student.id, impliedTeacher.id, educationTypeId, startsAt, sessionDuplicateIndex);
      if (duplicate) {
        rows.push({ preview: { rowNumber, displayText, status: "duplicate", issues: ["Bu seans zaten mevcut"], entityMatches: baseMatches, include: false }, staged: [] });
        return;
      }

      const conflict = checkSessionConflictIndexed(sessionConflictIndex, {
        studentId: studentRes.student.id,
        teacherId: impliedTeacher.id,
        startsAt,
        durationMinutes: DEFAULT_CONFLICT_DURATION_MINUTES,
      });

      const issues: string[] = ["Matriste saat bilgisi bulunmadığı için varsayılan olarak 09:00 kullanıldı"];
      if (fee === null) issues.push("Hücredeki değer sayısal ücret olarak okunamadı; ücret 0 olarak alındı");
      if (conflict.hasConflict) issues.push(conflict.message ?? "Bu öğrenci veya öğretmen aynı saatte başka bir seansa kayıtlı");

      const studentPrice = fee ?? 0;
      const assignmentIncompatible = !isTeacherAssignedToEducationType(impliedTeacher.id, educationTypeId, assignments);
      if (assignmentIncompatible) {
        issues.push(`'${impliedTeacher.fullName}' adlı öğretmen bu eğitim türünü vermek üzere tanımlanmamış`);
      }
      // A matrix sheet is a timetable, not a payout record — calculateTeacherSessionEarning
      // returns null when the teacher has no configured earning model/price, and that must
      // never be presented as a real ₺0 hakediş (see teacherEarningUnknown).
      const calculatedTeacherEarning = assignmentIncompatible
        ? null
        : calculateTeacherSessionEarning(impliedTeacher, educationTypeId, studentPrice, assignments);
      const teacherEarningUnknown = calculatedTeacherEarning === null;
      const teacherEarning = calculatedTeacherEarning ?? 0;
      if (teacherEarningUnknown && !assignmentIncompatible) {
        issues.push("Öğretmen hakedişi hesaplanamadı; öğretmen ücret ayarları tamamlandıktan sonra sistem tarafından hesaplanacaktır");
      }

      const session: Session = {
        id: newId("session", rowNumber),
        tenantId: "tenant-1",
        studentId: studentRes.student.id,
        teacherId: impliedTeacher.id,
        educationTypeId,
        date: startsAt,
        durationMinutes: DEFAULT_CONFLICT_DURATION_MINUTES,
        sessionCount: 1,
        studentPrice,
        teacherEarning,
        status: mode === "historical" ? "completed" : "planned",
        notes: `Kaynak: '${sheet.name}' matris sayfası`,
        createdAt: new Date().toISOString(),
        teacherEarningStatus: teacherEarningUnknown ? "unknown" : "calculated",
      };
      addSessionToDuplicateIndex(sessionDuplicateIndex, session);
      addSessionToConflictIndex(sessionConflictIndex, session);

      const includeByDefault = conflict.hasConflict ? mode === "historical" : true;

      rows.push({
        preview: {
          rowNumber,
          displayText,
          status: "warning",
          issues,
          entityMatches: baseMatches,
          include: includeByDefault,
          teacherEarningUnknown,
          teacherAssignmentIncompatible: assignmentIncompatible,
        },
        staged: [{ kind: "sessions", record: session }],
      });
    });
  });

  return rows;
}
