import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";
import { parseSpreadsheetFile, parseCellAsDateString, parseCellAsTimeString, type RawCell } from "@/lib/helpers/import-parse";
import { prepareSheetsForImport } from "@/lib/helpers/import-table";
import { classifyWorkbook } from "@/lib/helpers/workbook-analyzer";
import { buildStudentLedgerImport, detectStudentLedgerWorkbook } from "@/lib/helpers/student-ledger-import";
import {
  buildMultiImportPreview,
  collectImportedTeacherAssignments,
  commitMultiImportBatch,
  resolveSessionStatusValue,
  rollbackImportBatch,
  suggestColumnMappings,
  type ImportStoreSnapshot,
  type MultiImportTaskResult,
} from "@/lib/helpers/import";
import { getStudentDebt, getTeacherEarningTotals, withEarningFactor } from "@/lib/helpers/finance";
import { getSettingsDefaults } from "@/lib/settings/defaults";
import type { EducationType, ImportEntityType, ImportMode, TeacherEducationTypeAssignment } from "@/types";

// The Excel import, end to end and without the UI: a real .xlsx built in
// memory → read → sheet types detected → columns matched → preview → commit
// into an in-memory store → what the institution ends up owing and being owed.
// Every workbook below is the kind of messy file a real institution sends.

/** The institution's education types in these scenarios. */
const educationTypes: EducationType[] = [
  {
    id: "et-1",
    tenantId: "tenant-1",
    name: "Bireysel Eğitim",
    description: "Öğrenciye özel birebir seans",
    color: "#2563eb",
    defaultStudentPrice: 400,
    status: "active",
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "et-2",
    tenantId: "tenant-1",
    name: "Grup Eğitimi",
    description: "2-4 kişilik küçük grup seansı",
    color: "#059669",
    defaultStudentPrice: 250,
    status: "active",
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "et-3",
    tenantId: "tenant-1",
    name: "Dil Terapisi",
    description: "Konuşma ve dil gelişimi seansı",
    color: "#d97706",
    defaultStudentPrice: 450,
    status: "active",
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "et-4",
    tenantId: "tenant-1",
    name: "Özel Algı Eğitimi",
    description: "Duyusal entegrasyon seansı",
    color: "#7c3aed",
    defaultStudentPrice: 500,
    status: "active",
    createdAt: "2024-01-01T00:00:00Z",
  },
];

const ENTITY_TYPES: string[] = ["students", "guardians", "teachers", "sessions", "payments", "teacherPayments", "openingBalances"];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-21T12:00:00"));
});
afterEach(() => vi.useRealTimers());

type Cell = RawCell | XLSX.CellObject;

/** A workbook as Excel writes it: Date cells become serial numbers with a date
 *  format, exactly like a file saved from Excel. */
function workbook(sheets: { name: string; rows: Cell[][] }[], fileName = "kurum.xlsx"): File {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws: XLSX.WorkSheet = {};
    s.rows.forEach((row, r) =>
      row.forEach((value, c) => {
        if (value === null || value === undefined || value === "") return;
        const ref = XLSX.utils.encode_cell({ r, c });
        if (value instanceof Date) {
          const serial = (Date.UTC(value.getFullYear(), value.getMonth(), value.getDate(), value.getHours(), value.getMinutes()) - Date.UTC(1899, 11, 30)) / 86_400_000;
          ws[ref] = { t: "n", v: serial, z: value.getHours() || value.getMinutes() ? "dd.mm.yyyy hh:mm" : "dd.mm.yyyy" };
        } else if (typeof value === "object") {
          ws[ref] = value as XLSX.CellObject;
        } else {
          ws[ref] = typeof value === "number" ? { t: "n", v: value } : { t: "s", v: String(value) };
        }
      })
    );
    const width = Math.max(1, ...s.rows.map((r) => r.length));
    ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(0, s.rows.length - 1), c: width - 1 } });
    XLSX.utils.book_append_sheet(wb, ws, s.name);
  }
  return new File([XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer], fileName);
}

function emptyStore(): ImportStoreSnapshot & { teacherEducationTypeAssignments: TeacherEducationTypeAssignment[] } {
  return { students: [], guardians: [], teachers: [], sessions: [], payments: [], teacherPayments: [], openingBalances: [], teacherEducationTypeAssignments: [] };
}

async function preview(file: File, store = emptyStore(), mode: ImportMode = "operational") {
  const sheets = prepareSheetsForImport(await parseSpreadsheetFile(file));
  const classified = classifyWorkbook(sheets);
  const tasks = classified
    .filter((c) => ENTITY_TYPES.includes(c.resultType))
    .map((c) => ({ type: c.resultType as ImportEntityType, sheet: c.sheet, mapping: suggestColumnMappings(c.sheet, c.resultType as ImportEntityType) }));
  const results = buildMultiImportPreview(tasks, mode, store, educationTypes);
  return { classified, results };
}

/** Commits like the import page does, into a plain in-memory store that keeps
 *  the same invariants as the real one (two-way guardian link, earning share). */
function commit(results: MultiImportTaskResult[], store = emptyStore()) {
  const policy = getSettingsDefaults().teacherEarnings;
  const { result, batch } = commitMultiImportBatch(
    results.map((r) => ({ type: r.type, rows: r.rows })),
    {
      addStudent: (s) => {
        store.students.push(s);
        for (const g of store.guardians) if (s.guardianIds.includes(g.id) && !g.studentIds.includes(s.id)) g.studentIds.push(s.id);
      },
      addGuardian: (g) => void store.guardians.push(g),
      addTeacher: (t) => void store.teachers.push(t),
      addSession: (s) => void store.sessions.push(withEarningFactor(s, policy)),
      addPayment: (p) => void store.payments.push(p),
      addTeacherPayment: (p) => void store.teacherPayments.push(p),
      addOpeningBalance: (b) => void store.openingBalances.push(b),
      setTeacherOpeningBalance: () => {},
      addImportBatch: () => {},
    },
    { fileName: "kurum.xlsx", importMode: "operational", fileFingerprint: "x" }
  );
  for (const a of collectImportedTeacherAssignments(results, store.teacherEducationTypeAssignments)) {
    store.teacherEducationTypeAssignments.push({ id: `a-${a.teacherId}-${a.educationTypeId}`, tenantId: "tenant-1", status: "active", createdAt: "", ...a } as TeacherEducationTypeAssignment);
  }
  return { store, result, batch };
}

const rowsOf = (results: MultiImportTaskResult[], type: ImportEntityType) => results.find((r) => r.type === type)?.rows ?? [];
const byName = <T extends { fullName: string }>(list: T[], name: string) => list.find((x) => x.fullName === name)!;

// ─── A typical institution workbook ──────────────────────────────────────────

const institutionWorkbook = () =>
  workbook([
    { name: "Veliler", rows: [["VELİ ADI SOYADI", "TELEFON", "YAKINLIK"], ["Hatice Kaya", "0532 111 22 33", "Anne"], ["Mehmet Demir", "05441234567", "Baba"]] },
    {
      name: "Öğrenciler",
      rows: [
        ["2026 ÖĞRENCİ LİSTESİ"],
        [],
        ["ÖĞRENCİ ADI", "DOĞUM TARİHİ", "VELİ", "VELİ TEL"],
        ["Ali Kaya", "12.03.2018", "Hatice Kaya", "0532 111 22 33"],
        ["  zeynep   DEMİR ", new Date(2017, 4, 9), "Mehmet Demir", "0544 123 45 67"],
        [],
        ["TOPLAM", "2 öğrenci"],
      ],
    },
    { name: "Öğretmenler", rows: [["Adı Soyadı", "Tel"], ["Ayşe Yılmaz", "0555 000 11 22"], ["Fatma Şahin", ""]] },
    {
      name: "Dersler",
      rows: [
        ["Tarih", "Saat", "Öğrenci", "Öğretmen", "Eğitim Türü", "Ücret", "Öğretmen Hakedişi", "Durum"],
        [new Date(2026, 9, 5), "10:00", "Ali Kaya", "Ayşe Yılmaz", "Bireysel Eğitim", "1.250,50 TL", "600", "Tamamlandı"],
        [new Date(2026, 9, 6, 11, 0), "", "ALİ KAYA", "ayşe yılmaz", "bireysel eğitim", 400, 250, "GELMEDİ"],
        ["07.10.2026", "10:00", "Zeynep Demir", "Fatma Şahin", "Dil Terapisi", "₺450", "200", "İptal"],
        ["8/10/2026", "14:30", "Zeynep Demir", "Fatma Şahin", "Dil Terapisi", 450, 200, "Raporlu"],
        ["09.10.2026", "10:00", "Zeynep Demir", "Fatma Şahin", "Dil Terapisi", 450, 200, "Geldi"],
        ["09.10.2026", "10:00", "Zeynep Demir", "Fatma Şahin", "Dil Terapisi", 450, 200, "Geldi"],
        ["10.10.2026", "10:00", "Can Bilinmez", "Ayşe Yılmaz", "Bireysel Eğitim", 400, 250, "Telafi"],
        ["13.10.2026", "15:00", "Ali Kaya", "Ayşe Yılmaz", "Bireysel Eğitim", 400, 250, "Telafi dersi"],
        ["GENEL TOPLAM", "", "", "", "", "3.300,50", "", ""],
      ],
    },
    {
      name: "Ödemeler",
      rows: [
        ["Öğrenci", "Tarih", "Tutar", "Ödeme Şekli"],
        ["Ali Kaya", "10.10.2026", "1.000", "Nakit"],
        ["Zeynep Demir", "11.10.2026", "450,00", "EFT"],
        ["Zeynep Demir", "13 Ekim 2026", "200", "Kredi Kartı"],
        ["Ali Kaya", "13.10.2026", "-100", "Nakit"],
      ],
    },
  ]);

describe("a typical institution workbook", () => {
  it("recognises every sheet and every column", async () => {
    const { classified } = await preview(institutionWorkbook());
    expect(classified.map((c) => [c.sheet.name, c.resultType])).toEqual([
      ["Veliler", "guardians"],
      ["Öğrenciler", "students"],
      ["Öğretmenler", "teachers"],
      ["Dersler", "sessions"],
      ["Ödemeler", "payments"],
    ]);
    const lessons = classified.find((c) => c.resultType === "sessions")!.sheet;
    expect(suggestColumnMappings(lessons, "sessions").map((m) => m.systemField)).toEqual([
      "date", "time", "studentName", "teacherName", "educationType", "studentPrice", "teacherEarning", "status",
    ]);
  });

  it("drops title and total rows and tidies names", async () => {
    const { results } = await preview(institutionWorkbook());
    const students = rowsOf(results, "students").flatMap((r) => r.staged).filter((s) => s.kind === "students");
    expect(students.map((s) => s.record.fullName)).toEqual(["Ali Kaya", "Zeynep Demir"]);
    expect(rowsOf(results, "sessions").some((r) => /toplam/i.test(r.preview.displayText))).toBe(false);
  });

  it("reads Excel date cells on the right day and time (Turkish time zone)", async () => {
    const { results } = await preview(institutionWorkbook());
    const students = rowsOf(results, "students").flatMap((r) => r.staged);
    expect(students.find((s) => s.kind === "students" && s.record.fullName === "Zeynep Demir")!.record).toMatchObject({ birthDate: "2017-05-09" });
    const dates = rowsOf(results, "sessions").flatMap((r) => r.staged).map((s) => s.kind === "sessions" && s.record.date);
    expect(dates).toContain("2026-10-05T10:00:00");
    expect(dates).toContain("2026-10-06T11:00:00");
    expect(dates).toContain("2026-10-08T14:30:00");
  });

  it("understands the status words people write", async () => {
    const { results } = await preview(institutionWorkbook());
    const statuses = rowsOf(results, "sessions")
      .flatMap((r) => r.staged)
      .map((s) => s.kind === "sessions" && `${s.record.date.slice(5, 10)} ${s.record.status}`);
    expect(statuses).toEqual([
      "10-05 completed",
      "10-06 no_show",
      "10-07 cancelled",
      "10-08 cancelled", // Raporlu
      "10-09 completed", // Geldi
      "10-13 makeup", // Telafi dersi
    ]);
  });

  it("flags what can't go in: duplicate rows, unknown students, negative amounts", async () => {
    const { results } = await preview(institutionWorkbook());
    const lessons = rowsOf(results, "sessions");
    expect(lessons.filter((r) => r.preview.status === "duplicate")).toHaveLength(1);
    expect(lessons.find((r) => r.preview.status === "error")!.preview.issues[0]).toContain("Can Bilinmez");
    const payments = rowsOf(results, "payments");
    expect(payments.filter((r) => r.preview.status === "error")).toHaveLength(1);
    expect(payments.filter((r) => r.preview.include).map((r) => r.staged[0]!.record)).toMatchObject([
      { amount: 1000, method: "cash", date: "2026-10-10" },
      { amount: 450, method: "bank_transfer", date: "2026-10-11" },
      { amount: 200, method: "credit_card", date: "2026-10-13" },
    ]);
  });

  it("takes every lesson in even though the teachers are new, and assigns them", async () => {
    const { results } = await preview(institutionWorkbook());
    const included = rowsOf(results, "sessions").filter((r) => r.preview.include);
    expect(included).toHaveLength(6);
    const { store } = commit(results);
    const ayse = byName(store.teachers, "Ayşe Yılmaz");
    const fatma = byName(store.teachers, "Fatma Şahin");
    // Ayşe's lessons carry 600 and 250 → no single amount, left to fill in.
    // Fatma's all carry 200 → that becomes her per-lesson pay.
    expect(store.teacherEducationTypeAssignments.map((a) => [a.teacherId, a.educationTypeId, a.earningAmount])).toEqual([
      [ayse.id, "et-1", null],
      [fatma.id, "et-3", 200],
    ]);
  });

  it("ends with the right debts and teacher earnings", async () => {
    const { results } = await preview(institutionWorkbook());
    const { store } = commit(results);
    const ali = byName(store.students, "Ali Kaya");
    const zeynep = byName(store.students, "Zeynep Demir");
    // Ali: 1.250,50 (completed) + 400 (no-show, billed) + 400 (makeup) − 1.000 paid
    expect(getStudentDebt(ali.id, store.sessions, store.payments)).toBe(1050.5);
    // Zeynep: cancelled ×2 not billed, 450 completed − 650 paid → credit, no debt
    expect(getStudentDebt(zeynep.id, store.sessions, store.payments)).toBe(0);
    // Ayşe: 600 + no-show (no pay) + makeup 250; Fatma: one 200 lesson.
    const ayse = byName(store.teachers, "Ayşe Yılmaz");
    const fatma = byName(store.teachers, "Fatma Şahin");
    expect(getTeacherEarningTotals(ayse, store.sessions, []).totalEarning).toBe(850);
    expect(getTeacherEarningTotals(fatma, store.sessions, []).totalEarning).toBe(200);
  });

  it("links each guardian to its students both ways", async () => {
    const { results } = await preview(institutionWorkbook());
    const { store } = commit(results);
    const hatice = byName(store.guardians, "Hatice Kaya");
    expect(hatice.studentIds).toEqual([byName(store.students, "Ali Kaya").id]);
    expect(store.guardians).toHaveLength(2); // matched by phone, not created twice
  });

  it("importing the same file again adds nothing", async () => {
    const first = await preview(institutionWorkbook());
    const { store } = commit(first.results);
    const counts = () => [store.students.length, store.guardians.length, store.teachers.length, store.sessions.length, store.payments.length];
    const before = counts();
    const again = await preview(institutionWorkbook(), store);
    commit(again.results, store);
    expect(counts()).toEqual(before);
  });

  it("can be undone completely", async () => {
    const { results } = await preview(institutionWorkbook());
    const { store, batch } = commit(results);
    expect(store.sessions.length).toBeGreaterThan(0);
    const remove = (key: keyof ImportStoreSnapshot) => (ids: string[]) => {
      const list = store[key] as { id: string }[];
      (store[key] as { id: string }[]) = list.filter((x) => !ids.includes(x.id));
    };
    const { skippedEditedRecords } = rollbackImportBatch(batch, store, {
      deleteStudents: remove("students"),
      deleteGuardians: remove("guardians"),
      deleteTeachers: remove("teachers"),
      deleteSessions: remove("sessions"),
      deletePayments: remove("payments"),
      deleteTeacherPayments: remove("teacherPayments"),
      deleteOpeningBalances: remove("openingBalances"),
      setTeacherOpeningBalance: () => {},
      markImportBatchRolledBack: () => {},
    });
    expect(skippedEditedRecords).toEqual([]);
    expect([store.students, store.guardians, store.teachers, store.sessions, store.payments].map((l) => l.length)).toEqual([0, 0, 0, 0, 0]);
  });
});

// ─── Other shapes people send ────────────────────────────────────────────────

describe("other files", () => {
  it("joins separate first and last name columns", async () => {
    const { classified, results } = await preview(
      workbook([{ name: "Öğrenci Listesi", rows: [["Adı", "Soyadı", "Veli Adı", "Veli Soyadı", "Veli Telefon"], ["Ali", "Kaya", "Hatice", "Kaya", "05321112233"]] }])
    );
    expect(classified[0]!.resultType).toBe("students");
    const staged = rowsOf(results, "students")[0]!.staged;
    expect(staged.map((s) => [s.kind, (s.record as { fullName: string }).fullName])).toEqual([
      ["guardians", "Hatice Kaya"],
      ["students", "Ali Kaya"],
    ]);
  });

  it("reads a Turkish CSV with ; and written-out dates", async () => {
    const store = emptyStore();
    store.students.push({ id: "st1", tenantId: "tenant-1", fullName: "Ali Kaya", birthDate: "", status: "active", guardianIds: [], educationTypeIds: [], createdAt: "" });
    const { results } = await preview(new File(["Öğrenci;Tarih;Tutar;Ödeme Yöntemi\nAli Kaya;13 Ekim 2026;₺1.250,50;Havale\n"], "odemeler.csv"), store);
    expect(rowsOf(results, "payments")[0]!.staged[0]!.record).toMatchObject({ studentId: "st1", amount: 1250.5, date: "2026-10-13", method: "bank_transfer" });
  });

  it("reads teacher payments: advance, salary and deduction", async () => {
    const { results } = await preview(
      workbook([
        { name: "Öğretmenler", rows: [["Ad Soyad"], ["Ayşe Yılmaz"]] },
        { name: "Öğretmen Ödemeleri", rows: [["Öğretmen", "Tarih", "Tutar", "Ödeme Türü"], ["Ayşe Yılmaz", "01.10.2026", "5.000", "Avans"], ["Ayşe Yılmaz", "30.10.2026", "20000", "Maaş"], ["Ayşe Yılmaz", "30.10.2026", "500", "Kesinti"]] },
      ])
    );
    expect(rowsOf(results, "teacherPayments").map((r) => [(r.staged[0]!.record as { amount: number }).amount, (r.staged[0]!.record as { paymentType: string }).paymentType])).toEqual([
      [5000, "advance"],
      [20000, "salary"],
      [500, "deduction"],
    ]);
  });

  it("reads opening balances (devir)", async () => {
    const { results } = await preview(
      workbook([
        { name: "Öğrenciler", rows: [["Öğrenci Adı"], ["Ali Kaya"]] },
        { name: "Devir", rows: [["Öğrenci", "Tutar", "Borç/Alacak", "Tarih"], ["Ali Kaya", "1.500", "Borç", "01.09.2026"]] },
      ])
    );
    expect(rowsOf(results, "openingBalances")[0]!.staged[0]!.record).toMatchObject({ amount: 1500, balanceType: "debt", date: "2026-09-01" });
  });

  it("handles a large file quickly", async () => {
    const students: Cell[][] = [["Öğrenci Adı"], ...Array.from({ length: 200 }, (_, i) => [`Öğrenci ${i}`])];
    const teachers: Cell[][] = [["Öğretmen Adı"], ...Array.from({ length: 20 }, (_, i) => [`Öğretmen ${i}`])];
    // 5 000 lessons, each student once a day at a distinct hour — no real duplicates.
    const lessons: Cell[][] = [["Tarih", "Saat", "Öğrenci", "Öğretmen", "Ücret"]];
    for (let i = 0; i < 5000; i++) {
      const student = i % 200;
      const day = Math.floor(i / 200);
      lessons.push([new Date(2026, 6 + Math.floor(day / 25), 1 + (day % 25)), `${8 + (student % 12)}:00`, `Öğrenci ${student}`, `Öğretmen ${Math.floor(student / 10)}`, 400]);
    }
    const started = performance.now();
    vi.useRealTimers();
    const { results } = await preview(workbook([{ name: "Öğrenciler", rows: students }, { name: "Öğretmenler", rows: teachers }, { name: "Seanslar", rows: lessons }]));
    const elapsed = performance.now() - started;
    expect(rowsOf(results, "sessions").filter((r) => r.preview.include)).toHaveLength(5000);
    expect(elapsed).toBeLessThan(5000);
  });
});

// ─── Per-student lesson ledger (LİSTE + one sheet per student) ──────────────

describe("per-student lesson ledger", () => {
  const ledgerWorkbook = () =>
    workbook([
      { name: "LİSTE", rows: [["AD SOYAD"], ["Ali Kaya"], ["Zeynep Demir"]] },
      ...[["Ali Kaya", "Ayşe Hoca"], ["Zeynep Demir", "Fatma Şahin"]].map(([name, teacher]) => ({
        name: name!.split(" ")[0]!.toLocaleUpperCase("tr-TR"),
        rows: [
          ["ÖĞRENCİ ADI SOYADI:", name, "", "ÖĞRETMEN:", teacher],
          ["HAFTALIK DERS SAYISI:", 2],
          [],
          ["TARİH", "DERS SAATİ", "DERS ÜCRETİ", "TUTAR", "AÇIKLAMA"],
          [new Date(2026, 9, 5), 1, 400, 400, ""],
          [new Date(2026, 9, 7), 2, 400, 800, "blok"],
          [new Date(2026, 9, 12), 1, 400, 400, "gelmedi"],
          [new Date(2026, 9, 28), 1, 400, 400, ""],
          ["", 0, 0, 0, ""],
          ["TOPLAM", 5, "", 2000, ""],
        ] as Cell[][],
      })),
      { name: "BOŞ", rows: [["ÖĞRENCİ ADI SOYADI:", ""], [], ["TARİH", "DERS SAATİ", "DERS ÜCRETİ", "TUTAR"]] },
    ]);

  it("recognises the format, its roster and the empty template", async () => {
    const sheets = prepareSheetsForImport(await parseSpreadsheetFile(ledgerWorkbook()));
    expect(classifyWorkbook(sheets).map((c) => c.resultType)).toEqual(["studentLedger", "studentLedger", "studentLedger", "studentLedger"]);
    expect(detectStudentLedgerWorkbook(sheets).ledgerSheets.map((l) => l.sheet.name)).toEqual(["ALİ", "ZEYNEP"]);
  });

  it("creates the students and teachers and reads every lesson right", async () => {
    const sheets = prepareSheetsForImport(await parseSpreadsheetFile(ledgerWorkbook()));
    const detection = detectStudentLedgerWorkbook(sheets);
    const result = buildStudentLedgerImport(detection.ledgerSheets.map((l) => l.sheet), detection.listSheet, [], [], "et-1", [], "operational", true, [], "billable");
    expect(result.studentCreationRows.flatMap((r) => r.staged).map((s) => (s.record as { fullName: string }).fullName)).toEqual(["Ali Kaya", "Zeynep Demir"]);
    const [ali] = result.sheetResults;
    expect(ali!.teacherName).toBe("Ayşe Hoca");
    expect(ali!.skippedRowCount).toBe(2); // the blank and the TOPLAM row
    const lessons = ali!.rows.flatMap((r) => r.staged).filter((s) => s.kind === "sessions").map((s) => s.record as { date: string; sessionCount: number; status: string });
    expect(lessons.map((l) => [l.date.slice(0, 10), l.sessionCount, l.status])).toEqual([
      ["2026-10-05", 1, "completed"],
      ["2026-10-07", 2, "completed"], // block lesson
      ["2026-10-12", 1, "no_show"], // "gelmedi" note
      ["2026-10-28", 1, "planned"], // still ahead
    ]);
    const teachers = ali!.rows.flatMap((r) => r.staged).filter((s) => s.kind === "teachers");
    expect(teachers.map((t) => (t.record as { fullName: string }).fullName)).toEqual(["Ayşe"]); // "Hoca" dropped
  });
});

// ─── Single values ───────────────────────────────────────────────────────────

describe("single cells", () => {
  it("reads Excel time and date-time cells on the local clock", () => {
    // What SheetJS hands back for "14:30" in Turkey: local 14:30 on 31.12.1899.
    expect(parseCellAsTimeString(new Date(1899, 11, 31, 14, 30))).toBe("14:30");
    expect(parseCellAsTimeString(new Date(2026, 9, 6, 9, 59, 59, 900))).toBe("10:00");
    expect(parseCellAsDateString(new Date(2026, 9, 6))).toBe("2026-10-06");
  });

  it("maps status words, unknown ones are reported", () => {
    const cases: [string, string][] = [
      ["Tamamlandı ✓", "completed"], ["YAPILDI", "completed"], ["Katıldı", "completed"],
      ["Gelmedi (habersiz)", "no_show"], ["No-show", "no_show"], ["DEVAMSIZ", "no_show"],
      ["İzinli", "cancelled"], ["Hasta", "cancelled"], ["Ertelendi", "cancelled"], ["İPTAL", "cancelled"],
      ["Telafi Dersi", "makeup"], ["Planlandı", "planned"], ["Bekliyor", "planned"],
    ];
    for (const [raw, status] of cases) expect(resolveSessionStatusValue(raw), raw).toEqual({ status, recognized: true });
    expect(resolveSessionStatusValue("???").recognized).toBe(false);
  });
});
