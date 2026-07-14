"use client";

import { useEffect, useMemo, useRef, useState, Fragment } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Upload,
  FileCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Users,
  UserRound,
  GraduationCap,
  CalendarDays,
  CreditCard,
  Banknote,
  Scale,
  RotateCcw,
  Table2,
  FileWarning,
  CircleSlash,
  Grid3x3,
  BookOpen,
  HelpCircle,
  Filter,
  Info,
  X,
  TrendingUp,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useMockStore } from "@/lib/mock/store";
import { mockEducationTypes } from "@/lib/mock/education-types";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDateTime, calculateTeacherSessionEarning } from "@/lib/helpers/finance";
import type {
  ImportEntityType,
  ImportMode,
  ImportColumnMapping,
  ImportRowStatus,
  ImportResult,
  ImportBatch,
  EditedImportRecord,
  ImportSystemField,
  ImportEntityMatch,
  Session,
  Student,
  Teacher,
  SessionBillingMode,
} from "@/types";
import {
  IMPORT_ENTITY_TYPES,
  getImportTypeLabel,
  getSystemFieldsForImportType,
  suggestColumnMappings,
  buildImportSummary,
  buildFinancialImpact,
  buildCreationBreakdown,
  buildMultiImportPreview,
  buildStagedRows,
  commitMultiImportBatch,
  computeFileFingerprint,
  findExistingBatchByFingerprint,
  findEditedRecordsSinceImport,
  rollbackImportBatch,
  newId,
  type StagedRow,
  type StagedRecord,
  type ImportStoreSnapshot,
} from "@/lib/helpers/import";
import {
  parseSpreadsheetFile,
  isSupportedImportFile,
  parseCellAsDateString,
  parseCellAsTimeString,
  parseCellAsNumber,
  type ParsedSheet,
} from "@/lib/helpers/import-parse";
import {
  classifyWorkbook,
  convertMatrixSheetToSessionCandidates,
  type AnalyzerResultType,
} from "@/lib/helpers/workbook-analyzer";
import { buildStudentLedgerImport, isRosterSheetName, isBlankTemplateSheetName, STUDENT_LEDGER_RESULT_LABEL } from "@/lib/helpers/student-ledger-import";
import {
  buildStudentIndex,
  buildTeacherIndex,
  resolveStudentByName,
  resolveTeacherByName,
  buildSessionDuplicateIndex,
  addSessionToDuplicateIndex,
  findDuplicateSession,
} from "@/lib/helpers/import-match";
import {
  buildSessionConflictIndex,
  addSessionToConflictIndex,
  checkSessionConflictIndexed,
  DEFAULT_CONFLICT_DURATION_MINUTES,
} from "@/lib/helpers/session-conflict";

// ─── Constants ────────────────────────────────────────────────────────────────

const ENTITY_ICONS: Record<ImportEntityType, LucideIcon> = {
  students: Users,
  guardians: UserRound,
  teachers: GraduationCap,
  sessions: CalendarDays,
  payments: CreditCard,
  teacherPayments: Banknote,
  openingBalances: Scale,
};

const ENTITY_DESCRIPTIONS: Record<ImportEntityType, string> = {
  students: "Öğrenci listesi ve bağlı veli bilgileri",
  guardians: "Bağımsız veli kayıtları (telefon, adres)",
  teachers: "Öğretmen listesi ve iletişim bilgileri",
  sessions: "Seans kayıtları ve fiyat bilgileri",
  payments: "Öğrenci ödeme geçmişi",
  teacherPayments: "Öğretmene yapılan ödemeler (maaş, avans, kesinti…)",
  openingBalances: "Geçmişi olmayan, yalnızca güncel borç/alacak (Devir Bakiyesi)",
};

/** Below this, the analyzer is not confident enough to auto-decide a sheet's
 *  type — those sheets are surfaced for manual identification instead of being
 *  silently guessed. Matches workbook-analyzer.ts's own UNKNOWN_FLOOR_CONFIDENCE
 *  cutoff so "resolved here" and "resolved there" never disagree. */
const CONFIDENCE_THRESHOLD = 0.6;

const MODE_OPTIONS: { value: ImportMode; label: string; description: string }[] = [
  { value: "historical", label: "Geçmiş Veri Aktarımı", description: "Eski/geçmiş kayıtlar. Çakışan seanslar bilgilendirme amaçlı gösterilir." },
  { value: "operational", label: "Güncel Veri Aktarımı", description: "Güncel/gelecek kayıtlar. Çakışan seanslar varsayılan olarak hariç tutulur." },
];

const QUICK_STATUS_FILTERS: { value: ImportRowStatus | "all"; label: string }[] = [
  { value: "all", label: "Tümü" },
  { value: "error", label: "Sadece Hatalılar" },
  { value: "warning", label: "Sadece Uyarılılar" },
  { value: "valid", label: "Sadece Sorunsuzlar" },
];

const LEDGER_IMPORT_CHOICE_OPTIONS: { value: LedgerImportChoice; title: string; description: string }[] = [
  {
    value: "accrual",
    title: "Seansları tahakkuk olarak aktar",
    description:
      "Mevcut davranış. Öğrenci borcu / tahakkuk oluşturur. Ödenmemiş geçmiş seanslar gerçekten alacak (receivable) olarak kalması gerekiyorsa doğru seçenek budur.",
  },
  {
    value: "historyOnly",
    title: "Sadece ders geçmişi olarak aktar",
    description:
      "Seanslar ders geçmişi ve raporlar için oluşturulur ama öğrenci borcu/tahakkuk OLUŞTURMAZ — Ödemeler sayfası bu seansları ödenmemiş borç olarak göstermez. Seanslar yine de öğrenci ders geçmişinde ve devam/seans raporlarında görünür; \"Geçmiş kayıt — borca dahil değil\" olarak işaretlenir.",
  },
  {
    value: "historyWithOpeningBalance",
    title: "Net devir bakiyesi ile aktar",
    description:
      "\"Sadece ders geçmişi\" ile aynı şekilde çalışır (borç oluşturmaz) — farkı, güncel bakiyeyi daha sonra ayrı bir \"Devir Bakiyesi\" aktarımıyla (öğrenci başına net borç/alacak) gireceğinizi varsaymasıdır. Güncel bakiye o devir bakiyesi kaydından gelir, her geçmiş seanstan değil.",
  },
];

type WizardStep = "upload" | "analysis" | "mapping" | "preview";

const WIZARD_STEPS: { key: WizardStep; label: string }[] = [
  { key: "upload", label: "Dosya Yükle" },
  { key: "analysis", label: "Analiz" },
  { key: "mapping", label: "Kolon Eşleştir" },
  { key: "preview", label: "Önizleme ve Onay" },
];

const RESPONSIBILITY_NOTICE =
  "Excel kolonlarının doğru eşleştirilmesi kullanıcının sorumluluğundadır. Yanlış eşleştirme hatalı öğrenci, ödeme, seans veya bakiye oluşturabilir. Devam etmeden önce önizlemeyi dikkatlice kontrol edin.";

const CONFIRMATION_COPY =
  "Kolon eşleştirmelerini, önizleme sonuçlarını, uyarıları ve finansal etkileri kontrol ettim. Bu içe aktarma işleminin kayıt oluşturacağını onaylıyorum.";

const OVERRIDE_OPTIONS: { value: ImportEntityType | "ignore"; label: string }[] = [
  { value: "students", label: "Öğrenci" },
  { value: "guardians", label: "Veli" },
  { value: "teachers", label: "Öğretmen" },
  { value: "sessions", label: "Seans" },
  { value: "payments", label: "Ödeme" },
  { value: "teacherPayments", label: "Öğretmen Ödemesi" },
  { value: "openingBalances", label: "Devir Bakiyesi" },
  { value: "ignore", label: "Yok Say" },
];

type EffectiveAssignment = ImportEntityType | "scheduleMatrix" | "studentLedger" | "ignore" | "unresolved";

/** The 3 migration workflows offered for a historical student-ledger import (see
 *  SessionBillingMode). "historyOnly" and "historyWithOpeningBalance" both stage
 *  sessions as billingMode: "historical_non_billable" — they differ only in
 *  workflow guidance (whether the user is told to follow up with a Devir
 *  Bakiyesi import), never in what gets written to the Session record. */
type LedgerImportChoice = "accrual" | "historyOnly" | "historyWithOpeningBalance";

function ledgerChoiceToBillingMode(choice: LedgerImportChoice): SessionBillingMode {
  return choice === "accrual" ? "billable" : "historical_non_billable";
}

// ─── Interactive Error Repair ────────────────────────────────────────────────
// Lets the user fix a row's underlying VALUES from inside the wizard, then
// re-runs the exact same (unmodified) staging/validation functions the initial
// analysis used — never a parallel set of rules. The original uploaded File and
// ParsedSheet are never mutated; only the in-memory StagedRow is replaced.

type RepairFieldKind = "text" | "number" | "date" | "time" | "studentSearch" | "teacherSearch" | "educationTypeSelect" | "paymentMethodSelect";

interface RepairFieldDef {
  key: string;
  label: string;
  kind: RepairFieldKind;
}

const PAYMENT_METHOD_REPAIR_OPTIONS: { value: string; label: string }[] = [
  { value: "Nakit", label: "Nakit" },
  { value: "Havale", label: "Havale/EFT" },
  { value: "Kredi Kartı", label: "Kredi Kartı" },
  { value: "Diğer", label: "Diğer" },
];

/** Which fields a row's repair panel exposes — driven by the entry's entity
 *  type, same field-key vocabulary getSystemFieldsForImportType() already uses
 *  (so classic-sheet repair can look them up in the real ImportColumnMapping). */
function getRepairFieldsForEntry(type: ImportEntityType, isClassicSource: boolean): RepairFieldDef[] {
  switch (type) {
    case "sessions":
      return [
        { key: "studentName", label: "Öğrenci", kind: "studentSearch" },
        { key: "teacherName", label: "Öğretmen", kind: "teacherSearch" },
        ...(isClassicSource ? [{ key: "educationType", label: "Eğitim Türü", kind: "educationTypeSelect" as const }] : []),
        { key: "date", label: "Tarih", kind: "date" as const },
        { key: "time", label: "Saat", kind: "time" as const },
        { key: "studentPrice", label: "Öğrenci Birim Fiyatı (₺)", kind: "number" as const },
      ];
    case "payments":
      return [
        { key: "studentName", label: "Öğrenci", kind: "studentSearch" },
        { key: "amount", label: "Tutar (₺)", kind: "number" },
        { key: "date", label: "Tarih", kind: "date" },
        { key: "method", label: "Ödeme Yöntemi", kind: "paymentMethodSelect" },
      ];
    case "teacherPayments":
      return [
        { key: "teacherName", label: "Öğretmen", kind: "teacherSearch" },
        { key: "amount", label: "Tutar (₺)", kind: "number" },
        { key: "date", label: "Tarih", kind: "date" },
      ];
    case "openingBalances":
      return [
        { key: "studentName", label: "Öğrenci", kind: "studentSearch" },
        { key: "amount", label: "Tutar (₺)", kind: "number" },
        { key: "date", label: "Tarih", kind: "date" },
      ];
    case "students":
      return [{ key: "fullName", label: "Ad Soyad", kind: "text" }];
    case "teachers":
      return [{ key: "fullName", label: "Ad Soyad", kind: "text" }];
    case "guardians":
      return [
        { key: "fullName", label: "Ad Soyad", kind: "text" },
        { key: "phone", label: "Telefon", kind: "text" },
      ];
    default:
      return [];
  }
}

interface UploadedSheet {
  sheet: ParsedSheet;
  sourceFileName: string;
  key: string;
}

interface ClassicTask {
  key: string;
  type: ImportEntityType;
  sheet: ParsedSheet;
  sourceFileName: string;
}

interface PreviewTaskEntry {
  type: ImportEntityType;
  sheetKey: string;
  sheetLabel: string;
  rows: StagedRow[];
  /** Student-ledger sheets resolve student/teacher once from the sheet's own
   *  header metadata, independent of any single row — including rows that
   *  error out before per-row entity resolution ever runs (e.g. an invalid
   *  date short-circuits before entityMatches gets built). Repair pre-fill
   *  falls back to this when a row's own entityMatches came back empty. */
  sheetMeta?: { studentName: string | null; teacherName: string | null };
}

interface PreviewDisplayRow {
  sourceKey: string;
  sheetLabel: string;
  type: ImportEntityType;
  /** Position within its flattened list — the guaranteed-unique tiebreaker when two
   *  rows from different sheets/types happen to share row number AND display text
   *  (e.g. two unrelated sheets each with an empty-name row 2, both "(Ad boş)"). */
  idx: number;
  row: StagedRow;
}

function sheetKeyOf(sourceFileName: string, sheetName: string): string {
  return `${sourceFileName}::${sheetName}`;
}

function previewRowKey(r: PreviewDisplayRow): string {
  return `${r.type}::${r.sourceKey}::${r.row.preview.rowNumber}::${r.row.preview.status}::${r.idx}`;
}

function resultTypeLabel(rt: AnalyzerResultType): string {
  if (rt === "scheduleMatrix") return "Zaman Çizelgesi Matrisi";
  if (rt === "studentLedger") return STUDENT_LEDGER_RESULT_LABEL;
  if (rt === "unknown") return "Bilinmeyen Sayfa";
  return getImportTypeLabel(rt);
}

function sessionsFromRows(rows: StagedRow[]): Session[] {
  const out: Session[] = [];
  for (const row of rows) {
    if (row.preview.status === "error" || row.preview.status === "duplicate") continue;
    for (const s of row.staged) {
      if (s.kind === "sessions") out.push(s.record);
    }
  }
  return out;
}

function studentsFromRows(rows: StagedRow[]): Student[] {
  const out: Student[] = [];
  for (const row of rows) {
    if (row.preview.status === "error" || row.preview.status === "duplicate") continue;
    for (const s of row.staged) {
      if (s.kind === "students") out.push(s.record);
    }
  }
  return out;
}

function teachersFromRows(rows: StagedRow[]): Teacher[] {
  const out: Teacher[] = [];
  for (const row of rows) {
    if (row.preview.status === "error" || row.preview.status === "duplicate") continue;
    for (const s of row.staged) {
      if (s.kind === "teachers") out.push(s.record);
    }
  }
  return out;
}

// ─── Row inspection helpers (preview filters / grouping) ───────────────────────
// Pure, read-only helpers over StagedRow/ImportPreviewRow — never touch staging
// or commit logic, only extract display-layer signals for filtering/labeling.

/** displayText for session/ledger rows always ends "… — YYYY-MM-DD" (see
 *  buildStagedSessionRows / extractStudentLedgerSheet) — good enough for a
 *  client-side date filter without adding a new structured field to the row. */
function extractRowDate(row: StagedRow): string | null {
  const m = row.preview.displayText.match(/\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : null;
}

function extractEntityValue(row: StagedRow, entityType: string): string | null {
  return row.preview.entityMatches.find((m) => m.entityType === entityType)?.value ?? null;
}

/** Maps a verbose, dynamically-generated issue string down to a short canonical
 *  label for the collapsed table view — the full original text is still shown
 *  verbatim once the row's "Detay" toggle is opened, so nothing is lost, just
 *  deferred. Order matters: first matching rule wins. */
const ISSUE_SHORTENERS: [RegExp, string][] = [
  [/varsayılan saat.*kullanıldı/i, "Varsayılan saat kullanıldı"],
  [/ders sayısı olarak yorumlandı/i, "Saat yerine ders sayısı yorumlandı"],
  [/HOCA eki kaldırılarak|HOCA eki kaldırıldı/i, "Öğretmen adı normalize edildi"],
  [/otomatik oluşturuldu/i, "Yeni kayıt otomatik oluşturulacak"],
  [/Birden fazla öğretmen/i, "Birden fazla öğretmen tespit edildi"],
  [/birden fazla .* bulundu/i, "Birden fazla eşleşme bulundu"],
  [/aynı saatte başka bir seansa kayıtlı/i, "Seans çakışması"],
  [/ile Ders Ücreti.*uyuşmuyor/i, "Tutar uyuşmazlığı"],
  [/zaten (mevcut|kayıtlı)/i, "Zaten mevcut"],
  [/zorunlu alan boş bırakılamaz/i, "Zorunlu alan eksik"],
  [/sistemde bulunamadı/i, "Eşleşme bulunamadı"],
  [/Geçersiz veya eksik tarih/i, "Geçersiz tarih"],
  [/Bilinmeyen/i, "Bilinmeyen değer"],
  [/boş bırakılacak/i, "Alan boş bırakılacak"],
  [/Öğretmen hakedişi hesaplanamadı/i, "Öğretmen hakedişi hesaplanamadı"],
];

function shortenIssue(issue: string): string {
  for (const [re, label] of ISSUE_SHORTENERS) {
    if (re.test(issue)) return label;
  }
  return issue.length > 44 ? `${issue.slice(0, 44)}…` : issue;
}

/** A large ledger import can carry 2000+ rows; re-filtering/re-expanding all of
 *  them on EVERY keystroke in the Student/Teacher/Date search boxes would make
 *  typing feel laggy. Debouncing the value the filter predicate actually reads
 *  (while the input itself stays instantly responsive) keeps this UX-only
 *  addition from being a real perf regression on large files. */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

// ─── Local components ─────────────────────────────────────────────────────────

function ImportRowBadge({ status }: { status: ImportRowStatus }) {
  if (status === "valid")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
        <CheckCircle2 className="h-3 w-3" />
        Geçerli
      </span>
    );
  if (status === "warning")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
        <AlertTriangle className="h-3 w-3" />
        Uyarı
      </span>
    );
  if (status === "duplicate")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
        <CircleSlash className="h-3 w-3" />
        Zaten Mevcut
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
      <XCircle className="h-3 w-3" />
      Hata
    </span>
  );
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  if (confidence >= 0.85)
    return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 shrink-0">🟢 %{pct}</span>;
  if (confidence >= 0.6)
    return <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 shrink-0">🟡 %{pct}</span>;
  return <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 shrink-0">🔴 %{pct}</span>;
}

const btnPrimary =
  "inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:pointer-events-none";
const btnOutline =
  "inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-input bg-background text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors";

/** Collapsed by default — shows short canonical labels for each issue with a
 *  "Detay" toggle that reveals the original, full-length generated text. Keeps
 *  the table scannable on a 900-row sheet without throwing away any information.
 *  `detailLabel` lets a repairable row relabel the toggle (it opens the repair
 *  drawer instead of expanding inline) without changing this component's own
 *  expand/collapse behavior for every other row. */
function IssueBadges({
  issues,
  expanded,
  onToggle,
  detailLabel,
}: {
  issues: string[];
  expanded: boolean;
  onToggle: () => void;
  detailLabel?: string;
}) {
  if (issues.length === 0) return <span className="text-muted-foreground/30 text-xs">—</span>;
  const shortLabels = [...new Set(issues.map(shortenIssue))];
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1">
        {shortLabels.map((label, i) => (
          <span key={i} className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            {label}
          </span>
        ))}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="text-[11px] font-medium text-primary hover:underline underline-offset-2 shrink-0"
        >
          {detailLabel ?? (expanded ? "Detayı gizle" : "Detay >")}
        </button>
      </div>
      {expanded && <p className="text-xs text-muted-foreground border-l-2 border-border pl-2">{issues.join("; ")}</p>}
    </div>
  );
}

/** The exact raw cell text a date error names — extracted straight from the
 *  validation message itself ("Geçersiz veya eksik tarih: '<raw>'"), which
 *  buildStagedSessionRows / extractStudentLedgerSheet both already emit
 *  verbatim. Far more reliable than re-parsing displayText, which mixes
 *  student/teacher/date with separators that can themselves collide with a
 *  DD/MM/YYYY date. */
function extractRawDateTextFromIssues(issues: string[]): string | null {
  for (const issue of issues) {
    const m = issue.match(/Geçersiz veya eksik tarih: '(.*)'/);
    if (m) return m[1]!;
  }
  return null;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function isoToTurkish(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

/** A cell like "06.03.2026 EFT" fails strict parsing (parseCellAsDateString
 *  requires the WHOLE cell to be a date) but very often DOES contain a real,
 *  calendar-valid date plus unrelated trailing/leading text. This extracts a
 *  best-effort suggestion for the repair panel to pre-fill — it only ever
 *  SUGGESTS; the actual fix still goes through the same unmodified
 *  parseCellAsDateString when the user confirms via "Düzelt ve Doğrula". */
function extractDateSuggestion(raw: string): { isoDate: string | null; extraText: string | null } {
  const trimmed = raw.trim();
  const strict = parseCellAsDateString(trimmed);
  if (strict) return { isoDate: strict, extraText: null };

  const dmy = trimmed.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  const ymd = !dmy ? trimmed.match(/(\d{4})[./-](\d{1,2})[./-](\d{1,2})/) : null;
  const match = dmy ?? ymd;
  if (!match) return { isoDate: null, extraText: null };

  // Re-derive as "YYYY-MM-DD" and hand it BACK to the real parser — this never
  // invents calendar validity itself (an impossible date like 31.02.2026 still
  // correctly yields no suggestion), it only reformats what regex found.
  const candidate = dmy
    ? `${match[3]}-${pad2(Number(match[2]))}-${pad2(Number(match[1]))}`
    : `${match[1]}-${pad2(Number(match[2]))}-${pad2(Number(match[3]))}`;
  const validated = parseCellAsDateString(candidate);
  if (!validated) return { isoDate: null, extraText: null };

  const extraText = trimmed.replace(match[0], "").trim();
  return { isoDate: validated, extraText: extraText || null };
}

interface DateRepairHint {
  raw: string;
  suggestedIsoDate: string | null;
  extraText: string | null;
}

function computeDateRepairHint(row: StagedRow): DateRepairHint | null {
  const raw = extractRawDateTextFromIssues(row.preview.issues);
  if (!raw) return null;
  const { isoDate, extraText } = extractDateSuggestion(raw);
  return { raw, suggestedIsoDate: isoDate, extraText };
}

/** Which fields the CURRENT issues actually complain about — used to visually
 *  flag only the genuinely broken field(s) instead of making every field look
 *  equally suspect, so "repair only the broken field" is true both
 *  functionally (everything else stays as resolved) and visually. */
function fieldNeedsAttention(fieldKey: string, issues: string[]): boolean {
  const joined = issues.join(" ");
  switch (fieldKey) {
    case "date":
      return /tarih/i.test(joined);
    case "studentName":
      return /'Öğrenci'.*boş|öğrenci.*sistemde bulunamadı/i.test(joined);
    case "teacherName":
      return /'Öğretmen'.*boş|öğretmen.*sistemde bulunamadı|Öğretmen bilgisi bulunamadı/i.test(joined);
    case "studentPrice":
    case "amount":
      return /ücreti veya tutar|birim fiyatı|Tutar.*boş/i.test(joined);
    case "educationType":
      return /Eğitim Türü/i.test(joined);
    case "method":
      return /ödeme yöntemi/i.test(joined);
    default:
      return false;
  }
}

/** A ledger sheet's metadata teacher cell can read "EKREM HOCA + FATMANA HOCA"
 *  (multiple teachers, honorific suffix) — display-only best guess at the one
 *  a single row most likely means, mirroring (never calling) the same
 *  first-candidate + honorific-strip heuristic extractStudentLedgerSheet
 *  already applies per-row. Purely cosmetic prefill; the user still confirms. */
function guessSingleTeacherName(raw: string | null | undefined): string {
  if (!raw) return "";
  const first = raw.split("+")[0]?.trim() ?? "";
  return first.replace(/\s+hoca\.?$/i, "").trim();
}

/** Best-effort prefill so the user only has to retype the ONE broken field —
 *  an error row never has a staged record to read from (that's the whole
 *  reason it's an error), so this pulls from whatever's still visible on the
 *  preview row itself (resolved entity names, a smart date suggestion when the
 *  raw cell text still contains a real date, education type if the sheet had
 *  SOME value even if it didn't resolve), falling back to the source sheet's
 *  own metadata (entry.sheetMeta) when a row short-circuited before its own
 *  entityMatches got built — e.g. an invalid-date error on a ledger sheet.
 *  Everything else starts blank/sane-default. */
function initialRepairValuesFor(row: StagedRow, fields: RepairFieldDef[], entry?: PreviewTaskEntry): Record<string, string> {
  const dateHint = computeDateRepairHint(row);
  const values: Record<string, string> = {};
  for (const f of fields) {
    if (f.kind === "studentSearch")
      values[f.key] = row.preview.entityMatches.find((m) => m.entityType === "Öğrenci")?.value ?? entry?.sheetMeta?.studentName ?? "";
    else if (f.kind === "teacherSearch")
      values[f.key] =
        row.preview.entityMatches.find((m) => m.entityType === "Öğretmen")?.value ?? guessSingleTeacherName(entry?.sheetMeta?.teacherName);
    else if (f.kind === "educationTypeSelect") values[f.key] = row.preview.entityMatches.find((m) => m.entityType === "Eğitim Türü")?.value ?? "";
    else if (f.kind === "date") values[f.key] = dateHint?.suggestedIsoDate ?? extractRowDate(row) ?? "";
    else if (f.kind === "time") values[f.key] = row.preview.repairHints?.time ?? "09:00";
    else if (f.kind === "number" && f.key === "studentPrice")
      values[f.key] = row.preview.repairHints?.fee != null ? String(row.preview.repairHints.fee) : "";
    else values[f.key] = "";
  }
  return values;
}

const repairInputClass = "mt-0.5 h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

/** The "fix it here" form a row's repair drawer shows for error rows. Purely
 *  client-side — `onApply` is the only bridge back to the wizard, and it
 *  receives plain field-key → string edits, never touching the uploaded file
 *  itself. Fields the row's issues don't actually complain about render as
 *  already-resolved (quiet, checkmarked); only the genuinely broken field(s)
 *  are visually flagged, so the user's eye goes straight to what needs a look. */
function RepairPanel({
  fields,
  initialValues,
  allowCreateTeacher,
  issues,
  dateHint,
  onApply,
}: {
  fields: RepairFieldDef[];
  initialValues: Record<string, string>;
  allowCreateTeacher: boolean;
  issues: string[];
  dateHint: DateRepairHint | null;
  onApply: (edits: Record<string, string>) => void;
}) {
  const store = useMockStore();
  const [draft, setDraft] = useState<Record<string, string>>(initialValues);
  const [createTeacher, setCreateTeacher] = useState(false);
  const [justApplied, setJustApplied] = useState(false);

  function set(key: string, value: string) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setJustApplied(false);
  }

  return (
    <div className="space-y-4" onClick={(e) => e.stopPropagation()}>
      <div className="space-y-3">
        {fields.map((f) => {
          const needsAttention = fieldNeedsAttention(f.key, issues);
          return (
            <div key={f.key}>
              <label className="flex items-center gap-1.5 text-[11px] font-medium">
                <span className={needsAttention ? "text-amber-700" : "text-muted-foreground"}>{f.label}</span>
                {needsAttention ? (
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide text-amber-700">
                    Kontrol edin
                  </span>
                ) : (
                  initialValues[f.key] && (
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  )
                )}
              </label>
            {f.kind === "date" && (
              <>
                <input type="date" value={draft[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} className={repairInputClass} />
                {dateHint && (
                  <div className="mt-1 space-y-0.5 rounded-md bg-amber-50 px-2 py-1.5 text-[10px] text-amber-800">
                    {dateHint.extraText && (
                      <p>
                        Excel hücresinde ekstra metin bulundu: <span className="font-semibold">{dateHint.extraText}</span>
                      </p>
                    )}
                    {dateHint.suggestedIsoDate ? (
                      <p>
                        Önerilen tarih: <span className="font-semibold">{isoToTurkish(dateHint.suggestedIsoDate)}</span> — sadece onaylamanız yeterli.
                      </p>
                    ) : (
                      <p>
                        Ham hücre değeri: <span className="font-semibold">{dateHint.raw}</span> — geçerli bir tarih bulunamadı, lütfen elle girin.
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
            {f.kind === "time" && (
              <input type="time" value={draft[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} className={repairInputClass} />
            )}
            {f.kind === "number" && (
              <input
                type="number"
                inputMode="decimal"
                value={draft[f.key] ?? ""}
                onChange={(e) => set(f.key, e.target.value)}
                className={repairInputClass}
              />
            )}
            {f.kind === "text" && (
              <input type="text" value={draft[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} className={repairInputClass} />
            )}
            {f.kind === "studentSearch" && (
              <>
                <input
                  type="text"
                  list="repair-students-datalist"
                  value={draft[f.key] ?? ""}
                  onChange={(e) => set(f.key, e.target.value)}
                  placeholder="Öğrenci ara…"
                  className={repairInputClass}
                />
                <datalist id="repair-students-datalist">
                  {store.students.map((s) => (
                    <option key={s.id} value={s.fullName} />
                  ))}
                </datalist>
              </>
            )}
            {f.kind === "teacherSearch" && (
              <>
                <input
                  type="text"
                  list="repair-teachers-datalist"
                  value={draft[f.key] ?? ""}
                  onChange={(e) => set(f.key, e.target.value)}
                  placeholder="Öğretmen ara…"
                  className={repairInputClass}
                />
                <datalist id="repair-teachers-datalist">
                  {store.teachers.map((t) => (
                    <option key={t.id} value={t.fullName} />
                  ))}
                </datalist>
                {allowCreateTeacher && (
                  <label className="mt-1 flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={createTeacher}
                      onChange={(e) => {
                        setCreateTeacher(e.target.checked);
                        setJustApplied(false);
                      }}
                      className="h-3 w-3 accent-primary"
                    />
                    <span className="text-[10px] text-muted-foreground">Bulunamazsa yeni öğretmen olarak oluştur</span>
                  </label>
                )}
              </>
            )}
            {f.kind === "educationTypeSelect" && (
              <select value={draft[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} className={repairInputClass}>
                <option value="">— Seçin —</option>
                {mockEducationTypes.map((et) => (
                  <option key={et.id} value={et.name}>
                    {et.name}
                  </option>
                ))}
              </select>
            )}
            {f.kind === "paymentMethodSelect" && (
              <select value={draft[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} className={repairInputClass}>
                <option value="">— Seçin —</option>
                {PAYMENT_METHOD_REPAIR_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-2.5 pt-1">
        <button
          type="button"
          onClick={() => {
            const edits = { ...draft };
            if (createTeacher) edits.createTeacher = "true";
            onApply(edits);
            setJustApplied(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Düzelt ve Doğrula
        </button>
        {justApplied && <span className="text-[11px] text-muted-foreground">Satır yeniden doğrulandı.</span>}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ImportPage() {
  const store = useMockStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<WizardStep>("upload");
  const [mode, setMode] = useState<ImportMode>("historical");
  // Every entity type the analyzer detects is included by default (per the
  // redesigned "intelligent" wizard) — this only ever holds types the user
  // explicitly opted OUT of after seeing what was detected. Never pre-asked
  // before analysis runs.
  const [disabledTypes, setDisabledTypes] = useState<Set<ImportEntityType>>(new Set());
  // Collapsed by default — the per-sheet override list is a power-user escape
  // hatch, not something a confident analysis run should force in front of you.
  const [showAllSheets, setShowAllSheets] = useState(false);

  const [files, setFiles] = useState<File[]>([]);
  const [uploadedSheets, setUploadedSheets] = useState<UploadedSheet[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [duplicateFileWarnings, setDuplicateFileWarnings] = useState<{ file: File; batch: ImportBatch }[]>([]);

  const [overrides, setOverrides] = useState<Record<string, ImportEntityType | "ignore">>({});
  const [matrixEducationTypeId, setMatrixEducationTypeId] = useState<Record<string, string>>({});
  const [ledgerEducationTypeId, setLedgerEducationTypeId] = useState<string>("");
  // Default "accrual" (Option A, current behavior) per spec — the user must
  // explicitly opt into a non-billable historical import, never the reverse.
  const [ledgerImportChoice, setLedgerImportChoice] = useState<LedgerImportChoice>("accrual");

  const [taskMappings, setTaskMappings] = useState<Record<string, ImportColumnMapping[]>>({});
  const [mappingTaskIndex, setMappingTaskIndex] = useState(0);

  const [previewResults, setPreviewResults] = useState<PreviewTaskEntry[]>([]);
  const [ledgerSkippedRowCount, setLedgerSkippedRowCount] = useState(0);
  const [confirmed, setConfirmed] = useState(false);

  // ── Preview: filters / row grouping (UX-only — never affects staging or commit) ──
  const [statusFilter, setStatusFilter] = useState<ImportRowStatus | "all">("all");
  const [sheetFilter, setSheetFilter] = useState<string>("all");
  // Inputs stay instantly responsive; the filter predicate reads the debounced
  // value below so a 2000+ row sheet doesn't re-expand/re-filter every keystroke.
  const [studentFilterInput, setStudentFilterInput] = useState("");
  const [teacherFilterInput, setTeacherFilterInput] = useState("");
  const [dateFilterInput, setDateFilterInput] = useState("");
  const studentFilter = useDebouncedValue(studentFilterInput, 200);
  const teacherFilter = useDebouncedValue(teacherFilterInput, 200);
  const dateFilter = useDebouncedValue(dateFilterInput, 200);
  const [sheetExpandOverrides, setSheetExpandOverrides] = useState<Record<string, boolean>>({});
  const [expandedIssueKeys, setExpandedIssueKeys] = useState<Set<string>>(new Set());
  // Which error row's repair drawer is open — rendered once at the page level
  // (mirrors rollbackTarget/rollbackDialog below) so the repair UI never has
  // to squeeze into a table cell.
  const [repairTarget, setRepairTarget] = useState<{ entry: PreviewTaskEntry; row: StagedRow } | null>(null);

  const [resultState, setResultState] = useState<{ result: ImportResult; batch: ImportBatch } | null>(null);

  const [rollbackTarget, setRollbackTarget] = useState<ImportBatch | null>(null);
  const [rollbackEdited, setRollbackEdited] = useState<EditedImportRecord[] | null>(null);

  function currentStoreSnapshot(): ImportStoreSnapshot {
    return {
      students: store.students,
      guardians: store.guardians,
      teachers: store.teachers,
      sessions: store.sessions,
      payments: store.payments,
      teacherPayments: store.teacherPayments,
      openingBalances: store.openingBalances,
      teacherCustomPrices: store.teacherCustomPrices,
    };
  }

  // ── Classification ────────────────────────────────────────────────────────

  const classifications = useMemo(() => classifyWorkbook(uploadedSheets.map((u) => u.sheet)), [uploadedSheets]);
  const classificationByKey = useMemo(() => {
    const map = new Map<string, (typeof classifications)[number]>();
    uploadedSheets.forEach((u, i) => map.set(u.key, classifications[i]!));
    return map;
  }, [uploadedSheets, classifications]);

  /** A classification the analyzer itself is confident about is ALWAYS resolved —
   *  the redesigned wizard never gates that on a pre-selection the user had to
   *  make before ever seeing the file. Only genuine ambiguity (low confidence /
   *  "unknown") — or an explicit user override — changes the outcome. */
  function effectiveTypeFor(key: string): EffectiveAssignment {
    const override = overrides[key];
    if (override) return override;
    const c = classificationByKey.get(key);
    if (!c) return "unresolved";
    if (c.resultType === "unknown" || c.confidence < CONFIDENCE_THRESHOLD) return "unresolved";
    return c.resultType;
  }

  const unresolvedSheets = uploadedSheets.filter((u) => effectiveTypeFor(u.key) === "unresolved");

  /** Recomputes which sheets feed which entity type for a GIVEN disabled-types
   *  set — called twice: once with the real `disabledTypes` (what actually gets
   *  imported) and once with an empty set (what the analyzer found in total,
   *  regardless of the user's current checkbox choices) so the Detected Data
   *  cards can keep showing "108 records" even while unchecked. */
  function computeTaskSets(disabled: Set<ImportEntityType>) {
    const classicTasks: ClassicTask[] = uploadedSheets
      .map((u) => ({ u, effective: effectiveTypeFor(u.key) }))
      .filter(
        (x): x is { u: UploadedSheet; effective: ImportEntityType } =>
          IMPORT_ENTITY_TYPES.includes(x.effective as ImportEntityType) && !disabled.has(x.effective as ImportEntityType)
      )
      .map((x) => ({ key: x.u.key, type: x.effective, sheet: x.u.sheet, sourceFileName: x.u.sourceFileName }));

    const matrixSheets = disabled.has("sessions") ? [] : uploadedSheets.filter((u) => effectiveTypeFor(u.key) === "scheduleMatrix");

    // Roster-named sheets (LİSTE/Öğrenci Listesi/Master Liste) and unfilled "BOŞ"
    // template copies also classify as "studentLedger" so they never fall through to
    // "unknown"/a classic-table guess — but neither is a real lesson sheet to extract
    // from (the roster is consumed separately as the roster source below; BOŞ sheets
    // are simply skipped). Never gated on disabled types here — a ledger workbook
    // produces students AND sessions together, so which of those actually get
    // staged is decided per-entity-type inside buildPreviewTaskEntries below.
    const ledgerSheets = uploadedSheets.filter(
      (u) => effectiveTypeFor(u.key) === "studentLedger" && !isRosterSheetName(u.sheet.name) && !isBlankTemplateSheetName(u.sheet.name)
    );

    return { classicTasks, matrixSheets, ledgerSheets };
  }

  // matrixSheets isn't read directly here — buildPreviewTaskEntries recomputes its
  // own copy per the disabled-set it's called with — but classicTasks (Mapping
  // step) and ledgerSheets (ledger config UI gate) are.
  const { classicTasks, ledgerSheets } = useMemo(
    () => computeTaskSets(disabledTypes),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [uploadedSheets, overrides, classificationByKey, disabledTypes]
  );

  const summary = useMemo(
    () => buildImportSummary(previewResults.flatMap((r) => r.rows), ledgerSkippedRowCount),
    [previewResults, ledgerSkippedRowCount]
  );
  const impact = useMemo(() => buildFinancialImpact(previewResults.flatMap((r) => r.rows)), [previewResults]);
  const creationBreakdown = useMemo(() => buildCreationBreakdown(previewResults.flatMap((r) => r.rows)), [previewResults]);
  const sheetFilterOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const e of previewResults) if (!seen.has(e.sheetKey)) seen.set(e.sheetKey, e.sheetLabel);
    return [...seen.entries()];
  }, [previewResults]);
  const groupedPreview = useMemo(() => {
    const map = new Map<ImportEntityType, PreviewTaskEntry[]>();
    for (const r of previewResults) {
      if (!map.has(r.type)) map.set(r.type, []);
      map.get(r.type)!.push(r);
    }
    return map;
  }, [previewResults]);

  // ── Preview: filter predicate + sheet expand/collapse defaults ──────────────

  const anyPreviewFilterActive =
    statusFilter !== "all" || sheetFilter !== "all" || !!studentFilter.trim() || !!teacherFilter.trim() || !!dateFilter.trim();

  function resetPreviewFilters() {
    setStatusFilter("all");
    setSheetFilter("all");
    setStudentFilterInput("");
    setTeacherFilterInput("");
    setDateFilterInput("");
  }

  /** Clicking an already-active status stat card clears the filter — clicking a
   *  different one switches to it. */
  function toggleStatusFilter(status: ImportRowStatus) {
    setStatusFilter((prev) => (prev === status ? "all" : status));
  }

  function rowMatchesFilters(row: StagedRow, sheetKey: string): boolean {
    if (statusFilter !== "all" && row.preview.status !== statusFilter) return false;
    if (sheetFilter !== "all" && sheetKey !== sheetFilter) return false;
    if (studentFilter.trim()) {
      const v = (extractEntityValue(row, "Öğrenci") ?? "").toLocaleLowerCase("tr-TR");
      if (!v.includes(studentFilter.trim().toLocaleLowerCase("tr-TR"))) return false;
    }
    if (teacherFilter.trim()) {
      const v = (extractEntityValue(row, "Öğretmen") ?? "").toLocaleLowerCase("tr-TR");
      if (!v.includes(teacherFilter.trim().toLocaleLowerCase("tr-TR"))) return false;
    }
    if (dateFilter.trim()) {
      const d = extractRowDate(row) ?? "";
      if (!d.includes(dateFilter.trim())) return false;
    }
    return true;
  }

  /** Small sheets, and sheets with errors worth surfacing immediately, start
   *  expanded; a 250-row all-valid sheet starts collapsed so the page stays
   *  scannable — the user can always expand it manually (or a filter forces it
   *  open automatically once it has a matching row). */
  /** Every group starts collapsed — a large historical migration can carry
   *  hundreds of student sheets, and rendering them all expanded up front makes
   *  the page unusable. The user opens exactly the ones they care about; an
   *  active filter still force-opens whichever groups actually match it. */
  function defaultSheetExpanded(): boolean {
    return false;
  }

  function isSheetExpanded(entry: PreviewTaskEntry): boolean {
    if (anyPreviewFilterActive) return entry.rows.some((r) => rowMatchesFilters(r, entry.sheetKey));
    return sheetExpandOverrides[entry.sheetKey] ?? defaultSheetExpanded();
  }

  function toggleSheetExpand(entry: PreviewTaskEntry) {
    setSheetExpandOverrides((prev) => ({ ...prev, [entry.sheetKey]: !isSheetExpanded(entry) }));
  }

  function toggleIssueExpand(key: string) {
    setExpandedIssueKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // ── Handlers: upload ─────────────────────────────────────────────────────

  /** Unchecking a Detected Data card — the ONLY way an entity type is ever
   *  excluded now; nothing is ever off by default. */
  function toggleDisabledType(type: ImportEntityType) {
    setDisabledTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  async function handleFilesSelected(selected: File[]) {
    const supported = selected.filter((f) => isSupportedImportFile(f.name));
    if (supported.length === 0) {
      setParseError("Desteklenmeyen dosya türü. Lütfen .xlsx, .xls veya .csv yükleyin.");
      return;
    }
    setIsParsing(true);
    setParseError(null);
    try {
      const parsedByFile = await Promise.all(supported.map(async (f) => ({ file: f, sheets: await parseSpreadsheetFile(f) })));
      const flattened: UploadedSheet[] = [];
      for (const { file: f, sheets } of parsedByFile) {
        for (const s of sheets) {
          if (s.rows.length === 0) continue;
          flattened.push({ sheet: s, sourceFileName: f.name, key: sheetKeyOf(f.name, s.name) });
        }
      }
      if (flattened.length === 0) {
        setParseError("Dosyalarda okunabilir veri satırı bulunamadı.");
        return;
      }
      setFiles((prev) => [...prev, ...supported]);
      setUploadedSheets((prev) => [...prev, ...flattened]);

      const fingerprints = await Promise.all(supported.map((f) => computeFileFingerprint(f)));
      const warnings = fingerprints
        .map((fp, i) => ({ file: supported[i]!, batch: findExistingBatchByFingerprint(fp, store.importBatches) }))
        .filter((w): w is { file: File; batch: ImportBatch } => !!w.batch);
      if (warnings.length > 0) setDuplicateFileWarnings((prev) => [...prev, ...warnings]);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Dosya okunamadı.");
    } finally {
      setIsParsing(false);
    }
  }

  function removeFile(fileName: string) {
    setFiles((prev) => prev.filter((f) => f.name !== fileName));
    setUploadedSheets((prev) => prev.filter((u) => u.sourceFileName !== fileName));
    setDuplicateFileWarnings((prev) => prev.filter((w) => w.file.name !== fileName));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFullReset() {
    setStep("upload");
    setDisabledTypes(new Set());
    setShowAllSheets(false);
    setFiles([]);
    setUploadedSheets([]);
    setOverrides({});
    setMatrixEducationTypeId({});
    setLedgerEducationTypeId("");
    setLedgerImportChoice("accrual");
    setTaskMappings({});
    setMappingTaskIndex(0);
    setPreviewResults([]);
    setLedgerSkippedRowCount(0);
    setConfirmed(false);
    setResultState(null);
    setParseError(null);
    setDuplicateFileWarnings([]);
    resetPreviewFilters();
    setSheetExpandOverrides({});
    setExpandedIssueKeys(new Set());
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ── Handlers: mapping ────────────────────────────────────────────────────

  function mappingForTask(task: ClassicTask): ImportColumnMapping[] {
    return taskMappings[task.key] ?? suggestColumnMappings(task.sheet, task.type);
  }

  function updateTaskMapping(task: ClassicTask, index: number, value: string) {
    setTaskMappings((prev) => {
      const current = prev[task.key] ?? suggestColumnMappings(task.sheet, task.type);
      const updated = current.map((m, i) => (i === index ? { ...m, systemField: value === "" ? null : value } : m));
      return { ...prev, [task.key]: updated };
    });
  }

  function unmappedRequiredForTask(task: ClassicTask): ImportSystemField[] {
    const mapping = mappingForTask(task);
    const mappedKeys = mapping.map((m) => m.systemField).filter((f): f is string => f !== null);
    return getSystemFieldsForImportType(task.type).filter((f) => f.required && !mappedKeys.includes(f.key));
  }

  const anyUnmappedRequired = classicTasks.some((t) => unmappedRequiredForTask(t).length > 0);
  const activeTask: ClassicTask | undefined = classicTasks[mappingTaskIndex];

  // ── Handlers: interactive error repair ───────────────────────────────────
  // Two repair paths, chosen by where the row came from — both re-run the SAME
  // unmodified staging/validation code the initial analysis used; neither ever
  // touches the uploaded File or its ParsedSheet.

  /** A row from a classic (column-mapped) table sheet: patch the ONE edited
   *  cell into a cloned copy of that sheet's raw rows, then re-run
   *  buildStagedRows() for the whole sheet unchanged — the row at the same
   *  index comes back freshly (re-)validated by the real rules. A field with no
   *  existing column (e.g. the sheet never had a "Saat" column at all) gets one
   *  synthetic column appended so the sheet stays rectangular. */
  function repairClassicRow(entry: PreviewTaskEntry, row: StagedRow, edits: Record<string, string>): StagedRow | null {
    const task = classicTasks.find((t) => t.key === entry.sheetKey);
    if (!task) return null;
    let mapping = mappingForTask(task);
    const rowIndex = row.preview.rowNumber - 2;
    if (rowIndex < 0 || rowIndex >= task.sheet.rows.length) return null;

    for (const fieldKey of Object.keys(edits)) {
      if (!mapping.some((m) => m.systemField === fieldKey)) {
        mapping = [...mapping, { excelColumn: fieldKey, systemField: fieldKey, sampleData: "" }];
      }
    }
    const addedCols = mapping.length - task.sheet.headers.length;
    const patchedHeaders = addedCols > 0 ? [...task.sheet.headers, ...mapping.slice(task.sheet.headers.length).map((m) => m.excelColumn)] : task.sheet.headers;
    const patchedRows = task.sheet.rows.map((r, i) => {
      const extended = addedCols > 0 ? [...r, ...(Array(addedCols).fill("") as string[])] : [...r];
      if (i === rowIndex) {
        for (const [fieldKey, value] of Object.entries(edits)) {
          const colIndex = mapping.findIndex((m) => m.systemField === fieldKey);
          if (colIndex >= 0) extended[colIndex] = value;
        }
      }
      return extended;
    });
    const patchedSheet: ParsedSheet = { ...task.sheet, headers: patchedHeaders, rows: patchedRows };

    const freshRows = buildStagedRows(task.type, mode, patchedSheet, mapping, currentStoreSnapshot(), mockEducationTypes);
    return freshRows[rowIndex] ?? null;
  }

  /** A "sessions" row from a student-ledger or timetable-matrix sheet — neither
   *  format carries an ImportColumnMapping to patch a cell into, so the edited
   *  values are fed straight into the SAME resolver/duplicate/conflict helpers
   *  extractStudentLedgerSheet / convertMatrixSheetToSessionCandidates already
   *  use, reconstructing one Session the same way those functions would. */
  function repairSessionRowDirect(entry: PreviewTaskEntry, row: StagedRow, edits: Record<string, string>): StagedRow {
    const studentIndex = buildStudentIndex(store.students);
    const teacherIndex = buildTeacherIndex(store.teachers);
    const sessionDuplicateIndex = buildSessionDuplicateIndex(store.sessions);
    const sessionConflictIndex = buildSessionConflictIndex(store.sessions);

    // Seed both indexes with every OTHER already-staged session across this
    // SAME import run too, so a repaired row can still be caught as a
    // duplicate/conflict against a sibling row resolved earlier in this batch —
    // matching what the original whole-sheet staging pass would have seen.
    for (const otherEntry of previewResults) {
      for (const otherRow of otherEntry.rows) {
        if (otherRow === row) continue;
        if (otherRow.preview.status === "error" || otherRow.preview.status === "duplicate") continue;
        for (const staged of otherRow.staged) {
          if (staged.kind === "sessions") {
            addSessionToDuplicateIndex(sessionDuplicateIndex, staged.record);
            addSessionToConflictIndex(sessionConflictIndex, staged.record);
          }
        }
      }
    }

    const existingStudentName = row.preview.entityMatches.find((m) => m.entityType === "Öğrenci")?.value ?? entry.sheetMeta?.studentName ?? "";
    const existingTeacherName =
      row.preview.entityMatches.find((m) => m.entityType === "Öğretmen")?.value ?? guessSingleTeacherName(entry.sheetMeta?.teacherName);
    const studentNameRaw = (edits.studentName ?? existingStudentName).trim();
    const teacherNameRaw = (edits.teacherName ?? existingTeacherName).trim();
    const dateRaw = (edits.date ?? computeDateRepairHint(row)?.suggestedIsoDate ?? extractRowDate(row) ?? "").trim();
    const timeRaw = edits.time ?? "09:00";
    const feeRaw = edits.studentPrice ?? "";
    const rowNumber = row.preview.rowNumber;

    const errors: string[] = [];
    const dateStr = parseCellAsDateString(dateRaw);
    if (!dateStr) errors.push(`Geçersiz veya eksik tarih: '${dateRaw}'`);
    const timeStr = parseCellAsTimeString(timeRaw) ?? "09:00";

    if (!studentNameRaw) errors.push("'Öğrenci' zorunlu alan boş bırakılamaz");
    const studentRes = studentNameRaw ? resolveStudentByName(studentNameRaw, studentIndex) : null;
    if (studentNameRaw && !studentRes?.student) errors.push(`'${studentNameRaw}' adlı öğrenci sistemde bulunamadı`);

    if (!teacherNameRaw) errors.push("'Öğretmen' zorunlu alan boş bırakılamaz");
    const teacherRes = teacherNameRaw ? resolveTeacherByName(teacherNameRaw, teacherIndex) : null;
    let createdTeacher: Teacher | null = null;
    if (teacherNameRaw && !teacherRes?.teacher) {
      if (edits.createTeacher === "true") {
        createdTeacher = {
          id: newId("teacher", rowNumber),
          tenantId: "tenant-1",
          fullName: teacherNameRaw,
          phone: "—",
          status: "active",
          specializations: [],
          createdAt: new Date().toISOString(),
        };
      } else {
        errors.push(`'${teacherNameRaw}' adlı öğretmen sistemde bulunamadı`);
      }
    }

    const priceRaw = feeRaw.trim() ? parseCellAsNumber(feeRaw) : null;
    if (priceRaw === null || priceRaw <= 0) errors.push("'Öğrenci Birim Fiyatı' zorunlu alan boş veya geçersiz");

    const matches: ImportEntityMatch[] = [
      ...(studentNameRaw ? [{ entityType: "Öğrenci" as const, value: studentNameRaw, matched: !!studentRes?.student }] : []),
      ...(teacherNameRaw ? [{ entityType: "Öğretmen" as const, value: teacherNameRaw, matched: !!teacherRes?.teacher || !!createdTeacher }] : []),
    ];
    const displayText = `${studentNameRaw || "?"} / ${teacherNameRaw || "?"} / ${dateStr ?? dateRaw}`;

    if (errors.length > 0) {
      return { preview: { rowNumber, displayText, status: "error", issues: errors, entityMatches: matches, include: false }, staged: [] };
    }

    const studentId = studentRes!.student!.id;
    const teacherId = createdTeacher?.id ?? teacherRes!.teacher!.id;
    const isFromLedger = ledgerSheets.some((u) => u.key === entry.sheetKey);
    const educationTypeId = isFromLedger
      ? ledgerEducationTypeId || mockEducationTypes[0]?.id || ""
      : matrixEducationTypeId[entry.sheetKey] || mockEducationTypes[0]?.id || "";
    const startsAt = `${dateStr}T${timeStr}:00`;

    const duplicate = findDuplicateSession(studentId, teacherId, educationTypeId, startsAt, sessionDuplicateIndex);
    if (duplicate) {
      return { preview: { rowNumber, displayText, status: "duplicate", issues: ["Bu seans zaten mevcut"], entityMatches: matches, include: false }, staged: [] };
    }

    const conflict = checkSessionConflictIndexed(sessionConflictIndex, {
      studentId,
      teacherId,
      startsAt,
      durationMinutes: DEFAULT_CONFLICT_DURATION_MINUTES,
    });
    const issues: string[] = [];
    if (conflict.hasConflict) issues.push(conflict.message ?? "Bu öğrenci veya öğretmen aynı saatte başka bir seansa kayıtlı");
    if (createdTeacher) issues.push(`'${teacherNameRaw}' adlı öğretmen sistemde bulunamadığı için otomatik oluşturulacak`);

    const teacherForEarning = createdTeacher ?? teacherRes!.teacher!;
    const calculatedEarning = calculateTeacherSessionEarning(teacherForEarning, educationTypeId, priceRaw!, store.teacherCustomPrices ?? []);
    const teacherEarningUnknown = calculatedEarning === null;
    if (teacherEarningUnknown) {
      issues.push("Öğretmen hakedişi hesaplanamadı; öğretmen ücret ayarları tamamlandıktan sonra sistem tarafından hesaplanacaktır");
    }

    const session: Session = {
      id: newId("session", rowNumber),
      tenantId: "tenant-1",
      studentId,
      teacherId,
      educationTypeId,
      date: startsAt,
      durationMinutes: DEFAULT_CONFLICT_DURATION_MINUTES,
      sessionCount: 1,
      studentPrice: priceRaw!,
      teacherEarning: calculatedEarning ?? 0,
      status: mode === "historical" ? "completed" : "planned",
      notes: `Kaynak: '${entry.sheetLabel}' — elle düzeltildi`,
      createdAt: new Date().toISOString(),
      billingMode: isFromLedger ? ledgerChoiceToBillingMode(ledgerImportChoice) : undefined,
      teacherEarningStatus: teacherEarningUnknown ? "unknown" : "calculated",
    };

    const staged: StagedRecord[] = createdTeacher ? [{ kind: "teachers", record: createdTeacher }] : [];
    staged.push({ kind: "sessions", record: session });
    const includeByDefault = conflict.hasConflict ? mode === "historical" : true;

    return {
      preview: { rowNumber, displayText, status: issues.length > 0 ? "warning" : "valid", issues, entityMatches: matches, include: includeByDefault, teacherEarningUnknown },
      staged,
    };
  }

  /** Runs the right repair path for a row, then swaps ONLY that one row into
   *  previewResults — every other row in the sheet, and the user's manual
   *  include/exclude toggles on them, are left exactly as they were. Summary /
   *  Financial Impact / creation counts all update for free since they're
   *  useMemo'd straight off previewResults. */
  function applyRowRepair(entry: PreviewTaskEntry, row: StagedRow, edits: Record<string, string>) {
    const isClassicSource = classicTasks.some((t) => t.key === entry.sheetKey);
    const repaired = isClassicSource ? repairClassicRow(entry, row, edits) : entry.type === "sessions" ? repairSessionRowDirect(entry, row, edits) : null;
    if (!repaired) return;

    setPreviewResults((prev) =>
      prev.map((e) =>
        e.sheetKey !== entry.sheetKey
          ? e
          : { ...e, rows: e.rows.map((r) => (r.preview.rowNumber === row.preview.rowNumber ? repaired : r)) }
      )
    );
  }

  // ── Handlers: preview build ──────────────────────────────────────────────

  /** Pure(ish) staging pass — takes an explicit disabled-types set rather than
   *  reading the real `disabledTypes` state so it can ALSO be run with an empty
   *  set to compute "how many records exist in total" for the Detected Data
   *  cards, independent of what the user currently has checked. Reused by both
   *  the live Analysis-step preview and the real buildAndGoToPreview handler —
   *  same staging calls either way, never duplicated logic. */
  function buildPreviewTaskEntries(disabled: Set<ImportEntityType>): { entries: PreviewTaskEntry[]; skippedRowCount: number } {
    const { classicTasks: ct, matrixSheets: ms, ledgerSheets: ls } = computeTaskSets(disabled);

    const classicInputs = ct.map((t) => ({ type: t.type, sheet: t.sheet, mapping: mappingForTask(t) }));
    const classicResults = buildMultiImportPreview(classicInputs, mode, currentStoreSnapshot(), mockEducationTypes);

    // Threaded forward into matrix/ledger processing so a student or teacher created
    // by an earlier classic task in this SAME run is immediately resolvable there too
    // — the same cross-task reference resolution buildMultiImportPreview already
    // gives classic tasks among themselves.
    let workingSessions = [...store.sessions, ...classicResults.filter((r) => r.type === "sessions").flatMap((r) => sessionsFromRows(r.rows))];
    const workingStudents = [...store.students, ...classicResults.filter((r) => r.type === "students").flatMap((r) => studentsFromRows(r.rows))];
    const workingTeachers = [...store.teachers, ...classicResults.filter((r) => r.type === "teachers").flatMap((r) => teachersFromRows(r.rows))];

    const matrixEntries: PreviewTaskEntry[] = ms.map((u) => {
      const eduId = matrixEducationTypeId[u.key] || mockEducationTypes[0]?.id || "";
      const rows = convertMatrixSheetToSessionCandidates(u.sheet, workingTeachers, workingStudents, eduId, workingSessions, mode, store.teacherCustomPrices);
      workingSessions = [...workingSessions, ...sessionsFromRows(rows)];
      return { type: "sessions", sheetKey: u.key, sheetLabel: `${u.sheet.name} (Zaman Çizelgesi Matrisi)`, rows };
    });

    let skippedRowCount = 0;
    let ledgerEntries: PreviewTaskEntry[] = [];
    if (ls.length > 0) {
      const eduIdForLedger = ledgerEducationTypeId || mockEducationTypes[0]?.id || "";
      // The "LİSTE" reference sheet participates automatically whenever it's present
      // in the upload, regardless of how (or whether) it was itself classified — the
      // user never has to separately "assign" it to anything.
      const listeSheet = uploadedSheets.find((u) => isRosterSheetName(u.sheet.name))?.sheet ?? null;
      const ledgerImport = buildStudentLedgerImport(
        ls.map((u) => u.sheet),
        listeSheet,
        workingStudents,
        workingTeachers,
        eduIdForLedger,
        workingSessions,
        mode,
        !disabled.has("teachers"),
        store.teacherCustomPrices,
        ledgerChoiceToBillingMode(ledgerImportChoice)
      );
      skippedRowCount = ledgerImport.sheetResults.reduce((sum, r) => sum + r.skippedRowCount, 0);

      if (!disabled.has("students") && ledgerImport.studentCreationRows.length > 0) {
        ledgerEntries.push({
          type: "students",
          sheetKey: "student-ledger::created-students",
          sheetLabel: `${STUDENT_LEDGER_RESULT_LABEL} — Öğrenciler`,
          rows: ledgerImport.studentCreationRows,
        });
      }
      if (!disabled.has("sessions")) {
        ledgerEntries = ledgerEntries.concat(
          ledgerImport.sheetResults.map((result, i) => ({
            type: "sessions" as const,
            sheetKey: ls[i]!.key,
            sheetLabel: `${result.sheetName} (${STUDENT_LEDGER_RESULT_LABEL})`,
            rows: result.rows,
            sheetMeta: { studentName: result.studentName, teacherName: result.teacherName },
          }))
        );
      }
    }

    const classicEntries: PreviewTaskEntry[] = classicResults.map((r) => {
      const task = ct.find((t) => t.sheet === r.sheet);
      return { type: r.type, sheetKey: task?.key ?? r.sheet.name, sheetLabel: r.sheet.name, rows: r.rows };
    });

    return { entries: [...classicEntries, ...matrixEntries, ...ledgerEntries], skippedRowCount };
  }

  function buildAndGoToPreview() {
    const { entries, skippedRowCount } = buildPreviewTaskEntries(disabledTypes);
    setPreviewResults(entries);
    setLedgerSkippedRowCount(skippedRowCount);
    setConfirmed(false);
    resetPreviewFilters();
    setSheetExpandOverrides({});
    setExpandedIssueKeys(new Set());
    setStep("preview");
  }

  // ── Analysis step: "what did the analyzer find, in total" ───────────────────
  // Always computed as if EVERY type were enabled, regardless of the user's
  // current checkboxes, so a Detected Data card keeps showing "108 records"
  // even after being unchecked — unchecking means "won't import", not "vanish".
  const detectionPreview = useMemo(() => {
    if (uploadedSheets.length === 0) return { entries: [] as PreviewTaskEntry[], skippedRowCount: 0 };
    return buildPreviewTaskEntries(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadedSheets, overrides, classificationByKey, mode, ledgerEducationTypeId, ledgerImportChoice, matrixEducationTypeId, taskMappings]);

  const detectedTypes = useMemo(() => new Set(detectionPreview.entries.map((e) => e.type)), [detectionPreview]);

  const detectedCounts = useMemo(
    () => buildCreationBreakdown(detectionPreview.entries.flatMap((e) => e.rows)),
    [detectionPreview]
  );

  const hasAnythingToImport = IMPORT_ENTITY_TYPES.some((t) => detectedTypes.has(t) && !disabledTypes.has(t));
  const canProceedFromAnalysis = uploadedSheets.length > 0 && unresolvedSheets.length === 0 && hasAnythingToImport;

  async function computeCombinedFingerprint(fileList: File[]): Promise<string> {
    if (fileList.length === 0) return "";
    const individual = await Promise.all(fileList.map((f) => computeFileFingerprint(f)));
    const joined = [...individual].sort().join("|");
    const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(joined));
    return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function handleConfirmImport() {
    const fileFingerprint = await computeCombinedFingerprint(files);
    const { result, batch } = commitMultiImportBatch(
      previewResults.map((r) => ({ type: r.type, rows: r.rows })),
      store,
      { fileName: files.map((f) => f.name).join(", ") || "—", importMode: mode, fileFingerprint }
    );
    setResultState({ result, batch });
  }

  // ── Handlers: rollback ───────────────────────────────────────────────────

  function openRollbackDialog(batch: ImportBatch) {
    setRollbackTarget(batch);
    setRollbackEdited(findEditedRecordsSinceImport(batch, currentStoreSnapshot()));
  }

  function closeRollbackDialog() {
    setRollbackTarget(null);
    setRollbackEdited(null);
  }

  function confirmRollback() {
    if (!rollbackTarget) return;
    rollbackImportBatch(rollbackTarget, currentStoreSnapshot(), store);
    closeRollbackDialog();
  }

  // ── Preview table columns ────────────────────────────────────────────────

  const previewColumns: Column<PreviewDisplayRow>[] = [
    {
      key: "row",
      header: "#",
      render: (r) => <span className="tabular-nums text-xs text-muted-foreground">{r.row.preview.rowNumber}</span>,
      className: "w-12",
      headerClassName: "w-12",
    },
    {
      key: "data",
      header: "Veri Özeti",
      render: (r) => (
        <div>
          <span
            className={cn(
              "text-sm font-medium",
              r.row.preview.status === "error"
                ? "text-destructive"
                : r.row.preview.status === "warning"
                ? "text-amber-700"
                : r.row.preview.status === "duplicate"
                ? "text-muted-foreground"
                : "text-foreground"
            )}
          >
            {r.row.preview.displayText}
          </span>
          <p className="text-[10px] text-muted-foreground mt-0.5">{r.sheetLabel}</p>
          {r.row.preview.entityMatches.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {r.row.preview.entityMatches.map((match, i) => (
                <span
                  key={i}
                  className={cn(
                    "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium",
                    match.matched ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                  )}
                >
                  {match.matched ? "✓" : "+"} {match.entityType}: {match.value}
                </span>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "Durum",
      render: (r) => <ImportRowBadge status={r.row.preview.status} />,
      className: "w-32",
      headerClassName: "w-32",
    },
    {
      key: "issues",
      header: "Açıklama",
      render: (r) => {
        const key = previewRowKey(r);
        const entry = previewResults.find((e) => e.sheetKey === r.sourceKey);
        const isClassicSource = entry ? classicTasks.some((t) => t.key === entry.sheetKey) : false;
        const canRepair = r.row.preview.status === "error" && !!entry && (isClassicSource || entry.type === "sessions");
        const fields = entry && canRepair ? getRepairFieldsForEntry(entry.type, isClassicSource) : [];
        if (canRepair && entry && fields.length > 0) {
          return (
            <IssueBadges
              issues={r.row.preview.issues}
              expanded={false}
              detailLabel="Detay / Düzelt >"
              onToggle={() => setRepairTarget({ entry, row: r.row })}
            />
          );
        }
        const isExpanded = expandedIssueKeys.has(key);
        return <IssueBadges issues={r.row.preview.issues} expanded={isExpanded} onToggle={() => toggleIssueExpand(key)} />;
      },
      className: "hidden md:table-cell",
      headerClassName: "hidden md:table-cell",
    },
    {
      key: "include",
      header: "Dahil Et",
      render: (r) => {
        if (r.row.preview.status === "error" || r.row.preview.status === "duplicate") {
          return <span className="text-muted-foreground/30 text-xs">—</span>;
        }
        return (
          <input
            type="checkbox"
            checked={r.row.preview.include}
            onChange={() =>
              setPreviewResults((prev) =>
                prev.map((entry) =>
                  entry.sheetKey !== r.sourceKey
                    ? entry
                    : {
                        ...entry,
                        rows: entry.rows.map((row) =>
                          row.preview.rowNumber === r.row.preview.rowNumber
                            ? { ...row, preview: { ...row.preview, include: !row.preview.include } }
                            : row
                        ),
                      }
                )
              )
            }
            className="h-4 w-4 rounded accent-primary"
          />
        );
      },
      className: "w-20 text-center",
      headerClassName: "w-20 text-center",
    },
  ];

  // ── Import history ───────────────────────────────────────────────────────

  const historyColumns: Column<ImportBatch>[] = [
    { key: "file", header: "Dosya", render: (b) => <span className="text-sm font-medium text-foreground">{b.fileName}</span> },
    { key: "date", header: "Tarih", render: (b) => <span className="text-xs text-muted-foreground">{formatDateTime(b.importedAt)}</span> },
    { key: "types", header: "Türler", render: (b) => <span className="text-xs text-muted-foreground">{b.entityTypes.map(getImportTypeLabel).join(", ")}</span> },
    { key: "rows", header: "Satır", render: (b) => <span className="text-xs tabular-nums">{b.rowCount}</span> },
    {
      key: "status",
      header: "Durum",
      render: (b) =>
        b.rolledBackAt ? (
          <span className="text-xs text-muted-foreground">Geri Alındı</span>
        ) : (
          <span className="text-xs font-medium text-emerald-600">Aktif</span>
        ),
    },
    {
      key: "action",
      header: "",
      render: (b) =>
        !b.rolledBackAt ? (
          <button className="text-xs font-medium text-destructive underline underline-offset-2" onClick={() => openRollbackDialog(b)}>
            İçe Aktarmayı Geri Al
          </button>
        ) : (
          <span className="text-muted-foreground/30 text-xs">—</span>
        ),
      className: "w-40",
      headerClassName: "w-40",
    },
  ];

  const importHistorySection = (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="border-b border-border/60 px-5 py-4">
        <p className="text-sm font-semibold text-foreground">İçe Aktarım Geçmişi</p>
        <p className="text-xs text-muted-foreground mt-0.5">Önceki içe aktarımları görüntüleyin veya geri alın</p>
      </div>
      <DataTable
        data={[...store.importBatches].reverse()}
        columns={historyColumns}
        keyExtractor={(b) => b.id}
        emptyTitle="Henüz içe aktarım yapılmadı"
      />
    </div>
  );

  const rollbackDialog = (
    <Dialog open={!!rollbackTarget} onOpenChange={(open) => !open && closeRollbackDialog()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>İçe Aktarmayı Geri Al</DialogTitle>
          <DialogDescription>
            {rollbackTarget && (
              <>
                &apos;{rollbackTarget.fileName}&apos; — {formatDateTime(rollbackTarget.importedAt)} tarihli içe aktarım tarafından oluşturulan
                kayıtlar silinecek. Bu işlem geri alınamaz.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        {rollbackEdited && rollbackEdited.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 space-y-1.5">
            <p className="text-xs font-semibold text-amber-800">Bu kayıt içe aktarımdan sonra değiştirildi</p>
            <ul className="text-xs text-amber-700 space-y-0.5 list-disc pl-4">
              {rollbackEdited.map((e) => (
                <li key={`${e.entityType}-${e.id}`}>
                  {getImportTypeLabel(e.entityType)}: {e.label}
                </li>
              ))}
            </ul>
            <p className="text-xs text-amber-700">Bu kayıtlar sonradan değiştirildiği için geri alma sırasında silinmeyecek.</p>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={closeRollbackDialog}>
            Vazgeç
          </Button>
          <Button variant="destructive" onClick={confirmRollback}>
            Geri Al
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const repairDrawer = (
    <Sheet open={!!repairTarget} onOpenChange={(open) => !open && setRepairTarget(null)}>
      <SheetContent side="right" showCloseButton className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        {repairTarget &&
          (() => {
            const { entry, row } = repairTarget;
            const isClassicSource = classicTasks.some((t) => t.key === entry.sheetKey);
            const fields = getRepairFieldsForEntry(entry.type, isClassicSource);
            const dateHint = computeDateRepairHint(row);
            return (
              <>
                <SheetHeader className="px-5 pt-5 pb-4">
                  <SheetTitle className="text-base font-semibold">Satırı Düzelt</SheetTitle>
                  <SheetDescription className="text-xs">
                    {row.preview.displayText} · {entry.sheetLabel} · Satır {row.preview.rowNumber}
                  </SheetDescription>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto border-t border-border px-5 py-4">
                  <RepairPanel
                    key={`${entry.sheetKey}::${row.preview.rowNumber}`}
                    fields={fields}
                    initialValues={initialRepairValuesFor(row, fields, entry)}
                    allowCreateTeacher={!isClassicSource}
                    issues={row.preview.issues}
                    dateHint={dateHint}
                    onApply={(edits) => {
                      applyRowRepair(entry, row, edits);
                      setRepairTarget(null);
                    }}
                  />
                </div>
              </>
            );
          })()}
      </SheetContent>
    </Sheet>
  );

  // ── Step indicator ─────────────────────────────────────────────────────────

  const stepIndex = WIZARD_STEPS.findIndex((s) => s.key === step);
  const stepIndicator = (
    <div className="flex items-center gap-0">
      {WIZARD_STEPS.map((s, i) => {
        const isCompleted = stepIndex > i;
        const isActive = stepIndex === i;
        return (
          <Fragment key={s.key}>
            {i > 0 && <div className={cn("flex-1 h-px min-w-8", stepIndex >= i ? "bg-primary" : "bg-border")} />}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                  isCompleted || isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}
              >
                {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </div>
              <span className={cn("text-xs font-medium whitespace-nowrap", isActive ? "text-primary" : isCompleted ? "text-primary/70" : "text-muted-foreground")}>
                {s.label}
              </span>
            </div>
          </Fragment>
        );
      })}
    </div>
  );

  // ── Result screen ───────────────────────────────────────────────────────────

  if (resultState) {
    const { result, batch } = resultState;
    const allEntries: PreviewDisplayRow[] = previewResults
      .flatMap((entry) => entry.rows.map((row) => ({ sourceKey: entry.sheetKey, sheetLabel: entry.sheetLabel, type: entry.type, row })))
      .map((r, idx) => ({ ...r, idx }));
    const errorRowsList = allEntries.filter((e) => e.row.preview.status === "error");
    const duplicateRowsList = allEntries.filter((e) => e.row.preview.status === "duplicate");
    const warningRowsList = allEntries.filter((e) => e.row.preview.status === "warning");

    // Ground truth for "what got created" — read directly from the committed
    // batch's own id lists, the exact same source rollback uses, rather than
    // re-deriving it from the (pre-commit) preview rows.
    const createdBreakdown = IMPORT_ENTITY_TYPES.filter((t) => batch.entityTypes.includes(t)).map((t) => ({
      type: t,
      count: batch.createdEntityIds[t].length,
    }));

    // See item 11: a historical batch that books sessions but records neither
    // payments nor opening balances is mathematically correct (nothing has been
    // collected yet) but reads as "every student owes everything" until the rest
    // of the migration is done — flag it here rather than let the reports look
    // silently wrong.
    const sessionsCreated = batch.createdEntityIds.sessions.length;
    const paymentsCreated = batch.createdEntityIds.payments.length;
    const openingBalancesCreated = batch.createdEntityIds.openingBalances.length;
    const showDebtGuidance = batch.importMode === "historical" && sessionsCreated > 0 && paymentsCreated === 0 && openingBalancesCreated === 0;

    return (
      <div className="space-y-6">
        <PageHeader title="Excel Aktarımı" description="Mevcut Excel verilerinizi sisteme aktarın" />
        <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="h-7 w-7 text-emerald-600" />
          </div>
          <h2 className="mb-1 text-xl font-bold text-emerald-900">Aktarım Tamamlandı</h2>
          <p className="text-emerald-700 text-sm mb-4">{batch.entityTypes.map(getImportTypeLabel).join(", ")}</p>
          <div className="mx-auto grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              title="Oluşturulan Kayıt"
              value={result.imported}
              description="Tüm türler toplamı"
              icon={CheckCircle2}
              variant="success"
            />
            <StatCard title="Zaten Mevcut" value={result.skippedDuplicates} description="Atlandı" icon={CircleSlash} variant="default" />
            <StatCard title="Uyarılı" value={result.warnings} description="Yine de aktarıldı" icon={AlertTriangle} variant={result.warnings > 0 ? "warning" : "success"} />
            <StatCard title="Hatalı (Atlandı)" value={result.skippedErrors} description="Aktarılmadı" icon={XCircle} variant={result.skippedErrors > 0 ? "danger" : "success"} />
          </div>

          {createdBreakdown.length > 0 && (
            <div className="mx-auto mt-4 max-w-2xl rounded-lg border border-emerald-200 bg-white/60 px-4 py-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-800">Türe Göre Oluşturulan Kayıtlar</p>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5">
                {createdBreakdown.map((b) => (
                  <span key={b.type} className="text-sm text-emerald-900">
                    <span className="font-semibold tabular-nums">{b.count}</span> {getImportTypeLabel(b.type)}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 flex items-center justify-center gap-2.5">
            <button className={btnOutline} onClick={handleFullReset}>
              <RotateCcw className="h-4 w-4" />
              Yeni Aktarım Başlat
            </button>
            <button className={cn(btnOutline, "text-destructive border-destructive/30 hover:bg-destructive/5")} onClick={() => openRollbackDialog(batch)}>
              İçe Aktarmayı Geri Al
            </button>
          </div>
        </div>

        {showDebtGuidance && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
            <Info className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-amber-900">Borç raporları şu anda tüm öğrencileri borçlu gösterecek</p>
              <p className="text-xs text-amber-800">
                Bu aktarım {sessionsCreated} geçmiş seans oluşturdu ancak herhangi bir ödeme veya devir bakiyesi kaydı içermiyor. Bu, hesaplama
                hatası değildir — sistem yalnızca gördüğü verileri toplar, ve şu an için sadece tahakkuk (seans) verisi var. Öğrenci Borç
                Raporu ve Cari Hesap ekranları, siz <span className="font-medium">Ödemeler</span> veya <span className="font-medium">Devir
                Bakiyeleri</span>&apos;ni de aktarana kadar gerçek durumu yansıtmayacaktır. Aynı Excel dosyasında ödeme geçmişi varsa, onu ayrı
                bir &quot;Ödemeler&quot; içe aktarımı olarak da yükleyin; yalnızca güncel bakiyeyi biliyorsanız &quot;Devir Bakiyesi&quot; olarak
                tek satır girmeniz yeterlidir.
              </p>
            </div>
          </div>
        )}

        {(errorRowsList.length > 0 || duplicateRowsList.length > 0 || warningRowsList.length > 0) && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="border-b border-border/60 px-5 py-4">
              <p className="text-sm font-semibold text-foreground">Aktarım Raporu</p>
              <p className="text-xs text-muted-foreground mt-0.5">Atlanan ve uyarılı satırların dökümü</p>
            </div>
            <DataTable
              data={[...errorRowsList, ...duplicateRowsList, ...warningRowsList]}
              columns={previewColumns.filter((c) => c.key !== "include")}
              keyExtractor={previewRowKey}
              emptyTitle="Kayıt yok"
            />
          </div>
        )}

        {importHistorySection}
        {rollbackDialog}
        {repairDrawer}
      </div>
    );
  }

  // ── Step: upload ─────────────────────────────────────────────────────────

  const uploadStep = (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="mb-3 text-sm font-semibold text-foreground">Aktarım Modu</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {MODE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setMode(opt.value)}
              className={cn(
                "flex flex-col items-start gap-1 rounded-lg border p-3.5 text-left transition-colors",
                mode === opt.value ? "border-primary bg-primary/5" : "border-border bg-background hover:border-primary/40 hover:bg-muted/30"
              )}
            >
              <span className="text-sm font-medium text-foreground">{opt.label}</span>
              <span className="text-xs text-muted-foreground">{opt.description}</span>
            </button>
          ))}
        </div>

        {mode === "historical" && (
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-xs font-semibold text-amber-900">Doğru sıra, doğru raporlar demektir</p>
              <p className="text-xs text-amber-800">
                Geçmiş verinizi doğru raporlar üretecek şekilde aktarmak için önerilen sıra: <span className="font-medium">1) Veliler/Öğrenciler/Öğretmenler</span> →{" "}
                <span className="font-medium">2) Devir Bakiyeleri veya Ödemeler</span> → <span className="font-medium">3) Seanslar</span>. Yalnızca{" "}
                <span className="font-medium">Seanslar</span> aktarılıp ödeme/devir bakiyesi hiç aktarılmazsa, sistem tahsilat görmediği için tüm
                öğrenciler Borç Raporu&apos;nda tamamını borçlu gösterir — bu bir hata değildir, sadece eksik bir aktarım adımıdır. Kaynak
                dosyanızda ödeme geçmişi de varsa onu ayrı bir &quot;Ödemeler&quot; aktarımı olarak yükleyin; yalnızca güncel bakiyeyi
                biliyorsanız &quot;Devir Bakiyesi&quot; türünü kullanın.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <p className="mb-3 text-sm font-semibold text-foreground">Dosya(lar) Seçin</p>
        <p className="mb-3 text-xs text-muted-foreground">
          Öğrenci, öğretmen, seans ve diğer veri türlerini ayrıca seçmenize gerek yok — dosyayı yükleyin, sistem içeriğini analiz edip neyin
          bulunduğunu otomatik olarak size gösterecek.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const list = e.target.files;
            const arr = list ? Array.from(list) : [];
            e.target.value = "";
            if (arr.length > 0) void handleFilesSelected(arr);
          }}
        />

        {files.length > 0 && (
          <div className="space-y-2 mb-3">
            {files.map((f) => (
              <div key={f.name} className="flex items-center gap-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100">
                  <FileCheck className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{f.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{uploadedSheets.filter((u) => u.sourceFileName === f.name).length} sayfa</p>
                </div>
                <button onClick={() => removeFile(f.name)} className="shrink-0 text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2">
                  Dosyayı Kaldır
                </button>
              </div>
            ))}
          </div>
        )}

        <div
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-10 px-6 text-center transition-colors select-none",
            isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/20"
          )}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const list = Array.from(e.dataTransfer.files ?? []);
            if (list.length > 0) void handleFilesSelected(list);
          }}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
            <Upload className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{isParsing ? "Dosyalar okunuyor…" : "Dosya seçmek için tıklayın veya sürükleyip bırakın"}</p>
            <p className="mt-1 text-xs text-muted-foreground">.xlsx, .xls ve .csv — birden fazla dosya seçebilirsiniz</p>
          </div>
        </div>

        {parseError && (
          <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-2.5">
            <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <p className="text-xs text-destructive">{parseError}</p>
          </div>
        )}

        {duplicateFileWarnings.length > 0 && (
          <div className="mt-3 space-y-2">
            {duplicateFileWarnings.map((w) => (
              <div key={w.file.name} className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800">
                  &apos;{w.file.name}&apos; dosyası daha önce {formatDateTime(w.batch.importedAt)} tarihinde içe aktarılmış görünüyor.
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button className={btnPrimary} disabled={uploadedSheets.length === 0 || isParsing} onClick={() => setStep("analysis")}>
          Devam
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  // ── Step: analysis ───────────────────────────────────────────────────────

  /** A type is actually going into the import only when the analyzer found it
   *  AND the user hasn't unchecked it — used both for the ledger warning banner
   *  and for deciding whether "Devam" can be pressed. */
  function isTypeIncluded(type: ImportEntityType): boolean {
    return detectedTypes.has(type) && !disabledTypes.has(type);
  }

  const analysisCounts = {
    matrix: uploadedSheets.filter((u) => classificationByKey.get(u.key)?.resultType === "scheduleMatrix").length,
    ledger: uploadedSheets.filter((u) => classificationByKey.get(u.key)?.resultType === "studentLedger").length,
    unknown: uploadedSheets.filter((u) => (classificationByKey.get(u.key)?.confidence ?? 0) < CONFIDENCE_THRESHOLD).length,
  };

  const analysisStep = (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
        <Table2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <p className="text-sm text-foreground/80">{RESPONSIBILITY_NOTICE}</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <p className="mb-3 text-sm font-semibold text-foreground">Çalışma Kitabı Özeti</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard title="Toplam Sayfa" value={uploadedSheets.length} icon={Table2} variant="default" />
          <StatCard title="Zaman Çizelgesi Matrisi" value={analysisCounts.matrix} icon={Grid3x3} variant="default" />
          <StatCard title="Ders Takip Defteri" value={analysisCounts.ledger} icon={BookOpen} variant="default" />
          <StatCard title="Düşük Güvenilirlik" value={analysisCounts.unknown} icon={HelpCircle} variant={analysisCounts.unknown > 0 ? "warning" : "success"} />
          <StatCard title="Çözümlenmemiş Sayfa" value={unresolvedSheets.length} icon={FileWarning} variant={unresolvedSheets.length > 0 ? "danger" : "success"} />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-sm font-semibold text-foreground">Tespit Edilen Veriler</p>
        <p className="mb-3 text-xs text-muted-foreground">
          Sistem dosyanızı otomatik olarak analiz etti. Bulunan her veri türü otomatik olarak seçildi — dilerseniz aşağıdan devre dışı
          bırakabilirsiniz.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {IMPORT_ENTITY_TYPES.map((type) => {
            const isDetected = detectedTypes.has(type);
            const isEnabled = !disabledTypes.has(type);
            const count = detectedCounts[type];
            const Icon = ENTITY_ICONS[type];
            return (
              <div
                key={type}
                className={cn(
                  "flex items-start justify-between gap-3 rounded-lg border p-3.5",
                  isDetected ? "border-border bg-background" : "border-border/50 bg-muted/20"
                )}
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <span className="mt-0.5 shrink-0 leading-none" aria-hidden>
                    {isDetected ? "🟢" : "⚪"}
                  </span>
                  <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", isDetected ? "text-primary" : "text-muted-foreground/50")} />
                  <div className="min-w-0">
                    <p className={cn("text-sm font-medium leading-none", isDetected ? "text-foreground" : "text-muted-foreground")}>
                      {getImportTypeLabel(type)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {isDetected ? `${count.toLocaleString("tr-TR")} kayıt` : "Bulunamadı"}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground/70">{ENTITY_DESCRIPTIONS[type]}</p>
                  </div>
                </div>
                {isDetected && (
                  <label className="flex shrink-0 cursor-pointer items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => toggleDisabledType(type)}
                      className="h-4 w-4 rounded accent-primary"
                    />
                    <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                      {isEnabled ? "Aktarılacak" : "Hariç tutuldu"}
                    </span>
                  </label>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {unresolvedSheets.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 space-y-4">
          <div className="flex items-start gap-3">
            <HelpCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-900">Bazı sayfaları güvenle tanımlayamadık</p>
              <p className="mt-0.5 text-xs text-amber-800">Devam etmeden önce lütfen bu sayfalar için bir tür seçin veya sayfayı yok sayın.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {unresolvedSheets.map((u) => {
              const c = classificationByKey.get(u.key)!;
              return (
                <div key={u.key} className="space-y-2.5 rounded-lg border border-amber-200 bg-white p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{u.sheet.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {u.sourceFileName} · {u.sheet.rows.length} satır
                      </p>
                    </div>
                    <ConfidenceBadge confidence={c.confidence} />
                  </div>
                  <p className="text-xs text-amber-800">
                    {c.resultType === "unknown"
                      ? "Bu sayfayı tanımlayamadık. Lütfen tür seçin:"
                      : `"${resultTypeLabel(c.resultType)}" olabilir ama güven düzeyi düşük (%${Math.round(c.confidence * 100)}). Lütfen onaylayın veya değiştirin:`}
                  </p>
                  <select
                    value={overrides[u.key] ?? ""}
                    onChange={(e) =>
                      setOverrides((prev) => {
                        const next = { ...prev };
                        if (e.target.value === "") delete next[u.key];
                        else next[u.key] = e.target.value as ImportEntityType | "ignore";
                        return next;
                      })
                    }
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">— Tür seçin —</option>
                    {OVERRIDE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAllSheets((v) => !v)}
          className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/20"
        >
          <div>
            <p className="text-sm font-semibold text-foreground">Gelişmiş: Tüm Sayfalar ({uploadedSheets.length})</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Analiz sonucunu sayfa sayfa inceleyin veya güvenle tespit edilmiş bir sayfanın türünü elle değiştirin.
            </p>
          </div>
          {showAllSheets ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
        </button>

        {showAllSheets && (
          <div className="grid grid-cols-1 gap-4 border-t border-border/60 p-5 lg:grid-cols-2">
            {uploadedSheets.map((u) => {
              const c = classificationByKey.get(u.key)!;
              const effective = effectiveTypeFor(u.key);
              const isUnresolved = effective === "unresolved";
              return (
                <div key={u.key} className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{u.sheet.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {u.sourceFileName} · {u.sheet.rows.length} satır
                      </p>
                    </div>
                    <ConfidenceBadge confidence={c.confidence} />
                  </div>

                  <p className="text-xs text-foreground/80">
                    Algılanan tür: <span className="font-medium">{resultTypeLabel(c.resultType)}</span>
                  </p>

                  {c.reasons.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      <p className="font-medium text-foreground/70 mb-1">Tespit nedeni:</p>
                      <ul className="space-y-0.5">
                        {c.reasons.map((r, i) => (
                          <li key={i}>✓ {r}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-medium text-foreground">Tür (gerekirse değiştirin)</label>
                    <select
                      value={overrides[u.key] ?? ""}
                      onChange={(e) =>
                        setOverrides((prev) => {
                          const next = { ...prev };
                          if (e.target.value === "") delete next[u.key];
                          else next[u.key] = e.target.value as ImportEntityType | "ignore";
                          return next;
                        })
                      }
                      className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">— Otomatik algılamayı kullan —</option>
                      {OVERRIDE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {effective === "scheduleMatrix" && (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 space-y-2">
                      <p className="text-xs text-foreground/80">
                        Bu sayfa bir zaman çizelgesi matrisi gibi görünüyor. Seansa dönüştürülecek — hangi eğitim türü için?
                      </p>
                      <select
                        value={matrixEducationTypeId[u.key] ?? mockEducationTypes[0]?.id ?? ""}
                        onChange={(e) => setMatrixEducationTypeId((prev) => ({ ...prev, [u.key]: e.target.value }))}
                        className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                      >
                        {mockEducationTypes.map((et) => (
                          <option key={et.id} value={et.id}>
                            {et.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {effective === "studentLedger" && (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                      <p className="text-xs text-foreground/80">Bu dosya {STUDENT_LEDGER_RESULT_LABEL} olarak algılandı.</p>
                    </div>
                  )}

                  {isUnresolved && (
                    <p className="text-xs text-amber-700">
                      Devam etmek için lütfen bu sayfa için bir tür seçin veya &quot;Yok Say&quot; seçeneğini kullanın (yukarıdaki &quot;Belirsiz
                      Sayfalar&quot; bölümünden de yapabilirsiniz).
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {ledgerSheets.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-5">
          <div>
            <p className="mb-2 text-sm font-semibold text-foreground">{STUDENT_LEDGER_RESULT_LABEL} — Eğitim Türü</p>
            <p className="mb-2 text-xs text-muted-foreground">Bu format eğitim türü içermez; tüm öğrenci sayfaları için tek bir tür seçin.</p>
            <select
              value={ledgerEducationTypeId || mockEducationTypes[0]?.id || ""}
              onChange={(e) => setLedgerEducationTypeId(e.target.value)}
              className="h-8 w-full max-w-xs rounded-md border border-input bg-background px-2 text-xs"
            >
              {mockEducationTypes.map((et) => (
                <option key={et.id} value={et.id}>
                  {et.name}
                </option>
              ))}
            </select>
          </div>

          {mode === "historical" && (
            <div className="space-y-3 border-t border-border/60 pt-5">
              {!isTypeIncluded("payments") && !isTypeIncluded("openingBalances") && (
                <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-amber-900">
                    Bu dosya geçmiş seans/tahakkuk bilgisi içeriyor ancak ödeme veya devir bakiyesi içermiyor. Aktarımdan sonra öğrenciler
                    borçlu görünebilir. Doğru cari hesap için geçmiş ödemeleri veya net devir bakiyelerini ayrıca aktarın.
                  </p>
                </div>
              )}

              <div>
                <p className="mb-1 text-sm font-semibold text-foreground">Bu geçmiş seansları nasıl aktarmak istersiniz?</p>
                <p className="mb-3 text-xs text-muted-foreground">
                  Seçiminiz yalnızca bu aktarımdaki seansların borç/tahakkuk oluşturup oluşturmayacağını belirler — sahte ödeme kaydı asla
                  otomatik oluşturulmaz.
                </p>
                <div className="space-y-2">
                  {LEDGER_IMPORT_CHOICE_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className={cn(
                        "flex items-start gap-3 rounded-lg border p-3.5 cursor-pointer transition-colors",
                        ledgerImportChoice === opt.value ? "border-primary bg-primary/5" : "border-border bg-background hover:border-primary/40 hover:bg-muted/30"
                      )}
                    >
                      <input
                        type="radio"
                        name="ledgerImportChoice"
                        checked={ledgerImportChoice === opt.value}
                        onChange={() => setLedgerImportChoice(opt.value)}
                        className="mt-1 h-4 w-4 accent-primary shrink-0"
                      />
                      <div>
                        <p className="text-sm font-medium text-foreground">{opt.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{opt.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <button className={btnOutline} onClick={() => setStep("upload")}>
          <ChevronLeft className="h-4 w-4" />
          Geri
        </button>
        <button
          className={btnPrimary}
          disabled={!canProceedFromAnalysis}
          onClick={() => (classicTasks.length > 0 ? setStep("mapping") : buildAndGoToPreview())}
        >
          Devam
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  // ── Step: mapping ─────────────────────────────────────────────────────────

  const activeMapping = activeTask ? mappingForTask(activeTask) : [];
  const activeSystemFields = activeTask ? getSystemFieldsForImportType(activeTask.type) : [];

  const mappingStep = (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
        <Table2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <p className="text-sm text-foreground/80">{RESPONSIBILITY_NOTICE}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {classicTasks.map((t, i) => (
          <button
            key={t.key}
            onClick={() => setMappingTaskIndex(i)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium border transition-colors",
              i === mappingTaskIndex ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {getImportTypeLabel(t.type)} · {t.sheet.name}
            {unmappedRequiredForTask(t).length > 0 && <span className="ml-1 text-amber-500">●</span>}
          </button>
        ))}
      </div>

      {activeTask && (
        <>
          <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
            <FileCheck className="h-4 w-4 text-emerald-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {activeTask.sourceFileName} — {activeTask.sheet.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {activeMapping.length} sütun tespit edildi · {getImportTypeLabel(activeTask.type)} · {activeTask.sheet.rows.length} satır
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="border-b border-border/60 px-5 py-4">
              <p className="text-sm font-semibold text-foreground">Kolon Eşleştirme</p>
              <p className="text-xs text-muted-foreground mt-0.5">Her Excel sütununu karşılık gelen sistem alanıyla eşleştirin</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Excel Kolonu</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sistem Alanı</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Örnek Veri</th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell w-28">Zorunlu mu?</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide w-28">Durum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {activeMapping.map((m, i) => {
                    const field = activeSystemFields.find((f) => f.key === m.systemField);
                    return (
                      <tr key={m.excelColumn} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-0.5 text-xs font-medium font-mono text-foreground">
                            <Table2 className="h-3 w-3 text-muted-foreground" />
                            {m.excelColumn}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={m.systemField ?? ""}
                            onChange={(e) => updateTaskMapping(activeTask, i, e.target.value)}
                            className="h-8 w-full min-w-[160px] rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          >
                            <option value="">— Eşleştirme Yok —</option>
                            {activeSystemFields.map((f) => (
                              <option key={f.key} value={f.key}>
                                {f.label}
                                {f.required ? " *" : ""}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className="text-xs text-muted-foreground">{m.sampleData || <span className="text-muted-foreground/40">(boş)</span>}</span>
                        </td>
                        <td className="px-4 py-3 text-center hidden md:table-cell">
                          {field ? (
                            <span className={cn("text-xs font-medium", field.required ? "text-destructive" : "text-muted-foreground")}>{field.required ? "Evet" : "Hayır"}</span>
                          ) : (
                            <span className="text-muted-foreground/40 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {m.systemField ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                              <CheckCircle2 className="h-3 w-3" />
                              Eşleşti
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Eşleşmedi</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {unmappedRequiredForTask(activeTask).length > 0 && (
              <div className="mx-4 mb-4 mt-2 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5">
                <FileWarning className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-amber-800">Zorunlu alanlar eşleştirilmedi</p>
                  <p className="text-xs text-amber-700 mt-0.5">{unmappedRequiredForTask(activeTask).map((f) => f.label).join(", ")}</p>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      <div className="flex justify-between">
        <button className={btnOutline} onClick={() => setStep("analysis")}>
          <ChevronLeft className="h-4 w-4" />
          Geri
        </button>
        <button className={btnPrimary} disabled={anyUnmappedRequired} onClick={buildAndGoToPreview}>
          Önizlemeye Geç
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  // ── Step: preview ────────────────────────────────────────────────────────

  const impactCards: { title: string; value: string | number; description?: string; icon: LucideIcon; variant: "default" | "success" | "warning" | "danger" }[] = [];
  if (impact.sessionsToCreate > 0) {
    // Revenue always comes straight from the Excel's own Ders Ücreti/Tutar columns,
    // so it's shown unconditionally. Teacher earning/hakediş is a SEPARATE concept
    // this file format never carries — the Excel has no payout data, only student
    // billing — and it's only ever known when the teacher already has a configured
    // earning model/price in the system. Presenting a 0-fallback as a real number
    // (or Center Profit as 100% margin) would be actively misleading, so both are
    // replaced with "—" the moment even one session's hakediş is unreliable.
    const teacherEarningKnown = impact.sessionsWithUnknownTeacherEarning === 0;
    const hasHistoricalNonBillable = impact.historicalNonBillableSessionsToCreate > 0;
    impactCards.push({
      title: "Oluşturulacak Seans",
      value: impact.sessionsToCreate,
      description: hasHistoricalNonBillable
        ? `${impact.sessionsToCreate - impact.historicalNonBillableSessionsToCreate} tahakkuk + ${impact.historicalNonBillableSessionsToCreate} geçmiş kayıt (borca dahil değil)`
        : "Bu aktarımda oluşacak yeni seans sayısı",
      icon: CalendarDays,
      variant: "default",
    });
    impactCards.push({
      title: "Tahmini Ciro",
      value: formatCurrency(impact.totalTahakkukImpact),
      description: hasHistoricalNonBillable
        ? "Yalnızca tahakkuk seçilen seanslardan — geçmiş kayıt olarak işaretlenenler hariç"
        : "Excel'deki Ders Ücreti / Tutar alanlarından — öğrenci tahakkuku",
      icon: TrendingUp,
      variant: "default",
    });
    impactCards.push({
      title: "Tahmini Öğretmen Hakedişi",
      value: teacherEarningKnown ? formatCurrency(impact.estimatedTeacherEarningImpact) : "—",
      description: teacherEarningKnown
        ? "Seanslardan doğacak öğretmen kazancı"
        : "Öğretmen hakedişi hesaplanamadı. Öğretmen ayarları tamamlandıktan sonra sistem tarafından hesaplanır.",
      icon: Banknote,
      variant: teacherEarningKnown ? "default" : "warning",
    });
    impactCards.push({
      title: "Tahmini Merkez Karı",
      value: teacherEarningKnown ? formatCurrency(impact.estimatedCenterProfitImpact) : "—",
      description: teacherEarningKnown ? "Ciro − Öğretmen hakedişi" : "Öğretmen hakedişi bilinmediği için merkez kârı hesaplanamadı.",
      icon: Scale,
      variant: teacherEarningKnown ? (impact.estimatedCenterProfitImpact >= 0 ? "success" : "danger") : "warning",
    });
  }
  if (impact.paymentsToCreate > 0) impactCards.push({ title: "Yeni Ödeme Kaydı", value: impact.paymentsToCreate, icon: CreditCard, variant: "default" });
  if (impact.totalTahsilatImpact !== 0)
    impactCards.push({ title: "Tahmini Tahsilat", value: formatCurrency(impact.totalTahsilatImpact), description: "Bu aktarımdaki ödeme kayıtları toplamı", icon: CheckCircle2, variant: "success" });
  if (impact.teacherPaymentsToCreate > 0) impactCards.push({ title: "Yeni Öğretmen Ödemesi Kaydı", value: impact.teacherPaymentsToCreate, icon: Banknote, variant: "default" });
  if (impact.teacherPaymentImpact !== 0)
    impactCards.push({ title: "Öğretmene Ödenen Tutar", value: formatCurrency(impact.teacherPaymentImpact), description: "Hakedişten farklı: fiilen ödenen tutar", icon: Banknote, variant: "warning" });
  if (impact.openingBalancesToCreate > 0) impactCards.push({ title: "Yeni Devir Bakiyesi Kaydı", value: impact.openingBalancesToCreate, icon: Scale, variant: "default" });
  if (impact.cashImpact !== 0) impactCards.push({ title: "Kasa Etkisi", value: formatCurrency(impact.cashImpact), icon: Banknote, variant: impact.cashImpact >= 0 ? "success" : "danger" });
  if (impact.remainingBalanceImpact !== 0)
    impactCards.push({ title: "Kalan Bakiye Etkisi", value: formatCurrency(impact.remainingBalanceImpact), icon: Scale, variant: impact.remainingBalanceImpact > 0 ? "warning" : "success" });

  const creationBreakdownEntries = IMPORT_ENTITY_TYPES.filter((t) => groupedPreview.has(t));
  const hasAnyCreation = Object.values(creationBreakdown).some((c) => c > 0);

  const previewStep = (
    <div className="space-y-5">
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard
          title="Toplam Satır"
          value={summary.totalRows}
          description="Dosyadan okunan"
          icon={Table2}
          variant="default"
          onClick={() => setStatusFilter("all")}
          active={statusFilter === "all"}
        />
        <StatCard
          title="Oluşturulacak"
          value={summary.validRows}
          description="Aktarılabilir"
          icon={CheckCircle2}
          variant="success"
          onClick={() => toggleStatusFilter("valid")}
          active={statusFilter === "valid"}
        />
        <StatCard
          title="Uyarılı"
          value={summary.warningRows}
          description="Gözden geçirin, yine de aktarılabilir"
          icon={AlertTriangle}
          variant={summary.warningRows > 0 ? "warning" : "success"}
          onClick={() => toggleStatusFilter("warning")}
          active={statusFilter === "warning"}
        />
        <StatCard title="Atlanan" value={summary.skippedRows} description="TOPLAM/boş satırlar — tabloda gösterilmez" icon={CircleSlash} variant="default" />
        <StatCard
          title="Zaten Mevcut"
          value={summary.duplicateRows}
          description="Atlanacak"
          icon={CircleSlash}
          variant="default"
          onClick={() => toggleStatusFilter("duplicate")}
          active={statusFilter === "duplicate"}
        />
        <StatCard
          title="Hatalı"
          value={summary.errorRows}
          description="Aktarılamaz"
          icon={XCircle}
          variant={summary.errorRows > 0 ? "danger" : "success"}
          onClick={() => toggleStatusFilter("error")}
          active={statusFilter === "error"}
        />
      </div>

      {hasAnyCreation && (
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-3 text-sm font-semibold text-foreground">Bu Aktarım Neler Oluşturacak</p>
          <div className="flex flex-wrap gap-3">
            {creationBreakdownEntries.map((t) => {
              const Icon = ENTITY_ICONS[t];
              return (
                <div key={t} className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2">
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm text-foreground">
                    <span className="font-semibold tabular-nums">{creationBreakdown[t]}</span> {getImportTypeLabel(t)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {previewResults.some((r) => r.rows.some((row) => row.preview.issues.some((i) => i.includes("varsayılan saat")))) && (
        <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/30 px-4 py-3">
          <HelpCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground">
            Bu dosyadaki bazı alanlar eksik olduğu için sistem varsayılan saat kullanmıştır. Bu satırlar uyarılıdır ama aktarılabilir.
          </p>
        </div>
      )}

      {impactCards.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <p className="text-sm font-semibold text-foreground">Finansal Etki Önizlemesi (kaydedilmeden önce)</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {impactCards.map((c) => (
              <StatCard key={c.title} title={c.title} value={c.value} description={c.description} icon={c.icon} variant={c.variant} />
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Geri alma:</span> Onayladığınızda bu içe aktarım tek bir toplu işlem (batch) olarak
          kaydedilir. Sonuç ekranından veya İçe Aktarım Geçmişi&apos;nden istediğiniz zaman &quot;İçe Aktarmayı Geri Al&quot; ile tamamını geri
          alabilirsiniz.
        </p>
      </div>

      {summary.errorRows > 0 && (
        <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <p className="text-sm text-destructive">
            <span className="font-semibold">{summary.errorRows} hatalı satır</span> aktarılamayacak ve atlanacak. Diğer geçerli satırlar normal
            şekilde aktarılır.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {QUICK_STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setStatusFilter(f.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              statusFilter === f.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">Filtreler</p>
          {anyPreviewFilterActive && (
            <button type="button" onClick={resetPreviewFilters} className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline underline-offset-2">
              <X className="h-3 w-3" />
              Filtreleri Temizle
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <select
            value={sheetFilter}
            onChange={(e) => setSheetFilter(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">Tüm sayfalar</option>
            {sheetFilterOptions.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <input
            value={studentFilterInput}
            onChange={(e) => setStudentFilterInput(e.target.value)}
            placeholder="Öğrenci adı ara…"
            className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            value={teacherFilterInput}
            onChange={(e) => setTeacherFilterInput(e.target.value)}
            placeholder="Öğretmen adı ara…"
            className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            value={dateFilterInput}
            onChange={(e) => setDateFilterInput(e.target.value)}
            placeholder="Tarih ara… (YYYY-MM-DD)"
            className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {[...groupedPreview.entries()].map(([type, entries]) => {
        const rows = entries.flatMap((e) => e.rows);
        const groupSummary = buildImportSummary(rows);
        const visibleEntries = entries
          .map((entry) => ({ entry, filteredRows: entry.rows.filter((r) => rowMatchesFilters(r, entry.sheetKey)) }))
          .filter(({ filteredRows }) => !anyPreviewFilterActive || filteredRows.length > 0);

        if (anyPreviewFilterActive && visibleEntries.length === 0) return null;

        return (
          <div key={type} className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="border-b border-border/60 px-5 py-4 flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="text-sm font-semibold text-foreground">{getImportTypeLabel(type)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {entries.length} sayfa · {groupSummary.toCommitRows} satır aktarılacak
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">✓ {groupSummary.validRows} oluşturulacak</span>
                {groupSummary.warningRows > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">⚠ {groupSummary.warningRows} uyarılı</span>
                )}
                {groupSummary.duplicateRows > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">≡ {groupSummary.duplicateRows} mevcut</span>
                )}
                {groupSummary.errorRows > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">✕ {groupSummary.errorRows} hata</span>
                )}
              </div>
            </div>
            <div className="divide-y divide-border/60">
              {visibleEntries.map(({ entry, filteredRows }) => {
                const sheetSummary = buildImportSummary(entry.rows);
                const expanded = isSheetExpanded(entry);
                const rowsToShow = anyPreviewFilterActive ? filteredRows : entry.rows;
                const displayRows: PreviewDisplayRow[] = rowsToShow.map((row, idx) => ({
                  sourceKey: entry.sheetKey,
                  sheetLabel: entry.sheetLabel,
                  type: entry.type,
                  row,
                  idx,
                }));
                const isClean = sheetSummary.errorRows === 0 && sheetSummary.warningRows === 0;
                return (
                  <div key={entry.sheetKey}>
                    <button
                      type="button"
                      onClick={() => toggleSheetExpand(entry)}
                      className={cn(
                        "w-full flex items-center justify-between gap-3 px-5 py-3 text-left transition-colors hover:bg-muted/20",
                        sheetSummary.errorRows > 0 && "bg-destructive/5"
                      )}
                    >
                      <div className="min-w-0 flex items-center gap-2">
                        {expanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            {sheetSummary.errorRows > 0 && <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                            <p className={cn("text-sm font-medium truncate", sheetSummary.errorRows > 0 ? "text-destructive" : "text-foreground")}>
                              {entry.sheetLabel}
                            </p>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                            <span className="text-xs text-muted-foreground">{entry.rows.length} satır</span>
                            {isClean && <span className="text-xs font-medium text-emerald-700">🟢 Tümü Geçerli</span>}
                            {sheetSummary.errorRows > 0 && (
                              <span className="text-xs font-medium text-red-700">🔴 {sheetSummary.errorRows} Hata</span>
                            )}
                            {sheetSummary.warningRows > 0 && (
                              <span className="text-xs font-medium text-amber-700">🟡 {sheetSummary.warningRows} Uyarı</span>
                            )}
                            {sheetSummary.duplicateRows > 0 && (
                              <span className="text-xs font-medium text-muted-foreground">≡ {sheetSummary.duplicateRows} mevcut</span>
                            )}
                            {anyPreviewFilterActive && (
                              <span className="text-xs text-primary">· {filteredRows.length} filtreyle eşleşen</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                    {expanded && (
                      <DataTable data={displayRows} columns={previewColumns} keyExtractor={previewRowKey} emptyTitle="Filtreyle eşleşen satır yok" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-2">
        <p className="text-sm font-semibold text-foreground">Bu aktarım şunları oluşturacak:</p>
        {hasAnyCreation ? (
          <ul className="list-disc space-y-0.5 pl-5 text-sm text-foreground/90">
            {creationBreakdownEntries
              .filter((t) => creationBreakdown[t] > 0)
              .map((t) => (
                <li key={t}>
                  <span className="font-semibold tabular-nums">{creationBreakdown[t]}</span> {getImportTypeLabel(t)}
                </li>
              ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Şu an aktarılabilir geçerli kayıt yok.</p>
        )}
        {impact.historicalNonBillableSessionsToCreate > 0 && (
          <p className="text-xs text-amber-700">
            Bunlardan <span className="font-semibold tabular-nums">{impact.historicalNonBillableSessionsToCreate}</span> seans &quot;Geçmiş
            kayıt&quot; olarak aktarılacak: ders geçmişinde ve raporlarda görünür ama öğrenci borcu/tahakkuk oluşturmaz.
          </p>
        )}
        <p className="pt-1 text-xs text-muted-foreground">
          Bu işlem tek bir İçe Aktarım Batch&apos;i olarak kaydedilecek. Sonuç ekranından veya İçe Aktarım Geçmişi&apos;nden istediğiniz zaman
          &quot;İçe Aktarmayı Geri Al&quot; ile tamamını geri alabilirsiniz.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 h-4 w-4 rounded accent-primary shrink-0" />
          <span className="text-sm text-foreground/90">{CONFIRMATION_COPY}</span>
        </label>
      </div>

      <div className="flex items-center justify-between">
        <button className={btnOutline} onClick={() => (classicTasks.length > 0 ? setStep("mapping") : setStep("analysis"))}>
          <ChevronLeft className="h-4 w-4" />
          Geri
        </button>
        <button className={btnPrimary} disabled={!confirmed || summary.toCommitRows === 0} onClick={() => void handleConfirmImport()}>
          <CheckCircle2 className="h-4 w-4" />
          Aktarımı Onayla ({summary.toCommitRows})
        </button>
      </div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader title="Excel Aktarımı" description="Geçmiş verilerinizi güvenle sisteme taşıyın — mevcut finans/rapor mantığı değişmez" />

      <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
        <Table2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <p className="text-sm text-foreground/80">
          Excel/CSV dosyalarınızı yükleyin, sistem yapıyı analiz etsin, sütunları eşleştirin ve kaydetmeden önce önizleyin. Aynı dosyayı tekrar
          yüklemek mükerrer kayıt oluşturmaz.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card px-6 py-5">{stepIndicator}</div>

      {step === "upload" && uploadStep}
      {step === "analysis" && analysisStep}
      {step === "mapping" && mappingStep}
      {step === "preview" && previewStep}

      {importHistorySection}
      {rollbackDialog}
      {repairDrawer}
    </div>
  );
}
