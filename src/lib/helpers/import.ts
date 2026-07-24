import type {
  ImportEntityType,
  ImportMode,
  ImportSystemField,
  ImportColumnMapping,
  ImportPreviewRow,
  ImportEntityMatch,
  ImportSummary,
  ImportFinancialImpact,
  ImportResult,
  ImportBatch,
  ImportBatchEntityIds,
  EditedImportRecord,
  Student,
  Guardian,
  Teacher,
  Session,
  SessionStatus,
  Payment,
  PaymentMethod,
  TeacherPayment,
  TeacherPaymentType,
  OpeningBalance,
  OpeningBalanceType,
  EducationType,
  TeacherEducationTypeAssignment,
} from "@/types";
import { cellToDisplayString, parseCellAsDateString, parseCellAsTimeString, parseCellAsNumber, type ParsedSheet } from "@/lib/helpers/import-parse";
import {
  normalizeName,
  matchStudent,
  matchTeacher,
  matchGuardian,
  resolveStudentByName,
  resolveTeacherByName,
  findDuplicateSession,
  findDuplicatePayment,
  findDuplicateTeacherPayment,
  findDuplicateOpeningBalance,
  buildStudentIndex,
  addStudentToIndex,
  buildGuardianIndex,
  addGuardianToIndex,
  buildTeacherIndex,
  addTeacherToIndex,
  buildSessionDuplicateIndex,
  addSessionToDuplicateIndex,
  buildPaymentDuplicateIndex,
  addPaymentToDuplicateIndex,
  buildTeacherPaymentDuplicateIndex,
  addTeacherPaymentToDuplicateIndex,
  buildOpeningBalanceDuplicateIndex,
  addOpeningBalanceToDuplicateIndex,
  studentHasOpeningBalance,
} from "@/lib/helpers/import-match";
import { buildSessionConflictIndex, addSessionToConflictIndex, checkSessionConflictIndexed } from "@/lib/helpers/session-conflict";
import {
  calculateTeacherSessionEarning,
  calculateSessionTotal,
  calculateSessionTeacherEarning,
  calculateSessionCenterProfit,
  isDeductionPaymentType,
} from "@/lib/helpers/finance";
import { isTeacherAssignedToEducationType } from "@/lib/helpers/teacher-assignments";

// ─── Entity type labels ─────────────────────────────────────────────────────────

export const IMPORT_ENTITY_TYPES: ImportEntityType[] = [
  "students",
  "guardians",
  "teachers",
  "sessions",
  "payments",
  "teacherPayments",
  "openingBalances",
];

/** Fixed processing order for a multi-select import run — people before the
 *  records that reference them, balances before the activity that follows them. */
export const IMPORT_DEPENDENCY_ORDER: ImportEntityType[] = [
  "guardians",
  "students",
  "teachers",
  "openingBalances",
  "sessions",
  "payments",
  "teacherPayments",
];

export function sortByDependencyOrder<T>(items: T[], typeOf: (item: T) => ImportEntityType): T[] {
  return [...items].sort(
    (a, b) => IMPORT_DEPENDENCY_ORDER.indexOf(typeOf(a)) - IMPORT_DEPENDENCY_ORDER.indexOf(typeOf(b))
  );
}

function sortTaskRowSetsByDependency<T extends { type: ImportEntityType }>(sets: T[]): T[] {
  return sortByDependencyOrder(sets, (s) => s.type);
}

export function getImportTypeLabel(type: ImportEntityType): string {
  const labels: Record<ImportEntityType, string> = {
    students: "Öğrenciler",
    guardians: "Veliler",
    teachers: "Öğretmenler",
    sessions: "Seanslar",
    payments: "Ödemeler",
    teacherPayments: "Öğretmen Ödemeleri",
    openingBalances: "Devir Bakiyeleri",
  };
  return labels[type];
}

// ─── System fields per entity type ──────────────────────────────────────────────

const SYSTEM_FIELDS: Record<ImportEntityType, ImportSystemField[]> = {
  students: [
    { key: "fullName", label: "Öğrenci Adı Soyadı", required: true },
    { key: "birthDate", label: "Doğum Tarihi", required: false },
    { key: "status", label: "Durum", required: false },
    { key: "weeklySessionCount", label: "Haftalık Seans Sayısı", required: false },
    { key: "guardianName", label: "Veli Adı", required: false },
    { key: "guardianPhone", label: "Veli Telefonu", required: false },
    { key: "notes", label: "Notlar", required: false },
  ],
  guardians: [
    { key: "fullName", label: "Veli Adı Soyadı", required: true },
    { key: "phone", label: "Telefon", required: true },
    { key: "email", label: "E-posta", required: false },
    { key: "relationship", label: "Yakınlık", required: false },
    { key: "address", label: "Adres", required: false },
  ],
  teachers: [
    { key: "fullName", label: "Öğretmen Adı Soyadı", required: true },
    { key: "phone", label: "Telefon", required: false },
    { key: "email", label: "E-posta", required: false },
    { key: "status", label: "Durum", required: false },
  ],
  sessions: [
    { key: "studentName", label: "Öğrenci", required: true },
    { key: "teacherName", label: "Öğretmen", required: true },
    { key: "educationType", label: "Eğitim Türü", required: true },
    { key: "date", label: "Tarih", required: true },
    { key: "time", label: "Saat", required: false },
    { key: "sessionCount", label: "Seans Sayısı", required: false },
    { key: "studentPrice", label: "Öğrenci Birim Fiyatı", required: true },
    { key: "teacherEarning", label: "Öğretmen Hakedişi", required: false },
    { key: "status", label: "Durum", required: false },
    { key: "notes", label: "Notlar", required: false },
  ],
  payments: [
    { key: "studentName", label: "Öğrenci", required: true },
    { key: "amount", label: "Tutar", required: true },
    { key: "date", label: "Tarih", required: true },
    { key: "method", label: "Ödeme Yöntemi", required: false },
    { key: "notes", label: "Notlar", required: false },
  ],
  teacherPayments: [
    { key: "teacherName", label: "Öğretmen", required: true },
    { key: "amount", label: "Tutar", required: true },
    { key: "date", label: "Tarih", required: true },
    { key: "paymentType", label: "Ödeme Türü", required: false },
    { key: "method", label: "Ödeme Yöntemi", required: false },
    { key: "description", label: "Açıklama", required: false },
  ],
  openingBalances: [
    { key: "studentName", label: "Öğrenci", required: true },
    { key: "guardianName", label: "Veli", required: false },
    { key: "amount", label: "Tutar", required: true },
    { key: "balanceType", label: "Borç / Alacak", required: true },
    { key: "date", label: "Tarih", required: true },
    { key: "note", label: "Not", required: false },
  ],
};

export function getSystemFieldsForImportType(type: ImportEntityType): ImportSystemField[] {
  return SYSTEM_FIELDS[type];
}

// ─── Header alias suggestions (auto-mapping) ────────────────────────────────────

const HEADER_ALIASES: Record<ImportEntityType, Record<string, string>> = {
  students: {
    "ad soyad": "fullName", "öğrenci adı": "fullName", "öğrenci adı soyadı": "fullName",
    "isim": "fullName", "öğrenci": "fullName", "adı soyadı": "fullName",
    "doğum tarihi": "birthDate", "dogum tarihi": "birthDate",
    "durum": "status", "aktif/pasif": "status",
    "seans/hafta": "weeklySessionCount", "haftalık seans sayısı": "weeklySessionCount", "haftalık seans": "weeklySessionCount",
    "veli adı": "guardianName", "veli": "guardianName", "veli adı soyadı": "guardianName",
    "telefon": "guardianPhone", "veli telefonu": "guardianPhone", "veli telefon": "guardianPhone",
    "notlar": "notes", "not": "notes",
  },
  guardians: {
    "ad soyad": "fullName", "veli adı": "fullName", "veli adı soyadı": "fullName", "isim": "fullName",
    "telefon": "phone", "telefon no": "phone", "cep telefonu": "phone",
    "e-posta": "email", "email": "email", "eposta": "email",
    "yakınlık": "relationship", "yakinlik": "relationship",
    "adres": "address",
  },
  teachers: {
    "ad soyad": "fullName", "öğretmen adı": "fullName", "öğretmen": "fullName", "isim": "fullName",
    "telefon": "phone",
    "e-posta": "email", "email": "email",
    "durum": "status", "aktif/pasif": "status",
  },
  sessions: {
    "öğrenci adı": "studentName", "öğrenci": "studentName",
    "öğretmen adı": "teacherName", "öğretmen": "teacherName",
    "eğitim türü": "educationType", "eğitim": "educationType",
    "tarih": "date", "seans tarihi": "date",
    "saat": "time",
    "adet": "sessionCount", "seans sayısı": "sessionCount",
    "fiyat": "studentPrice", "fiyat (₺)": "studentPrice", "öğrenci birim fiyatı": "studentPrice", "ücret": "studentPrice",
    "hakediş": "teacherEarning", "hakediş (₺)": "teacherEarning", "öğretmen hakedişi": "teacherEarning",
    "durum": "status",
    "notlar": "notes", "not": "notes",
  },
  payments: {
    "öğrenci": "studentName", "öğrenci adı": "studentName",
    "tutar": "amount", "tutar (₺)": "amount", "miktar": "amount",
    "tarih": "date", "ödeme tarihi": "date",
    "ödeme şekli": "method", "ödeme yöntemi": "method", "yöntem": "method",
    "notlar": "notes", "açıklama": "notes",
  },
  teacherPayments: {
    "öğretmen adı": "teacherName", "öğretmen": "teacherName",
    "tutar": "amount", "tutar (₺)": "amount", "hakediş (₺)": "amount",
    "tarih": "date", "ödeme tarihi": "date",
    "ödeme türü": "paymentType", "tür": "paymentType",
    "ödeme yöntemi": "method", "yöntem": "method",
    "açıklama": "description", "notlar": "description",
  },
  openingBalances: {
    "öğrenci": "studentName", "öğrenci adı": "studentName",
    "veli": "guardianName", "veli adı": "guardianName",
    "tutar": "amount", "bakiye": "amount",
    "borç/alacak": "balanceType", "borç / alacak": "balanceType", "tür": "balanceType",
    "tarih": "date",
    "not": "note", "açıklama": "note",
  },
};

export function suggestColumnMappings(sheet: ParsedSheet, type: ImportEntityType): ImportColumnMapping[] {
  const aliases = HEADER_ALIASES[type];
  return sheet.headers.map((header, i) => {
    const normalized = header.trim().toLocaleLowerCase("tr-TR");
    const sample = sheet.rows.find((r) => cellToDisplayString(r[i]) !== "");
    return {
      excelColumn: header || `Sütun ${i + 1}`,
      systemField: aliases[normalized] ?? null,
      sampleData: sample ? cellToDisplayString(sample[i]) : "",
    };
  });
}

// ─── Value alias resolvers ───────────────────────────────────────────────────────

const STATUS_ALIASES: Record<string, SessionStatus> = {
  "tamamlandı": "completed", "tamamlandi": "completed", "completed": "completed", "yapıldı": "completed", "done": "completed",
  "planlandı": "planned", "planlandi": "planned", "planned": "planned", "bekliyor": "planned", "scheduled": "planned",
  "iptal": "cancelled", "i̇ptal": "cancelled", "cancelled": "cancelled", "canceled": "cancelled", "iptal edildi": "cancelled",
  "gelmedi": "no_show", "no_show": "no_show", "no-show": "no_show", "noshow": "no_show", "katılmadı": "no_show",
  "telafi": "makeup", "makeup": "makeup", "make-up": "makeup", "make up": "makeup",
};

export function resolveSessionStatusValue(raw: string): { status: SessionStatus; recognized: boolean } {
  const key = raw.trim().toLocaleLowerCase("tr-TR");
  const status = STATUS_ALIASES[key];
  return status ? { status, recognized: true } : { status: "planned", recognized: false };
}

const METHOD_ALIASES: Record<string, PaymentMethod> = {
  "nakit": "cash", "cash": "cash",
  "havale": "bank_transfer", "eft": "bank_transfer", "eft/havale": "bank_transfer", "eft / havale": "bank_transfer",
  "banka havalesi": "bank_transfer", "banka": "bank_transfer", "bank_transfer": "bank_transfer",
  "kredi kartı": "credit_card", "kredi karti": "credit_card", "kart": "credit_card", "credit_card": "credit_card",
  "diğer": "other", "diger": "other", "other": "other",
};

export function resolvePaymentMethodValue(raw: string): { method: PaymentMethod; recognized: boolean } {
  if (!raw.trim()) return { method: "cash", recognized: true }; // no method column mapped — cash is a reasonable default, not a warning
  const key = raw.trim().toLocaleLowerCase("tr-TR");
  const method = METHOD_ALIASES[key];
  return method ? { method, recognized: true } : { method: "other", recognized: false };
}

const TEACHER_PAYMENT_TYPE_ALIASES: Record<string, TeacherPaymentType> = {
  "maaş": "salary", "maas": "salary", "salary": "salary",
  "avans": "advance", "advance": "advance",
  "ara ödeme": "partial", "ara odeme": "partial", "partial": "partial",
  "prim": "bonus", "bonus": "bonus",
  "kesinti": "deduction", "deduction": "deduction",
  "diğer": "other", "diger": "other", "other": "other",
};

export function resolveTeacherPaymentTypeValue(raw: string): { type: TeacherPaymentType; recognized: boolean } {
  if (!raw.trim()) return { type: "salary", recognized: true };
  const key = raw.trim().toLocaleLowerCase("tr-TR");
  const type = TEACHER_PAYMENT_TYPE_ALIASES[key];
  return type ? { type, recognized: true } : { type: "other", recognized: false };
}

const BALANCE_TYPE_ALIASES: Record<string, OpeningBalanceType> = {
  "borç": "debt", "borc": "debt", "debt": "debt", "alacaklı": "debt",
  "alacak": "credit", "credit": "credit", "kredi": "credit",
};

export function resolveOpeningBalanceTypeValue(raw: string): { type: OpeningBalanceType; recognized: boolean } {
  const key = raw.trim().toLocaleLowerCase("tr-TR");
  const type = BALANCE_TYPE_ALIASES[key];
  return type ? { type, recognized: true } : { type: "debt", recognized: false };
}

// ─── Staged records (resolved, not-yet-committed rows) ──────────────────────────

export type StagedRecord =
  | { kind: "students"; record: Student }
  | { kind: "guardians"; record: Guardian }
  | { kind: "teachers"; record: Teacher }
  | { kind: "sessions"; record: Session }
  | { kind: "payments"; record: Payment }
  | { kind: "teacherPayments"; record: TeacherPayment }
  | { kind: "openingBalances"; record: OpeningBalance };

export interface StagedRow {
  preview: ImportPreviewRow;
  staged: StagedRecord[];
}

function col(mapping: ImportColumnMapping[], key: string): number {
  return mapping.findIndex((m) => m.systemField === key);
}

function cellAt(row: (string | number | boolean | Date | null | undefined)[], index: number): string {
  return index >= 0 ? cellToDisplayString(row[index]) : "";
}

export function newId(prefix: string, rowNumber: number): string {
  return `${prefix}-import-${Date.now()}-${rowNumber}-${Math.random().toString(36).slice(2, 6)}`;
}

// ─── Students ────────────────────────────────────────────────────────────────────

export function buildStagedStudentRows(
  sheet: ParsedSheet,
  mapping: ImportColumnMapping[],
  existingStudents: Student[],
  existingGuardians: Guardian[],
  /** False when "Veliler" isn't among the selected import types this run — a
   *  guardian name that doesn't match an existing guardian is then left blank
   *  (warning, not error) instead of fabricating a new Guardian record. */
  allowGuardianAutoCreate: boolean = true
): StagedRow[] {
  const iName = col(mapping, "fullName");
  const iBirth = col(mapping, "birthDate");
  const iStatus = col(mapping, "status");
  const iWeekly = col(mapping, "weeklySessionCount");
  const iGuardianName = col(mapping, "guardianName");
  const iGuardianPhone = col(mapping, "guardianPhone");
  const iNotes = col(mapping, "notes");

  const studentIndex = buildStudentIndex(existingStudents);
  const guardianIndex = buildGuardianIndex(existingGuardians);
  const rows: StagedRow[] = [];

  sheet.rows.forEach((raw, idx) => {
    const rowNumber = idx + 2;
    const fullName = cellAt(raw, iName);
    const guardianPhone = cellAt(raw, iGuardianPhone);
    const guardianName = cellAt(raw, iGuardianName);

    if (!fullName) {
      rows.push({
        preview: { rowNumber, displayText: "(Ad boş)", status: "error", issues: ["'Öğrenci Adı Soyadı' zorunlu alan boş bırakılamaz"], entityMatches: [], include: false },
        staged: [],
      });
      return;
    }

    const match = matchStudent(fullName, guardianPhone, studentIndex, guardianIndex);
    const matches: ImportEntityMatch[] = [{ entityType: "Öğrenci", value: fullName, matched: match.tier !== "new" }];

    if (match.tier === "matched") {
      rows.push({
        preview: { rowNumber, displayText: `${fullName}`, status: "duplicate", issues: ["Bu öğrenci sistemde zaten kayıtlı"], entityMatches: matches, include: false },
        staged: [],
      });
      return;
    }

    const issues: string[] = [];
    if (match.tier === "possible") {
      issues.push("Bu isimde bir öğrenci zaten sistemde kayıtlı; farklı kişi olarak içe aktarılacak");
    }

    const staged: StagedRecord[] = [];
    let guardianId: string | undefined;

    if (guardianName) {
      const gMatch = matchGuardian(guardianName, guardianPhone, guardianIndex);
      if (gMatch.guardian) {
        guardianId = gMatch.guardian.id;
        matches.push({ entityType: "Veli", value: guardianName, matched: true });
      } else if (allowGuardianAutoCreate) {
        const guardian: Guardian = {
          id: newId("guardian", rowNumber),
          tenantId: "tenant-1",
          fullName: guardianName,
          phone: guardianPhone || "—",
          relationship: "Veli",
          studentIds: [],
          createdAt: new Date().toISOString(),
        };
        addGuardianToIndex(guardianIndex, guardian);
        staged.push({ kind: "guardians", record: guardian });
        guardianId = guardian.id;
        matches.push({ entityType: "Veli", value: guardianName, matched: false });
      } else {
        matches.push({ entityType: "Veli", value: guardianName, matched: false });
        issues.push(`'${guardianName}' adlı veli sistemde bulunamadı; veli boş bırakılacak`);
      }
    }

    // birthDate isn't required — a genuinely blank cell is fine — but a cell that HAS
    // a value that fails to parse (bad Excel serial, malformed string, impossible
    // calendar date) must never be silently dropped to "": that leaves the record
    // looking blank while the user never learns their date was rejected, and an
    // invalid string could still slip through to formatDate elsewhere. Warn and
    // leave it empty instead.
    const birthDateRaw = iBirth >= 0 ? cellAt(raw, iBirth) : "";
    const birthDateParsed = iBirth >= 0 ? parseCellAsDateString(raw[iBirth]) : null;
    if (iBirth >= 0 && birthDateRaw && !birthDateParsed) {
      issues.push(`Geçersiz doğum tarihi: '${birthDateRaw}' → boş bırakılacak`);
    }
    const birthDate = birthDateParsed ?? "";
    const statusRaw = cellAt(raw, iStatus).toLocaleLowerCase("tr-TR");
    const status = statusRaw.includes("pasif") || statusRaw === "inactive" ? "inactive"
      : statusRaw.includes("bekle") || statusRaw === "on_hold" ? "on_hold"
      : "active";
    const weeklyCount = iWeekly >= 0 ? parseCellAsNumber(raw[iWeekly]) ?? undefined : undefined;
    const notes = cellAt(raw, iNotes) || undefined;

    const student: Student = {
      id: newId("student", rowNumber),
      tenantId: "tenant-1",
      fullName,
      birthDate,
      status,
      guardianIds: guardianId ? [guardianId] : [],
      educationTypeIds: [],
      weeklySessionCount: weeklyCount,
      notes,
      createdAt: new Date().toISOString(),
    };
    addStudentToIndex(studentIndex, student);
    staged.push({ kind: "students", record: student });

    rows.push({
      preview: {
        rowNumber,
        displayText: guardianName ? `${fullName} — ${guardianName}` : fullName,
        status: issues.length > 0 ? "warning" : "valid",
        issues,
        entityMatches: matches,
        include: true,
      },
      staged,
    });
  });

  return rows;
}

// ─── Guardians (standalone) ──────────────────────────────────────────────────────

export function buildStagedGuardianRows(sheet: ParsedSheet, mapping: ImportColumnMapping[], existingGuardians: Guardian[]): StagedRow[] {
  const iName = col(mapping, "fullName");
  const iPhone = col(mapping, "phone");
  const iEmail = col(mapping, "email");
  const iRelationship = col(mapping, "relationship");
  const iAddress = col(mapping, "address");

  const guardianIndex = buildGuardianIndex(existingGuardians);
  const rows: StagedRow[] = [];

  sheet.rows.forEach((raw, idx) => {
    const rowNumber = idx + 2;
    const fullName = cellAt(raw, iName);
    const phone = cellAt(raw, iPhone);

    if (!fullName) {
      rows.push({ preview: { rowNumber, displayText: "(Ad boş)", status: "error", issues: ["'Veli Adı Soyadı' zorunlu alan boş bırakılamaz"], entityMatches: [], include: false }, staged: [] });
      return;
    }
    if (!phone) {
      rows.push({ preview: { rowNumber, displayText: fullName, status: "error", issues: ["'Telefon' zorunlu alan boş bırakılamaz"], entityMatches: [], include: false }, staged: [] });
      return;
    }

    const match = matchGuardian(fullName, phone, guardianIndex);
    const matches: ImportEntityMatch[] = [{ entityType: "Veli", value: fullName, matched: match.tier !== "new" }];

    if (match.tier === "matched") {
      rows.push({ preview: { rowNumber, displayText: fullName, status: "duplicate", issues: ["Bu veli sistemde zaten kayıtlı"], entityMatches: matches, include: false }, staged: [] });
      return;
    }

    const issues: string[] = [];
    if (match.tier === "possible") issues.push("Bu isimde bir veli zaten sistemde kayıtlı; farklı kişi olarak içe aktarılacak");

    const guardian: Guardian = {
      id: newId("guardian", rowNumber),
      tenantId: "tenant-1",
      fullName,
      phone,
      email: cellAt(raw, iEmail) || undefined,
      relationship: cellAt(raw, iRelationship) || "Veli",
      studentIds: [],
      address: cellAt(raw, iAddress) || undefined,
      createdAt: new Date().toISOString(),
    };
    addGuardianToIndex(guardianIndex, guardian);

    rows.push({
      preview: { rowNumber, displayText: fullName, status: issues.length > 0 ? "warning" : "valid", issues, entityMatches: matches, include: true },
      staged: [{ kind: "guardians", record: guardian }],
    });
  });

  return rows;
}

// ─── Teachers ────────────────────────────────────────────────────────────────────

export function buildStagedTeacherRows(sheet: ParsedSheet, mapping: ImportColumnMapping[], existingTeachers: Teacher[]): StagedRow[] {
  const iName = col(mapping, "fullName");
  const iPhone = col(mapping, "phone");
  const iEmail = col(mapping, "email");
  const iStatus = col(mapping, "status");

  const teacherIndex = buildTeacherIndex(existingTeachers);
  const rows: StagedRow[] = [];

  sheet.rows.forEach((raw, idx) => {
    const rowNumber = idx + 2;
    const fullName = cellAt(raw, iName);
    const phone = cellAt(raw, iPhone);

    if (!fullName) {
      rows.push({ preview: { rowNumber, displayText: "(Ad boş)", status: "error", issues: ["'Öğretmen Adı Soyadı' zorunlu alan boş bırakılamaz"], entityMatches: [], include: false }, staged: [] });
      return;
    }

    const match = matchTeacher(fullName, phone, teacherIndex);
    const matches: ImportEntityMatch[] = [{ entityType: "Öğretmen", value: fullName, matched: match.tier !== "new" }];

    if (match.tier === "matched") {
      rows.push({ preview: { rowNumber, displayText: fullName, status: "duplicate", issues: ["Bu öğretmen sistemde zaten kayıtlı"], entityMatches: matches, include: false }, staged: [] });
      return;
    }

    const issues: string[] = [];
    if (match.tier === "possible") issues.push("Bu isimde bir öğretmen zaten sistemde kayıtlı; farklı kişi olarak içe aktarılacak");

    const statusRaw = cellAt(raw, iStatus).toLocaleLowerCase("tr-TR");
    const status = statusRaw.includes("pasif") || statusRaw === "inactive" ? "inactive" : "active";

    const teacher: Teacher = {
      id: newId("teacher", rowNumber),
      tenantId: "tenant-1",
      fullName,
      phone: phone || "—",
      email: cellAt(raw, iEmail) || undefined,
      status,
      createdAt: new Date().toISOString(),
    };
    addTeacherToIndex(teacherIndex, teacher);

    rows.push({
      preview: { rowNumber, displayText: fullName, status: issues.length > 0 ? "warning" : "valid", issues, entityMatches: matches, include: true },
      staged: [{ kind: "teachers", record: teacher }],
    });
  });

  return rows;
}

// ─── Sessions ────────────────────────────────────────────────────────────────────

export function buildStagedSessionRows(
  sheet: ParsedSheet,
  mapping: ImportColumnMapping[],
  mode: ImportMode,
  existingSessions: Session[],
  students: Student[],
  teachers: Teacher[],
  educationTypes: EducationType[],
  teacherEducationTypeAssignments: TeacherEducationTypeAssignment[] = []
): StagedRow[] {
  const iStudent = col(mapping, "studentName");
  const iTeacher = col(mapping, "teacherName");
  const iEduType = col(mapping, "educationType");
  const iDate = col(mapping, "date");
  const iTime = col(mapping, "time");
  const iCount = col(mapping, "sessionCount");
  const iPrice = col(mapping, "studentPrice");
  const iEarning = col(mapping, "teacherEarning");
  const iStatus = col(mapping, "status");
  const iNotes = col(mapping, "notes");

  // Sessions staged within this same batch — checked for conflicts/duplicates too,
  // so two rows in the same file can't double-book each other either. Students/
  // teachers never change while staging Sessions, so those indexes are built once;
  // the session indexes grow by one per created row, updated in O(1) each time.
  const studentIndex = buildStudentIndex(students);
  const teacherIndex = buildTeacherIndex(teachers);
  const sessionDuplicateIndex = buildSessionDuplicateIndex(existingSessions);
  const sessionConflictIndex = buildSessionConflictIndex(existingSessions);
  const rows: StagedRow[] = [];

  sheet.rows.forEach((raw, idx) => {
    const rowNumber = idx + 2;
    const studentName = cellAt(raw, iStudent);
    const teacherName = cellAt(raw, iTeacher);
    const eduTypeName = cellAt(raw, iEduType);
    const dateStr = parseCellAsDateString(iDate >= 0 ? raw[iDate] : null);
    const timeStr = parseCellAsTimeString(iTime >= 0 ? raw[iTime] : null) ?? "09:00";
    const priceRaw = iPrice >= 0 ? parseCellAsNumber(raw[iPrice]) : null;

    const displayText = `${studentName || "?"} / ${teacherName || "?"} / ${dateStr ?? cellAt(raw, iDate)}`;
    const errors: string[] = [];

    if (!studentName) errors.push("'Öğrenci' zorunlu alan boş bırakılamaz");
    if (!teacherName) errors.push("'Öğretmen' zorunlu alan boş bırakılamaz");
    if (!eduTypeName) errors.push("'Eğitim Türü' zorunlu alan boş bırakılamaz");
    if (!dateStr) errors.push(`Geçersiz veya eksik tarih: '${cellAt(raw, iDate)}'`);
    if (priceRaw === null) errors.push("'Öğrenci Birim Fiyatı' zorunlu alan boş veya geçersiz");

    const studentRes = studentName ? resolveStudentByName(studentName, studentIndex) : null;
    const teacherRes = teacherName ? resolveTeacherByName(teacherName, teacherIndex) : null;
    const eduType = eduTypeName
      ? educationTypes.find((et) => normalizeName(et.name) === normalizeName(eduTypeName)) ?? null
      : null;

    if (studentRes && !studentRes.student) errors.push(`'${studentName}' adlı öğrenci sistemde bulunamadı`);
    if (teacherRes && !teacherRes.teacher) errors.push(`'${teacherName}' adlı öğretmen sistemde bulunamadı`);
    if (eduTypeName && !eduType) errors.push(`'${eduTypeName}' eğitim türü sistemde bulunamadı`);

    const matches: ImportEntityMatch[] = [
      ...(studentName ? [{ entityType: "Öğrenci" as const, value: studentName, matched: !!studentRes?.student }] : []),
      ...(teacherName ? [{ entityType: "Öğretmen" as const, value: teacherName, matched: !!teacherRes?.teacher }] : []),
      ...(eduTypeName ? [{ entityType: "Eğitim Türü" as const, value: eduTypeName, matched: !!eduType }] : []),
    ];

    if (errors.length > 0) {
      rows.push({
        preview: {
          rowNumber,
          displayText,
          status: "error",
          issues: errors,
          entityMatches: matches,
          include: false,
          repairHints: { fee: priceRaw ?? undefined, time: timeStr },
        },
        staged: [],
      });
      return;
    }

    const issues: string[] = [];
    if (studentRes!.ambiguous) issues.push(`'${studentName}' adında birden fazla öğrenci bulundu; ilk eşleşme kullanılacak`);
    if (teacherRes!.ambiguous) issues.push(`'${teacherName}' adında birden fazla öğretmen bulundu; ilk eşleşme kullanılacak`);

    const studentId = studentRes!.student!.id;
    const teacherId = teacherRes!.teacher!.id;
    const educationTypeId = eduType!.id;

    // Teacher and education type both resolved to real records, but there's no
    // active assignment linking them — a different problem from a missing price
    // (section 13: never silently create an arbitrary earning for an
    // unassigned pair). Operational imports need repair before committing;
    // historical imports may proceed but only as an explicitly unresolved row.
    const assignmentIncompatible = !isTeacherAssignedToEducationType(
      teacherId,
      educationTypeId,
      teacherEducationTypeAssignments
    );
    if (assignmentIncompatible) {
      issues.push(
        `'${teacherRes!.teacher!.fullName}' adlı öğretmen '${eduType!.name}' eğitim türünü vermek üzere tanımlanmamış`
      );
    }
    const startsAt = `${dateStr}T${timeStr}:00`;
    const sessionCount = iCount >= 0 ? Math.max(1, parseCellAsNumber(raw[iCount]) ?? 1) : 1;
    const studentPrice = priceRaw!;
    const teacherEarningRaw = iEarning >= 0 ? parseCellAsNumber(raw[iEarning]) : null;
    const { status, recognized } = iStatus >= 0 ? resolveSessionStatusValue(cellAt(raw, iStatus)) : { status: "planned" as SessionStatus, recognized: true };

    if (iStatus >= 0 && !recognized) {
      issues.push(`Bilinmeyen durum değeri: '${cellAt(raw, iStatus)}' → Planlandı olarak içe aktarılacak`);
    }

    // Exact duplicate (already exists — same student+teacher+educationType+instant).
    const duplicate = findDuplicateSession(studentId, teacherId, educationTypeId, startsAt, sessionDuplicateIndex);
    if (duplicate) {
      rows.push({ preview: { rowNumber, displayText, status: "duplicate", issues: ["Bu seans zaten mevcut"], entityMatches: matches, include: false }, staged: [] });
      return;
    }

    // Overlap conflict — never bypassed. Historical migrations often carry legitimate
    // overlaps the source system never enforced, so those default to included (still
    // visible, still requires the Step-3 confirm); operational entries default excluded,
    // matching the same hard-block posture new sessions get everywhere else.
    const conflict = checkSessionConflictIndexed(sessionConflictIndex, {
      studentId,
      teacherId,
      startsAt,
      durationMinutes: 40,
    });
    let includeByDefault = true;
    if (conflict.hasConflict) {
      issues.push(conflict.message ?? "Bu öğrenci veya öğretmen aynı saatte başka bir seansa kayıtlı");
      includeByDefault = mode === "historical";
    }
    if (assignmentIncompatible && mode === "operational") {
      includeByDefault = false;
    }

    // Excel "Öğretmen Hakedişi" column (if mapped) always wins when present — only
    // when the file is silent on it AND the teacher has no configured earning
    // model/price does the value become an unreliable 0-fallback (never shown as
    // a real hakediş in the financial preview; see teacherEarningUnknown below).
    // An incompatible teacher/education-type pair always forces this, even if the
    // sheet supplied an explicit hakediş value — that value can't be trusted for
    // a pairing the teacher was never actually assigned to.
    const calculatedTeacherEarning = assignmentIncompatible
      ? null
      : calculateTeacherSessionEarning(teacherRes!.teacher!, educationTypeId, studentPrice, teacherEducationTypeAssignments);
    const teacherEarningUnknown =
      assignmentIncompatible || (teacherEarningRaw === null && calculatedTeacherEarning === null);
    const teacherEarning = assignmentIncompatible ? 0 : teacherEarningRaw ?? calculatedTeacherEarning ?? 0;

    const session: Session = {
      id: newId("session", rowNumber),
      tenantId: "tenant-1",
      studentId,
      teacherId,
      educationTypeId,
      date: startsAt,
      durationMinutes: 40,
      sessionCount,
      studentPrice,
      teacherEarning,
      status,
      notes: cellAt(raw, iNotes) || undefined,
      createdAt: new Date().toISOString(),
      teacherEarningStatus: teacherEarningUnknown ? "unknown" : "calculated",
    };
    addSessionToDuplicateIndex(sessionDuplicateIndex, session);
    addSessionToConflictIndex(sessionConflictIndex, session);

    rows.push({
      preview: {
        rowNumber,
        displayText,
        status: issues.length > 0 ? "warning" : "valid",
        issues,
        entityMatches: matches,
        include: includeByDefault,
        teacherEarningUnknown,
        teacherAssignmentIncompatible: assignmentIncompatible,
      },
      staged: [{ kind: "sessions", record: session }],
    });
  });

  return rows;
}

// ─── Payments ────────────────────────────────────────────────────────────────────

export function buildStagedPaymentRows(
  sheet: ParsedSheet,
  mapping: ImportColumnMapping[],
  existingPayments: Payment[],
  students: Student[]
): StagedRow[] {
  const iStudent = col(mapping, "studentName");
  const iAmount = col(mapping, "amount");
  const iDate = col(mapping, "date");
  const iMethod = col(mapping, "method");
  const iNotes = col(mapping, "notes");

  const studentIndex = buildStudentIndex(students);
  const paymentDuplicateIndex = buildPaymentDuplicateIndex(existingPayments);
  const rows: StagedRow[] = [];

  sheet.rows.forEach((raw, idx) => {
    const rowNumber = idx + 2;
    const studentName = cellAt(raw, iStudent);
    const amount = iAmount >= 0 ? parseCellAsNumber(raw[iAmount]) : null;
    const dateStr = parseCellAsDateString(iDate >= 0 ? raw[iDate] : null);
    const displayText = `${studentName || "?"} — ${amount ?? "?"}`;

    const errors: string[] = [];
    if (!studentName) errors.push("'Öğrenci' zorunlu alan boş bırakılamaz");
    if (amount === null || amount <= 0) errors.push("'Tutar' zorunlu alan boş veya geçersiz");
    if (!dateStr) errors.push(`Geçersiz veya eksik tarih: '${cellAt(raw, iDate)}'`);

    const studentRes = studentName ? resolveStudentByName(studentName, studentIndex) : null;
    if (studentRes && !studentRes.student) errors.push(`'${studentName}' adlı öğrenci sistemde bulunamadı`);

    const matches: ImportEntityMatch[] = studentName
      ? [{ entityType: "Öğrenci", value: studentName, matched: !!studentRes?.student }]
      : [];

    if (errors.length > 0) {
      rows.push({ preview: { rowNumber, displayText, status: "error", issues: errors, entityMatches: matches, include: false }, staged: [] });
      return;
    }

    const ambiguityIssue = studentRes!.ambiguous ? [`'${studentName}' adında birden fazla öğrenci bulundu; ilk eşleşme kullanılacak`] : [];

    const studentId = studentRes!.student!.id;
    const duplicate = findDuplicatePayment(studentId, dateStr!, amount!, paymentDuplicateIndex);
    if (duplicate) {
      rows.push({ preview: { rowNumber, displayText, status: "duplicate", issues: ["Bu ödeme zaten mevcut"], entityMatches: matches, include: false }, staged: [] });
      return;
    }

    const { method, recognized } = resolvePaymentMethodValue(cellAt(raw, iMethod));
    const issues: string[] = [...ambiguityIssue];
    if (iMethod >= 0 && !recognized) {
      issues.push(`Bilinmeyen ödeme yöntemi: '${cellAt(raw, iMethod)}' → Diğer olarak içe aktarılacak`);
    }

    const payment: Payment = {
      id: newId("payment", rowNumber),
      tenantId: "tenant-1",
      studentId,
      amount: amount!,
      method,
      date: dateStr!,
      paymentSource: "import",
      notes: cellAt(raw, iNotes) || undefined,
      createdAt: new Date().toISOString(),
    };
    addPaymentToDuplicateIndex(paymentDuplicateIndex, payment);

    rows.push({
      preview: { rowNumber, displayText, status: issues.length > 0 ? "warning" : "valid", issues, entityMatches: matches, include: true },
      staged: [{ kind: "payments", record: payment }],
    });
  });

  return rows;
}

// ─── Teacher Payments ────────────────────────────────────────────────────────────

export function buildStagedTeacherPaymentRows(
  sheet: ParsedSheet,
  mapping: ImportColumnMapping[],
  existingTeacherPayments: TeacherPayment[],
  teachers: Teacher[]
): StagedRow[] {
  const iTeacher = col(mapping, "teacherName");
  const iAmount = col(mapping, "amount");
  const iDate = col(mapping, "date");
  const iType = col(mapping, "paymentType");
  const iMethod = col(mapping, "method");
  const iDesc = col(mapping, "description");

  const teacherIndex = buildTeacherIndex(teachers);
  const teacherPaymentDuplicateIndex = buildTeacherPaymentDuplicateIndex(existingTeacherPayments);
  const rows: StagedRow[] = [];

  sheet.rows.forEach((raw, idx) => {
    const rowNumber = idx + 2;
    const teacherName = cellAt(raw, iTeacher);
    const amount = iAmount >= 0 ? parseCellAsNumber(raw[iAmount]) : null;
    const dateStr = parseCellAsDateString(iDate >= 0 ? raw[iDate] : null);
    const displayText = `${teacherName || "?"} — ${amount ?? "?"}`;

    const errors: string[] = [];
    if (!teacherName) errors.push("'Öğretmen' zorunlu alan boş bırakılamaz");
    if (amount === null || amount <= 0) errors.push("'Tutar' zorunlu alan boş veya geçersiz");
    if (!dateStr) errors.push(`Geçersiz veya eksik tarih: '${cellAt(raw, iDate)}'`);

    const teacherRes = teacherName ? resolveTeacherByName(teacherName, teacherIndex) : null;
    if (teacherRes && !teacherRes.teacher) errors.push(`'${teacherName}' adlı öğretmen sistemde bulunamadı`);

    const matches: ImportEntityMatch[] = teacherName
      ? [{ entityType: "Öğretmen", value: teacherName, matched: !!teacherRes?.teacher }]
      : [];

    if (errors.length > 0) {
      rows.push({ preview: { rowNumber, displayText, status: "error", issues: errors, entityMatches: matches, include: false }, staged: [] });
      return;
    }

    const ambiguityIssue = teacherRes!.ambiguous ? [`'${teacherName}' adında birden fazla öğretmen bulundu; ilk eşleşme kullanılacak`] : [];

    const teacherId = teacherRes!.teacher!.id;
    const duplicate = findDuplicateTeacherPayment(teacherId, dateStr!, amount!, teacherPaymentDuplicateIndex);
    if (duplicate) {
      rows.push({ preview: { rowNumber, displayText, status: "duplicate", issues: ["Bu öğretmen ödemesi zaten mevcut"], entityMatches: matches, include: false }, staged: [] });
      return;
    }

    const { type: paymentType, recognized: typeRecognized } = resolveTeacherPaymentTypeValue(cellAt(raw, iType));
    const { method, recognized: methodRecognized } = resolvePaymentMethodValue(cellAt(raw, iMethod));
    const issues: string[] = [...ambiguityIssue];
    if (iType >= 0 && !typeRecognized) issues.push(`Bilinmeyen ödeme türü: '${cellAt(raw, iType)}' → Diğer olarak içe aktarılacak`);
    if (iMethod >= 0 && !methodRecognized && !isDeductionPaymentType(paymentType)) {
      issues.push(`Bilinmeyen ödeme yöntemi: '${cellAt(raw, iMethod)}' → Diğer olarak içe aktarılacak`);
    }

    const teacherPayment: TeacherPayment = {
      id: newId("tpayment", rowNumber),
      tenantId: "tenant-1",
      teacherId,
      amount: amount!,
      method,
      paymentType,
      date: dateStr!,
      description: cellAt(raw, iDesc) || undefined,
      createdAt: new Date().toISOString(),
    };
    addTeacherPaymentToDuplicateIndex(teacherPaymentDuplicateIndex, teacherPayment);

    rows.push({
      preview: { rowNumber, displayText, status: issues.length > 0 ? "warning" : "valid", issues, entityMatches: matches, include: true },
      staged: [{ kind: "teacherPayments", record: teacherPayment }],
    });
  });

  return rows;
}

// ─── Opening Balances ────────────────────────────────────────────────────────────

export function buildStagedOpeningBalanceRows(
  sheet: ParsedSheet,
  mapping: ImportColumnMapping[],
  existingOpeningBalances: OpeningBalance[],
  students: Student[],
  guardians: Guardian[]
): StagedRow[] {
  const iStudent = col(mapping, "studentName");
  const iGuardian = col(mapping, "guardianName");
  const iAmount = col(mapping, "amount");
  const iType = col(mapping, "balanceType");
  const iDate = col(mapping, "date");
  const iNote = col(mapping, "note");

  const studentIndex = buildStudentIndex(students);
  const guardianIndex = buildGuardianIndex(guardians);
  const openingBalanceDuplicateIndex = buildOpeningBalanceDuplicateIndex(existingOpeningBalances);
  const rows: StagedRow[] = [];

  sheet.rows.forEach((raw, idx) => {
    const rowNumber = idx + 2;
    const studentName = cellAt(raw, iStudent);
    const amount = iAmount >= 0 ? parseCellAsNumber(raw[iAmount]) : null;
    const dateStr = parseCellAsDateString(iDate >= 0 ? raw[iDate] : null);
    const displayText = `${studentName || "?"} — ${amount ?? "?"}`;

    const errors: string[] = [];
    if (!studentName) errors.push("'Öğrenci' zorunlu alan boş bırakılamaz");
    if (amount === null || amount <= 0) errors.push("'Tutar' zorunlu alan boş veya geçersiz");
    if (!dateStr) errors.push(`Geçersiz veya eksik tarih: '${cellAt(raw, iDate)}'`);

    const studentRes = studentName ? resolveStudentByName(studentName, studentIndex) : null;
    if (studentRes && !studentRes.student) errors.push(`'${studentName}' adlı öğrenci sistemde bulunamadı`);

    const matches: ImportEntityMatch[] = studentName
      ? [{ entityType: "Öğrenci", value: studentName, matched: !!studentRes?.student }]
      : [];

    if (errors.length > 0) {
      rows.push({ preview: { rowNumber, displayText, status: "error", issues: errors, entityMatches: matches, include: false }, staged: [] });
      return;
    }

    const studentId = studentRes!.student!.id;
    const { type: balanceType, recognized } = resolveOpeningBalanceTypeValue(cellAt(raw, iType));

    const duplicate = findDuplicateOpeningBalance(studentId, dateStr!, balanceType, openingBalanceDuplicateIndex);
    if (duplicate) {
      rows.push({ preview: { rowNumber, displayText, status: "duplicate", issues: ["Bu devir bakiyesi zaten mevcut"], entityMatches: matches, include: false }, staged: [] });
      return;
    }

    const issues: string[] = [];
    if (studentRes!.ambiguous) issues.push(`'${studentName}' adında birden fazla öğrenci bulundu; ilk eşleşme kullanılacak`);
    if (!recognized) issues.push(`Bilinmeyen borç/alacak değeri: '${cellAt(raw, iType)}' → Borç olarak içe aktarılacak`);
    if (studentHasOpeningBalance(studentId, openingBalanceDuplicateIndex)) issues.push("Bu öğrencinin zaten bir devir bakiyesi var");

    const guardianName = cellAt(raw, iGuardian);
    const guardianMatch = guardianName ? matchGuardian(guardianName, undefined, guardianIndex) : null;

    const balance: OpeningBalance = {
      id: newId("obal", rowNumber),
      tenantId: "tenant-1",
      studentId,
      guardianId: guardianMatch?.guardian?.id,
      amount: amount!,
      balanceType,
      date: dateStr!,
      note: cellAt(raw, iNote) || undefined,
      createdAt: new Date().toISOString(),
    };
    addOpeningBalanceToDuplicateIndex(openingBalanceDuplicateIndex, balance);

    rows.push({
      preview: { rowNumber, displayText, status: issues.length > 0 ? "warning" : "valid", issues, entityMatches: matches, include: true },
      staged: [{ kind: "openingBalances", record: balance }],
    });
  });

  return rows;
}

// ─── Dispatcher ──────────────────────────────────────────────────────────────────

export interface ImportStoreSnapshot {
  students: Student[];
  guardians: Guardian[];
  teachers: Teacher[];
  sessions: Session[];
  payments: Payment[];
  teacherPayments: TeacherPayment[];
  openingBalances: OpeningBalance[];
  /** Real per-teacher/per-education-type prices — without these, per_session
   *  teachers can never be told apart from "no price configured yet" (see
   *  calculateTeacherSessionEarning). Optional only so older callers/tests that
   *  don't care about hakediş reliability don't have to supply it. */
  teacherEducationTypeAssignments?: TeacherEducationTypeAssignment[];
}

export function buildStagedRows(
  type: ImportEntityType,
  mode: ImportMode,
  sheet: ParsedSheet,
  mapping: ImportColumnMapping[],
  store: ImportStoreSnapshot,
  educationTypes: EducationType[]
): StagedRow[] {
  switch (type) {
    case "students":
      return buildStagedStudentRows(sheet, mapping, store.students, store.guardians);
    case "guardians":
      return buildStagedGuardianRows(sheet, mapping, store.guardians);
    case "teachers":
      return buildStagedTeacherRows(sheet, mapping, store.teachers);
    case "sessions":
      return buildStagedSessionRows(sheet, mapping, mode, store.sessions, store.students, store.teachers, educationTypes, store.teacherEducationTypeAssignments ?? []);
    case "payments":
      return buildStagedPaymentRows(sheet, mapping, store.payments, store.students);
    case "teacherPayments":
      return buildStagedTeacherPaymentRows(sheet, mapping, store.teacherPayments, store.teachers);
    case "openingBalances":
      return buildStagedOpeningBalanceRows(sheet, mapping, store.openingBalances, store.students, store.guardians);
  }
}

// ─── Multi-select import (dependency-ordered, cross-referencing) ───────────────

export interface MultiImportTaskInput {
  type: ImportEntityType;
  sheet: ParsedSheet;
  mapping: ImportColumnMapping[];
}

export interface MultiImportTaskResult {
  type: ImportEntityType;
  sheet: ParsedSheet;
  rows: StagedRow[];
}

function stageMultiImportTask(
  task: MultiImportTaskInput,
  snapshot: ImportStoreSnapshot,
  mode: ImportMode,
  educationTypes: EducationType[],
  allowGuardianAutoCreate: boolean
): StagedRow[] {
  switch (task.type) {
    case "students":
      return buildStagedStudentRows(task.sheet, task.mapping, snapshot.students, snapshot.guardians, allowGuardianAutoCreate);
    case "guardians":
      return buildStagedGuardianRows(task.sheet, task.mapping, snapshot.guardians);
    case "teachers":
      return buildStagedTeacherRows(task.sheet, task.mapping, snapshot.teachers);
    case "sessions":
      return buildStagedSessionRows(
        task.sheet,
        task.mapping,
        mode,
        snapshot.sessions,
        snapshot.students,
        snapshot.teachers,
        educationTypes,
        snapshot.teacherEducationTypeAssignments ?? []
      );
    case "payments":
      return buildStagedPaymentRows(task.sheet, task.mapping, snapshot.payments, snapshot.students);
    case "teacherPayments":
      return buildStagedTeacherPaymentRows(task.sheet, task.mapping, snapshot.teacherPayments, snapshot.teachers);
    case "openingBalances":
      return buildStagedOpeningBalanceRows(task.sheet, task.mapping, snapshot.openingBalances, snapshot.students, snapshot.guardians);
  }
}

function appendCommittableRecordsToSnapshot(snapshot: ImportStoreSnapshot, rows: StagedRow[]): void {
  for (const row of rows) {
    if (row.preview.status === "error" || row.preview.status === "duplicate") continue;
    for (const staged of row.staged) {
      switch (staged.kind) {
        case "students": snapshot.students.push(staged.record); break;
        case "guardians": snapshot.guardians.push(staged.record); break;
        case "teachers": snapshot.teachers.push(staged.record); break;
        case "sessions": snapshot.sessions.push(staged.record); break;
        case "payments": snapshot.payments.push(staged.record); break;
        case "teacherPayments": snapshot.teacherPayments.push(staged.record); break;
        case "openingBalances": snapshot.openingBalances.push(staged.record); break;
      }
    }
  }
}

/**
 * Stages every selected import task in dependency order ([[IMPORT_DEPENDENCY_ORDER]]),
 * accumulating each task's newly-staged (committable) records into a working snapshot
 * before staging the next task. This is what lets a Student row reference a Guardian
 * that only exists earlier in the SAME upload — no separate guardian import required.
 *
 * When "guardians" isn't one of the selected tasks, student rows never fabricate a new
 * Guardian for an unmatched name — they leave the guardian slot empty with a warning.
 */
export function buildMultiImportPreview(
  tasks: MultiImportTaskInput[],
  mode: ImportMode,
  store: ImportStoreSnapshot,
  educationTypes: EducationType[]
): MultiImportTaskResult[] {
  const orderedTasks = sortByDependencyOrder(tasks, (t) => t.type);
  const allowGuardianAutoCreate = orderedTasks.some((t) => t.type === "guardians");

  const snapshot: ImportStoreSnapshot = {
    students: [...store.students],
    guardians: [...store.guardians],
    teachers: [...store.teachers],
    sessions: [...store.sessions],
    payments: [...store.payments],
    teacherPayments: [...store.teacherPayments],
    openingBalances: [...store.openingBalances],
    teacherEducationTypeAssignments: store.teacherEducationTypeAssignments ? [...store.teacherEducationTypeAssignments] : [],
  };

  const results: MultiImportTaskResult[] = [];
  for (const task of orderedTasks) {
    const rows = stageMultiImportTask(task, snapshot, mode, educationTypes, allowGuardianAutoCreate);
    results.push({ type: task.type, sheet: task.sheet, rows });
    appendCommittableRecordsToSnapshot(snapshot, rows);
  }

  return results;
}

// ─── Summary / financial impact / commit ────────────────────────────────────────

/** `skippedRows` covers rows dropped BEFORE they ever became a StagedRow (TOPLAM/
 *  summary lines, blank rows) — pass the source's own skip counter (e.g.
 *  `StudentLedgerSheetResult.skippedRowCount`); it's additive to `totalRows`, never
 *  double-counted against errors. */
export function buildImportSummary(rows: StagedRow[], skippedRows: number = 0): ImportSummary {
  const totalRows = rows.length + skippedRows;
  const validRows = rows.filter((r) => r.preview.status === "valid").length;
  const warningRows = rows.filter((r) => r.preview.status === "warning").length;
  const errorRows = rows.filter((r) => r.preview.status === "error").length;
  const duplicateRows = rows.filter((r) => r.preview.status === "duplicate").length;
  const toCommitRows = rows.filter(
    (r) => (r.preview.status === "valid" || r.preview.status === "warning") && r.preview.include
  ).length;
  return { totalRows, validRows, warningRows, errorRows, duplicateRows, skippedRows, toCommitRows };
}

export function buildFinancialImpact(rows: StagedRow[]): ImportFinancialImpact {
  const impact: ImportFinancialImpact = {
    sessionsToCreate: 0,
    paymentsToCreate: 0,
    teacherPaymentsToCreate: 0,
    openingBalancesToCreate: 0,
    totalTahakkukImpact: 0,
    totalTahsilatImpact: 0,
    teacherPaymentImpact: 0,
    cashImpact: 0,
    remainingBalanceImpact: 0,
    estimatedTeacherEarningImpact: 0,
    estimatedCenterProfitImpact: 0,
    sessionsWithUnknownTeacherEarning: 0,
    historicalNonBillableSessionsToCreate: 0,
  };

  for (const row of rows) {
    if (!row.preview.include) continue;
    if (row.preview.status !== "valid" && row.preview.status !== "warning") continue;

    for (const staged of row.staged) {
      switch (staged.kind) {
        case "sessions": {
          impact.sessionsToCreate++;
          // A session the user explicitly chose to import as pure history (no
          // debt) must never appear in the revenue/hakediş/profit preview either
          // — those numbers describe what THIS batch will bill, and a
          // historical_non_billable session bills nothing by design.
          if (staged.record.billingMode === "historical_non_billable") {
            impact.historicalNonBillableSessionsToCreate++;
            break;
          }
          impact.totalTahakkukImpact += calculateSessionTotal(staged.record);
          // Revenue/tahakkuk is always known (it's the Excel's own Ders Ücreti/Tutar),
          // but a session whose teacherEarning is an unreliable 0-fallback must never
          // be folded into the hakediş/profit totals as if it were a real number.
          if (row.preview.teacherEarningUnknown) {
            impact.sessionsWithUnknownTeacherEarning++;
          } else {
            impact.estimatedTeacherEarningImpact += calculateSessionTeacherEarning(staged.record);
            impact.estimatedCenterProfitImpact += calculateSessionCenterProfit(staged.record);
          }
          break;
        }
        case "payments": {
          impact.paymentsToCreate++;
          impact.totalTahsilatImpact += staged.record.amount;
          impact.cashImpact += staged.record.amount;
          impact.remainingBalanceImpact -= staged.record.amount;
          break;
        }
        case "teacherPayments": {
          impact.teacherPaymentsToCreate++;
          impact.teacherPaymentImpact += staged.record.amount;
          if (!isDeductionPaymentType(staged.record.paymentType)) {
            impact.cashImpact -= staged.record.amount;
          }
          break;
        }
        case "openingBalances": {
          impact.openingBalancesToCreate++;
          impact.remainingBalanceImpact += staged.record.balanceType === "debt" ? staged.record.amount : -staged.record.amount;
          break;
        }
        default:
          break;
      }
    }
  }

  return impact;
}

/** Per-entity-type count of records this run will actually create — the same
 *  qualifying rule buildFinancialImpact/commitRowsIntoBatch use (included,
 *  non-error, non-duplicate rows), just bucketed by record kind instead of
 *  reduced to a single money/count figure. Powers the "what will be created"
 *  breakdown in the preview and confirmation steps. */
export function buildCreationBreakdown(rows: StagedRow[]): Record<ImportEntityType, number> {
  const counts: Record<ImportEntityType, number> = {
    students: 0,
    guardians: 0,
    teachers: 0,
    sessions: 0,
    payments: 0,
    teacherPayments: 0,
    openingBalances: 0,
  };

  for (const row of rows) {
    if (!row.preview.include) continue;
    if (row.preview.status !== "valid" && row.preview.status !== "warning") continue;
    for (const staged of row.staged) counts[staged.kind]++;
  }

  return counts;
}

interface CommitStore {
  addStudent: (s: Student) => void;
  addGuardian: (g: Guardian) => void;
  addTeacher: (t: Teacher) => void;
  addSession: (s: Session) => void;
  addPayment: (p: Payment) => void;
  addTeacherPayment: (p: TeacherPayment) => void;
  addOpeningBalance: (b: OpeningBalance) => void;
  addImportBatch: (batch: ImportBatch) => void;
}

function emptyImportBatchEntityIds(): ImportBatchEntityIds {
  return {
    students: [],
    guardians: [],
    teachers: [],
    sessions: [],
    payments: [],
    teacherPayments: [],
    openingBalances: [],
  };
}

function mergeImportResults(a: ImportResult, b: ImportResult): ImportResult {
  return {
    imported: a.imported + b.imported,
    skippedDuplicates: a.skippedDuplicates + b.skippedDuplicates,
    skippedErrors: a.skippedErrors + b.skippedErrors,
    warnings: a.warnings + b.warnings,
  };
}

/** Commits every included, non-error, non-duplicate row through the SAME store
 *  actions the manual UI uses — imported records are indistinguishable from
 *  hand-entered ones except for provenance (Payment.paymentSource === "import")
 *  and `importBatchId`, which is what makes rollback possible. Mutates
 *  `entityIds` in place so callers can accumulate ids across several row sets
 *  (multi-type imports) into one shared ImportBatch. */
function commitRowsIntoBatch(
  rows: StagedRow[],
  store: CommitStore,
  batchId: string,
  entityIds: ImportBatchEntityIds
): ImportResult {
  let imported = 0;
  let skippedDuplicates = 0;
  let skippedErrors = 0;
  let warnings = 0;

  for (const row of rows) {
    if (row.preview.status === "error") {
      skippedErrors++;
      continue;
    }
    if (row.preview.status === "duplicate") {
      skippedDuplicates++;
      continue;
    }
    if (row.preview.status === "warning") warnings++;
    if (!row.preview.include) continue;

    for (const staged of row.staged) {
      switch (staged.kind) {
        case "students": {
          const record: Student = { ...staged.record, importBatchId: batchId };
          store.addStudent(record);
          entityIds.students.push(record.id);
          break;
        }
        case "guardians": {
          const record: Guardian = { ...staged.record, importBatchId: batchId };
          store.addGuardian(record);
          entityIds.guardians.push(record.id);
          break;
        }
        case "teachers": {
          const record: Teacher = { ...staged.record, importBatchId: batchId };
          store.addTeacher(record);
          entityIds.teachers.push(record.id);
          break;
        }
        case "sessions": {
          const record: Session = { ...staged.record, importBatchId: batchId };
          store.addSession(record);
          entityIds.sessions.push(record.id);
          break;
        }
        case "payments": {
          const record: Payment = { ...staged.record, importBatchId: batchId };
          store.addPayment(record);
          entityIds.payments.push(record.id);
          break;
        }
        case "teacherPayments": {
          const record: TeacherPayment = { ...staged.record, importBatchId: batchId };
          store.addTeacherPayment(record);
          entityIds.teacherPayments.push(record.id);
          break;
        }
        case "openingBalances": {
          const record: OpeningBalance = { ...staged.record, importBatchId: batchId };
          store.addOpeningBalance(record);
          entityIds.openingBalances.push(record.id);
          break;
        }
      }
    }
    // One row can stage more than one record (e.g. a session row that also
    // auto-creates its teacher, or a student row that also auto-creates its
    // guardian) — count actual records written, not source rows, so `imported`
    // matches the true total across entityIds and never undercounts.
    imported += row.staged.length;
  }

  return { imported, skippedDuplicates, skippedErrors, warnings };
}

export interface CommitBatchMeta {
  fileName: string;
  importMode: ImportMode;
  fileFingerprint: string;
  entityTypes: ImportEntityType[];
}

/** Single-type commit — wraps commitRowsIntoBatch with one ImportBatch record
 *  covering just this run, so rollback ("İçe Aktarmayı Geri Al") is always
 *  available afterwards. */
export function commitImportBatch(
  rows: StagedRow[],
  store: CommitStore,
  meta: CommitBatchMeta
): { result: ImportResult; batch: ImportBatch } {
  const batchId = newId("batch", 0);
  const entityIds = emptyImportBatchEntityIds();
  const result = commitRowsIntoBatch(rows, store, batchId, entityIds);
  const summary = buildImportSummary(rows);
  const impact = buildFinancialImpact(rows);

  const batch: ImportBatch = {
    id: batchId,
    tenantId: "tenant-1",
    fileName: meta.fileName,
    importedAt: new Date().toISOString(),
    importMode: meta.importMode,
    importedBy: "Sistem Kullanıcısı",
    entityTypes: meta.entityTypes,
    rowCount: summary.totalRows,
    createdEntityIds: entityIds,
    skippedRows: summary.errorRows,
    warningRows: summary.warningRows,
    duplicateRows: summary.duplicateRows,
    financialSummary: impact,
    fileFingerprint: meta.fileFingerprint,
  };
  store.addImportBatch(batch);

  return { result, batch };
}

/** Multi-type commit (multi-select import wizard) — commits every task's staged
 *  rows in dependency order into ONE shared ImportBatch, so rollback removes
 *  the entire run across every entity type at once. */
export function commitMultiImportBatch(
  taskRowSets: { type: ImportEntityType; rows: StagedRow[] }[],
  store: CommitStore,
  meta: Omit<CommitBatchMeta, "entityTypes">
): { result: ImportResult; batch: ImportBatch } {
  const batchId = newId("batch", 0);
  const entityIds = emptyImportBatchEntityIds();

  let result: ImportResult = { imported: 0, skippedDuplicates: 0, skippedErrors: 0, warnings: 0 };
  let summary: ImportSummary = { totalRows: 0, validRows: 0, warningRows: 0, errorRows: 0, duplicateRows: 0, skippedRows: 0, toCommitRows: 0 };
  let impact: ImportFinancialImpact = {
    sessionsToCreate: 0,
    paymentsToCreate: 0,
    teacherPaymentsToCreate: 0,
    openingBalancesToCreate: 0,
    totalTahakkukImpact: 0,
    totalTahsilatImpact: 0,
    teacherPaymentImpact: 0,
    cashImpact: 0,
    remainingBalanceImpact: 0,
    estimatedTeacherEarningImpact: 0,
    estimatedCenterProfitImpact: 0,
    sessionsWithUnknownTeacherEarning: 0,
    historicalNonBillableSessionsToCreate: 0,
  };

  const sortedSets = sortTaskRowSetsByDependency(taskRowSets);
  for (const { rows } of sortedSets) {
    result = mergeImportResults(result, commitRowsIntoBatch(rows, store, batchId, entityIds));
    const rowSummary = buildImportSummary(rows);
    summary = {
      totalRows: summary.totalRows + rowSummary.totalRows,
      validRows: summary.validRows + rowSummary.validRows,
      warningRows: summary.warningRows + rowSummary.warningRows,
      errorRows: summary.errorRows + rowSummary.errorRows,
      duplicateRows: summary.duplicateRows + rowSummary.duplicateRows,
      skippedRows: summary.skippedRows + rowSummary.skippedRows,
      toCommitRows: summary.toCommitRows + rowSummary.toCommitRows,
    };
    const rowImpact = buildFinancialImpact(rows);
    impact = {
      sessionsToCreate: impact.sessionsToCreate + rowImpact.sessionsToCreate,
      paymentsToCreate: impact.paymentsToCreate + rowImpact.paymentsToCreate,
      teacherPaymentsToCreate: impact.teacherPaymentsToCreate + rowImpact.teacherPaymentsToCreate,
      openingBalancesToCreate: impact.openingBalancesToCreate + rowImpact.openingBalancesToCreate,
      totalTahakkukImpact: impact.totalTahakkukImpact + rowImpact.totalTahakkukImpact,
      totalTahsilatImpact: impact.totalTahsilatImpact + rowImpact.totalTahsilatImpact,
      teacherPaymentImpact: impact.teacherPaymentImpact + rowImpact.teacherPaymentImpact,
      cashImpact: impact.cashImpact + rowImpact.cashImpact,
      remainingBalanceImpact: impact.remainingBalanceImpact + rowImpact.remainingBalanceImpact,
      estimatedTeacherEarningImpact: impact.estimatedTeacherEarningImpact + rowImpact.estimatedTeacherEarningImpact,
      estimatedCenterProfitImpact: impact.estimatedCenterProfitImpact + rowImpact.estimatedCenterProfitImpact,
      sessionsWithUnknownTeacherEarning: impact.sessionsWithUnknownTeacherEarning + rowImpact.sessionsWithUnknownTeacherEarning,
      historicalNonBillableSessionsToCreate: impact.historicalNonBillableSessionsToCreate + rowImpact.historicalNonBillableSessionsToCreate,
    };
  }

  const batch: ImportBatch = {
    id: batchId,
    tenantId: "tenant-1",
    fileName: meta.fileName,
    importedAt: new Date().toISOString(),
    importMode: meta.importMode,
    importedBy: "Sistem Kullanıcısı",
    entityTypes: [...new Set(sortedSets.map((s) => s.type))],
    rowCount: summary.totalRows,
    createdEntityIds: entityIds,
    skippedRows: summary.errorRows,
    warningRows: summary.warningRows,
    duplicateRows: summary.duplicateRows,
    financialSummary: impact,
    fileFingerprint: meta.fileFingerprint,
  };
  store.addImportBatch(batch);

  return { result, batch };
}

// ─── Fingerprint / idempotency ───────────────────────────────────────────────

/** SHA-256 of the raw file bytes — used to detect "this exact file was already
 *  imported" independent of row-level duplicate matching (which only catches
 *  duplicates at the record level, not "you uploaded the same spreadsheet twice"). */
export async function computeFileFingerprint(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Most recent non-rolled-back batch that was committed from a file with this
 *  same fingerprint, if any — surfaced as an early warning on upload. */
export function findExistingBatchByFingerprint(
  fingerprint: string,
  batches: ImportBatch[]
): ImportBatch | null {
  const matches = batches.filter((b) => b.fileFingerprint === fingerprint && !b.rolledBackAt);
  if (matches.length === 0) return null;
  return matches.reduce((latest, b) =>
    new Date(b.importedAt).getTime() > new Date(latest.importedAt).getTime() ? b : latest
  );
}

// ─── Rollback ────────────────────────────────────────────────────────────────

function wasEditedSinceImport(record: { updatedAt?: string } | undefined, importedAt: string): boolean {
  if (!record || !record.updatedAt) return false;
  return new Date(record.updatedAt).getTime() > new Date(importedAt).getTime();
}

/** Detects any record created by this batch that was subsequently hand-edited —
 *  rollback must never silently discard that edit, so these are always kept. */
export function findEditedRecordsSinceImport(
  batch: ImportBatch,
  store: ImportStoreSnapshot
): EditedImportRecord[] {
  const edited: EditedImportRecord[] = [];

  function check<T extends { id: string; updatedAt?: string }>(
    entityType: ImportEntityType,
    ids: string[],
    list: T[],
    label: (record: T) => string
  ) {
    for (const id of ids) {
      const record = list.find((r) => r.id === id);
      if (wasEditedSinceImport(record, batch.importedAt)) {
        edited.push({ entityType, id, label: label(record!) });
      }
    }
  }

  check("students", batch.createdEntityIds.students, store.students, (r) => r.fullName);
  check("guardians", batch.createdEntityIds.guardians, store.guardians, (r) => r.fullName);
  check("teachers", batch.createdEntityIds.teachers, store.teachers, (r) => r.fullName);
  check("sessions", batch.createdEntityIds.sessions, store.sessions, (r) => parseCellAsDateString(r.date) ?? r.date);
  check("payments", batch.createdEntityIds.payments, store.payments, (r) => `${r.date} — ${r.amount}`);
  check("teacherPayments", batch.createdEntityIds.teacherPayments, store.teacherPayments, (r) => `${r.date} — ${r.amount}`);
  check("openingBalances", batch.createdEntityIds.openingBalances, store.openingBalances, (r) => `${r.date} — ${r.amount}`);

  return edited;
}

interface RollbackStore {
  deleteStudents: (ids: string[]) => void;
  deleteGuardians: (ids: string[]) => void;
  deleteTeachers: (ids: string[]) => void;
  deleteSessions: (ids: string[]) => void;
  deletePayments: (ids: string[]) => void;
  deleteTeacherPayments: (ids: string[]) => void;
  deleteOpeningBalances: (ids: string[]) => void;
  markImportBatchRolledBack: (batchId: string) => void;
}

export interface RollbackResult {
  /** Records this batch created but that were hand-edited afterwards — never
   *  deleted, so the user's edit survives. Reported so the UI can explain why
   *  the record is still there. */
  skippedEditedRecords: EditedImportRecord[];
}

/** Removes ONLY the records this batch created (never a broader query), skipping
 *  any that were edited after import. Never touches records that pre-date the
 *  import, per spec. */
export function rollbackImportBatch(
  batch: ImportBatch,
  storeSnapshot: ImportStoreSnapshot,
  store: RollbackStore
): RollbackResult {
  const edited = findEditedRecordsSinceImport(batch, storeSnapshot);
  const editedIdsByType = new Map<ImportEntityType, Set<string>>();
  for (const e of edited) {
    if (!editedIdsByType.has(e.entityType)) editedIdsByType.set(e.entityType, new Set());
    editedIdsByType.get(e.entityType)!.add(e.id);
  }
  const safeIds = (type: ImportEntityType, ids: string[]) => {
    const excluded = editedIdsByType.get(type);
    return excluded ? ids.filter((id) => !excluded.has(id)) : ids;
  };

  store.deleteStudents(safeIds("students", batch.createdEntityIds.students));
  store.deleteGuardians(safeIds("guardians", batch.createdEntityIds.guardians));
  store.deleteTeachers(safeIds("teachers", batch.createdEntityIds.teachers));
  store.deleteSessions(safeIds("sessions", batch.createdEntityIds.sessions));
  store.deletePayments(safeIds("payments", batch.createdEntityIds.payments));
  store.deleteTeacherPayments(safeIds("teacherPayments", batch.createdEntityIds.teacherPayments));
  store.deleteOpeningBalances(safeIds("openingBalances", batch.createdEntityIds.openingBalances));
  store.markImportBatchRolledBack(batch.id);

  return { skippedEditedRecords: edited };
}
