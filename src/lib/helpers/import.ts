import type {
  ImportType,
  ImportSystemField,
  ImportColumnMapping,
  ImportPreviewRow,
  ImportEntityMatch,
  ImportSummary,
} from "@/types";
import { MOCK_EXCEL_COLUMNS } from "@/lib/mock/import";

// ─── System field definitions per import type ─────────────────────────────────

const SYSTEM_FIELDS: Record<ImportType, ImportSystemField[]> = {
  students: [
    { key: "fullName", label: "Öğrenci Adı Soyadı", required: true },
    { key: "guardianName", label: "Veli Adı", required: false },
    { key: "guardianPhone", label: "Telefon", required: false },
    { key: "educationType", label: "Eğitim Türü", required: false },
    { key: "weeklySessionCount", label: "Haftalık Seans Sayısı", required: false },
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
  ],
  payments: [
    { key: "studentName", label: "Öğrenci", required: true },
    { key: "amount", label: "Tutar", required: true },
    { key: "date", label: "Tarih", required: true },
    { key: "method", label: "Ödeme Yöntemi", required: false },
    { key: "notes", label: "Notlar", required: false },
  ],
  "teacher-earnings": [
    { key: "teacherName", label: "Öğretmen", required: true },
    { key: "studentName", label: "Öğrenci", required: true },
    { key: "date", label: "Tarih", required: true },
    { key: "amount", label: "Hakediş Tutarı", required: true },
    { key: "status", label: "Durum", required: false },
  ],
};

// ─── Initial auto-match mappings per import type ──────────────────────────────
// Simulates what a real parser would auto-detect based on column name similarity.
// Columns set to null are intentionally left unmatched to demonstrate the mapping UX.

const INITIAL_MAPPINGS: Record<ImportType, Record<string, string | null>> = {
  students: {
    "Ad Soyad": "fullName",
    "Veli Adı": "guardianName",
    "Telefon": "guardianPhone",
    "Eğitim Türü": "educationType",
    "Seans/Hafta": null,
    "Aktif/Pasif": null,
    "Notlar": null,
  },
  sessions: {
    "Öğrenci Adı": "studentName",
    "Öğretmen": "teacherName",
    "Eğitim": null,
    "Tarih": "date",
    "Saat": "time",
    "Adet": null,
    "Fiyat (₺)": null,
    "Hakediş (₺)": "teacherEarning",
    "Durum": "status",
  },
  payments: {
    "Öğrenci": "studentName",
    "Tutar (₺)": "amount",
    "Tarih": "date",
    "Ödeme Şekli": null,
    "Notlar": "notes",
  },
  "teacher-earnings": {
    "Öğretmen Adı": "teacherName",
    "Öğrenci": "studentName",
    "Seans Tarihi": "date",
    "Hakediş (₺)": "amount",
    "Ödendi mi?": null,
  },
};

// ─── Mock preview rows per import type ───────────────────────────────────────

// Helper — shorthand for entity match entries
function m(entityType: ImportEntityMatch["entityType"], value: string, matched: boolean): ImportEntityMatch {
  return { entityType, value, matched };
}

// Existing system records (for realistic match simulation)
// Students: Yusuf Çelik, Elif Arslan, Ahmet Koç, Selin Koç, Mert Doğan, Zehra Aktaş
// Teachers: Ayşe Yılmaz, Mehmet Kara, Elif Demir, Can Şahin
// Ed types: Bireysel Eğitim, Grup Eğitimi, Dil Terapisi, Özel Algı Eğitimi

const MOCK_PREVIEW_ROWS: Record<ImportType, ImportPreviewRow[]> = {
  students: [
    {
      rowNumber: 2, displayText: "Mehmet Kaya — Bireysel Eğitim", status: "valid", issues: [],
      entityMatches: [m("Öğrenci", "Mehmet Kaya", false), m("Eğitim Türü", "Bireysel Eğitim", true)],
    },
    {
      rowNumber: 3, displayText: "Elif Yılmaz — Dil Terapisi", status: "valid", issues: [],
      entityMatches: [m("Öğrenci", "Elif Yılmaz", false), m("Eğitim Türü", "Dil Terapisi", true)],
    },
    {
      rowNumber: 4, displayText: "Zeynep Demir — Grup Eğitimi", status: "valid", issues: [],
      entityMatches: [m("Öğrenci", "Zeynep Demir", false), m("Eğitim Türü", "Grup Eğitimi", true)],
    },
    {
      rowNumber: 5, displayText: "Can Çelik — Davranış Terapisi", status: "valid", issues: [],
      entityMatches: [m("Öğrenci", "Can Çelik", false), m("Eğitim Türü", "Davranış Terapisi", false)],
    },
    {
      rowNumber: 6,
      displayText: "Yusuf Çelik — Bireysel Eğitim",
      status: "warning",
      issues: ["Bu isimde bir öğrenci zaten sistemde kayıtlı"],
      entityMatches: [m("Öğrenci", "Yusuf Çelik", true), m("Eğitim Türü", "Bireysel Eğitim", true)],
    },
    {
      rowNumber: 7,
      displayText: "Ayşe Şahin — Konuşma Terapisi",
      status: "warning",
      issues: ["'Konuşma Terapisi' eğitim türü sistemde bulunamadı, eşleştirme yapılamadı"],
      entityMatches: [m("Öğrenci", "Ayşe Şahin", false), m("Eğitim Türü", "Konuşma Terapisi", false)],
    },
    {
      rowNumber: 8,
      displayText: "(Ad boş) — Bireysel Eğitim",
      status: "error",
      issues: ["'Öğrenci Adı Soyadı' zorunlu alan boş bırakılamaz"],
      entityMatches: [],
    },
    {
      rowNumber: 9, displayText: "Ali Öztürk — Dil Terapisi", status: "valid", issues: [],
      entityMatches: [m("Öğrenci", "Ali Öztürk", false), m("Eğitim Türü", "Dil Terapisi", true)],
    },
  ],
  sessions: [
    {
      rowNumber: 2, displayText: "Yusuf Çelik / Ayşe Yılmaz / 15.05.2026", status: "valid", issues: [],
      entityMatches: [m("Öğrenci", "Yusuf Çelik", true), m("Öğretmen", "Ayşe Yılmaz", true), m("Eğitim Türü", "Dil Terapisi", true)],
    },
    {
      rowNumber: 3, displayText: "Elif Arslan / Mehmet Kara / 15.05.2026", status: "valid", issues: [],
      entityMatches: [m("Öğrenci", "Elif Arslan", true), m("Öğretmen", "Mehmet Kara", true), m("Eğitim Türü", "Bireysel Eğitim", true)],
    },
    {
      rowNumber: 4, displayText: "Ahmet Koç / Elif Demir / 16.05.2026", status: "valid", issues: [],
      entityMatches: [m("Öğrenci", "Ahmet Koç", true), m("Öğretmen", "Elif Demir", true), m("Eğitim Türü", "Özel Algı Eğitimi", true)],
    },
    {
      rowNumber: 5, displayText: "Mert Doğan / Ayşe Yılmaz / 17.05.2026", status: "valid", issues: [],
      entityMatches: [m("Öğrenci", "Mert Doğan", true), m("Öğretmen", "Ayşe Yılmaz", true), m("Eğitim Türü", "Dil Terapisi", true)],
    },
    {
      rowNumber: 6,
      displayText: "Büşra Kaya / Canan Hoca / 18.05.2026",
      status: "warning",
      issues: ["'Canan Hoca' adlı öğretmen sistemde bulunamadı"],
      entityMatches: [m("Öğrenci", "Büşra Kaya", false), m("Öğretmen", "Canan Hoca", false)],
    },
    {
      rowNumber: 7, displayText: "Selin Koç / Can Şahin / 19.05.2026", status: "valid", issues: [],
      entityMatches: [m("Öğrenci", "Selin Koç", true), m("Öğretmen", "Can Şahin", true)],
    },
    {
      rowNumber: 8,
      displayText: "Yusuf Çelik / Mehmet Kara / 32.05.2026",
      status: "error",
      issues: ["Geçersiz tarih formatı: '32/05/2026'"],
      entityMatches: [m("Öğrenci", "Yusuf Çelik", true), m("Öğretmen", "Mehmet Kara", true)],
    },
    {
      rowNumber: 9, displayText: "Elif Arslan / Elif Demir / 20.05.2026", status: "valid", issues: [],
      entityMatches: [m("Öğrenci", "Elif Arslan", true), m("Öğretmen", "Elif Demir", true)],
    },
    {
      rowNumber: 10,
      displayText: "Ahmet Koç / Mehmet Kara / 21.05.2026",
      status: "error",
      issues: ["'Fiyat (₺)' sütunu eşleştirilmedi; birim fiyat zorunludur"],
      entityMatches: [m("Öğrenci", "Ahmet Koç", true), m("Öğretmen", "Mehmet Kara", true)],
    },
    {
      rowNumber: 11,
      displayText: "Selin Koç / Ayşe Yılmaz / 22.05.2026",
      status: "warning",
      issues: ["Öğrenci adı birden fazla kayıtla eşleşti, ilk kayıt seçilecek"],
      entityMatches: [m("Öğrenci", "Selin Koç", true), m("Öğretmen", "Ayşe Yılmaz", true)],
    },
  ],
  payments: [
    {
      rowNumber: 2, displayText: "Yusuf Çelik — ₺1.500,00", status: "valid", issues: [],
      entityMatches: [m("Öğrenci", "Yusuf Çelik", true), m("Veli", "Fatma Çelik", true)],
    },
    {
      rowNumber: 3, displayText: "Elif Arslan — ₺2.000,00", status: "valid", issues: [],
      entityMatches: [m("Öğrenci", "Elif Arslan", true), m("Veli", "Ali Arslan", true)],
    },
    {
      rowNumber: 4,
      displayText: "Ahmet Koç — ₺2.500,00",
      status: "warning",
      issues: ["Ödeme tutarı mevcut borçtan fazla (₺2.500 > ₺1.800)"],
      entityMatches: [m("Öğrenci", "Ahmet Koç", true), m("Veli", "Zeynep Koç", true)],
    },
    {
      rowNumber: 5, displayText: "Selin Koç — ₺800,00", status: "valid", issues: [],
      entityMatches: [m("Öğrenci", "Selin Koç", true), m("Veli", "Zeynep Koç", true)],
    },
    {
      rowNumber: 6,
      displayText: "Hasan Çetin — ₺1.200,00",
      status: "error",
      issues: ["'Hasan Çetin' adlı öğrenci sistemde bulunamadı"],
      entityMatches: [m("Öğrenci", "Hasan Çetin", false)],
    },
    {
      rowNumber: 7, displayText: "Zehra Aktaş — ₺600,00", status: "valid", issues: [],
      entityMatches: [m("Öğrenci", "Zehra Aktaş", true)],
    },
    {
      rowNumber: 8, displayText: "Mert Doğan — ₺1.000,00", status: "valid", issues: [],
      entityMatches: [m("Öğrenci", "Mert Doğan", true), m("Veli", "Hasan Doğan", true)],
    },
  ],
  "teacher-earnings": [
    {
      rowNumber: 2, displayText: "Ayşe Yılmaz — Yusuf Çelik — ₺225,00", status: "valid", issues: [],
      entityMatches: [m("Öğretmen", "Ayşe Yılmaz", true), m("Öğrenci", "Yusuf Çelik", true)],
    },
    {
      rowNumber: 3, displayText: "Mehmet Kara — Elif Arslan — ₺200,00", status: "valid", issues: [],
      entityMatches: [m("Öğretmen", "Mehmet Kara", true), m("Öğrenci", "Elif Arslan", true)],
    },
    {
      rowNumber: 4, displayText: "Elif Demir — Ahmet Koç — ₺250,00", status: "valid", issues: [],
      entityMatches: [m("Öğretmen", "Elif Demir", true), m("Öğrenci", "Ahmet Koç", true)],
    },
    {
      rowNumber: 5,
      displayText: "Can Şahin — Mert Doğan — ₺225,00",
      status: "warning",
      issues: ["Eşleşen seans kaydı bulunamadı; yeni hakediş kaydı olarak eklenecek"],
      entityMatches: [m("Öğretmen", "Can Şahin", true), m("Öğrenci", "Mert Doğan", true)],
    },
    {
      rowNumber: 6, displayText: "Ayşe Yılmaz — Selin Koç — ₺225,00", status: "valid", issues: [],
      entityMatches: [m("Öğretmen", "Ayşe Yılmaz", true), m("Öğrenci", "Selin Koç", true)],
    },
    {
      rowNumber: 7,
      displayText: "(Ad boş) — Zehra Aktaş — ₺250,00",
      status: "error",
      issues: ["'Öğretmen' zorunlu alan boş bırakılamaz"],
      entityMatches: [m("Öğrenci", "Zehra Aktaş", true)],
    },
  ],
};

// ─── Exported helpers ─────────────────────────────────────────────────────────

export function getImportTypeLabel(type: ImportType): string {
  const labels: Record<ImportType, string> = {
    students: "Öğrenci Listesi",
    sessions: "Seans Takibi",
    payments: "Ödeme Takibi",
    "teacher-earnings": "Öğretmen Hakedişleri",
  };
  return labels[type];
}

export function getSystemFieldsForImportType(type: ImportType): ImportSystemField[] {
  return SYSTEM_FIELDS[type];
}

export function buildMockColumnMappings(type: ImportType): ImportColumnMapping[] {
  const cols = MOCK_EXCEL_COLUMNS[type];
  const initialMaps = INITIAL_MAPPINGS[type];
  return cols.map(({ column, sampleData }) => ({
    excelColumn: column,
    systemField: initialMaps[column] ?? null,
    sampleData,
  }));
}

export function buildImportPreviewRows(type: ImportType): ImportPreviewRow[] {
  return MOCK_PREVIEW_ROWS[type];
}

export function buildImportSummary(rows: ImportPreviewRow[]): ImportSummary {
  return {
    totalRows: rows.length,
    validRows: rows.filter((r) => r.status === "valid").length,
    warningRows: rows.filter((r) => r.status === "warning").length,
    errorRows: rows.filter((r) => r.status === "error").length,
  };
}
