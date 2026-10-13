import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  detectDelimiter,
  isSupportedImportFile,
  parseCellAsDateString,
  parseCellAsNumber,
  parseSpreadsheetFile,
  sheetRowNumber,
  type RawCell,
} from "@/lib/helpers/import-parse";
import { detectHeaderRowIndex, normalizeTableSheet, prepareSheetsForImport } from "@/lib/helpers/import-table";
import { suggestColumnMappings } from "@/lib/helpers/import";

type Merge = { s: { r: number; c: number }; e: { r: number; c: number } };

function workbookFile(
  sheets: { name: string; aoa: RawCell[][]; merges?: Merge[] }[],
  fileName = "dosya.xlsx",
  bookType: XLSX.BookType = "xlsx"
): File {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.aoa);
    if (s.merges) ws["!merges"] = s.merges;
    XLSX.utils.book_append_sheet(wb, ws, s.name);
  }
  const data = XLSX.write(wb, { type: "array", bookType }) as ArrayBuffer;
  return new File([data], fileName);
}

/** Windows-1254 bytes for the Turkish letters used below. */
const CP1254: Record<string, number> = { Ö: 0xd6, ö: 0xf6, Ğ: 0xd0, ğ: 0xf0, İ: 0xdd, ı: 0xfd, Ş: 0xde, ş: 0xfe, Ç: 0xc7, ç: 0xe7, Ü: 0xdc, ü: 0xfc };
const encode1254 = (text: string) => new Uint8Array([...text].map((ch) => CP1254[ch] ?? ch.charCodeAt(0)));

describe("reading any file", () => {
  it("accepts every spreadsheet and text format, case-insensitively", () => {
    for (const name of ["a.xlsx", "a.XLS", "a.xlsm", "a.xlsb", "a.ods", "a.numbers", "a.csv", "a.tsv", "a.txt"]) {
      expect(isSupportedImportFile(name), name).toBe(true);
    }
    expect(isSupportedImportFile("a.pdf")).toBe(false);
    expect(isSupportedImportFile("a.docx")).toBe(false);
  });

  it("reads a Turkish Windows-1254 CSV with ; and keeps Excel row numbers", async () => {
    const text = "Öğrenci Adı;Veli;Şube\r\nAyşe Çelik;Gül Işık;Üsküdar\r\n\r\nİsmail Öz;Can Öz;Ataşehir\r\n";
    const [sheet] = await parseSpreadsheetFile(new File([encode1254(text)], "liste.csv"));
    expect(sheet!.headers).toEqual(["Öğrenci Adı", "Veli", "Şube"]);
    expect(sheet!.rows).toEqual([
      ["Ayşe Çelik", "Gül Işık", "Üsküdar"],
      ["İsmail Öz", "Can Öz", "Ataşehir"],
    ]);
    // The blank line is row 3, so İsmail is on row 4.
    expect(sheet!.rows.map((_, i) => sheetRowNumber(sheet!, i))).toEqual([2, 4]);
  });

  it("detects tab, pipe and comma delimiters", async () => {
    expect(detectDelimiter("a\tb\tc\n1\t2\t3")).toBe("\t");
    expect(detectDelimiter("a|b|c\n1|2|3")).toBe("|");
    expect(detectDelimiter("ad,soyad\nAli,Kaya")).toBe(",");
    expect(detectDelimiter("ad;tutar\nAli;1.500,50")).toBe(";");
    const [sheet] = await parseSpreadsheetFile(new File(["Ad\tTutar\nAli\t1.500,50\n"], "x.tsv"));
    expect(sheet!.headers).toEqual(["Ad", "Tutar"]);
    expect(parseCellAsNumber(sheet!.rows[0]![1]!)).toBe(1500.5);
  });

  it("reads .ods and .xls the same as .xlsx", async () => {
    const aoa = [["Ad Soyad", "Telefon"], ["Ali Kaya", "0532 111 22 33"]];
    for (const [name, type] of [["a.ods", "ods"], ["a.xls", "biff8"]] as const) {
      const [sheet] = await parseSpreadsheetFile(workbookFile([{ name: "Liste", aoa }], name, type));
      expect(sheet!.headers, name).toEqual(["Ad Soyad", "Telefon"]);
      expect(sheet!.rows[0]![0], name).toBe("Ali Kaya");
    }
  });

  it("explains a file that isn't a spreadsheet", async () => {
    await expect(parseSpreadsheetFile(new File([new Uint8Array([1, 2, 3, 4, 5])], "bozuk.xlsx"))).rejects.toThrow(/okunamadı|bozuk/i);
  });
});

describe("cleaning a messy table", () => {
  it("finds the header under title rows, drops blank rows, repeated headers and empty columns", async () => {
    const aoa: RawCell[][] = [
      ["ABC ÖZEL EĞİTİM MERKEZİ", "", "", "", ""],
      ["Öğrenci Listesi — Ekim 2026", "", "", "", ""],
      [],
      ["Sıra", "Adı Soyadı", "", "Telefon", "Telefon"],
      [1, "Ali Kaya", "", "0532 000 00 01", "0212 000 00 01"],
      [],
      ["Sıra", "Adı Soyadı", "", "Telefon", "Telefon"],
      [2, "Ayşe Demir", "not var", "0532 000 00 02", ""],
    ];
    const [raw] = await parseSpreadsheetFile(
      workbookFile([{ name: "Sayfa1", aoa, merges: [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }] }])
    );
    const t = normalizeTableSheet(raw!);
    expect(t.headers).toEqual(["Sıra", "Adı Soyadı", "Sütun C", "Telefon", "Telefon (2)"]);
    expect(t.rows.map((r) => r[1])).toEqual(["Ali Kaya", "Ayşe Demir"]);
    expect(t.rows[1]![2]).toBe("not var");
    expect(t.headerRowNumber).toBe(4);
    expect(t.rows.map((_, i) => sheetRowNumber(t, i))).toEqual([5, 8]);
  });

  it("joins a two-row header and fills merged group labels", async () => {
    const aoa: RawCell[][] = [
      ["Öğrenci", "Kayıt", "Ödeme", ""],
      ["", "Tarih", "Tarih", "Tutar"],
      ["Ali Kaya", "01.09.2026", "05.09.2026", "1.500"],
    ];
    const [raw] = await parseSpreadsheetFile(
      workbookFile([{ name: "S", aoa, merges: [{ s: { r: 0, c: 2 }, e: { r: 0, c: 3 } }] }])
    );
    const t = normalizeTableSheet(raw!);
    expect(t.headers).toEqual(["Öğrenci", "Kayıt Tarih", "Ödeme Tarih", "Tutar"]);
    expect(parseCellAsNumber(t.rows[0]![3]!)).toBe(1500);
  });

  it("copies a merged name down its rows but never a merged amount", async () => {
    const aoa: RawCell[][] = [
      ["Öğrenci", "Tarih", "Tutar"],
      ["Ali Kaya", "01.10.2026", 3000],
      ["", "08.10.2026", ""],
      ["", "15.10.2026", ""],
    ];
    const [raw] = await parseSpreadsheetFile(
      workbookFile([
        {
          name: "S",
          aoa,
          merges: [
            { s: { r: 1, c: 0 }, e: { r: 3, c: 0 } },
            { s: { r: 1, c: 2 }, e: { r: 3, c: 2 } },
          ],
        },
      ])
    );
    const t = normalizeTableSheet(raw!);
    expect(t.rows.map((r) => r[0])).toEqual(["Ali Kaya", "Ali Kaya", "Ali Kaya"]);
    expect(t.rows.map((r) => r[2])).toEqual([3000, "", ""]);
  });

  it("keeps the first row as header for an ordinary table and allows overriding it", () => {
    const grid: RawCell[][] = [["Ad", "Tutar"], ["Ali", 100], ["Veli", 200]];
    expect(detectHeaderRowIndex(grid)).toBe(0);
    const t = normalizeTableSheet({ name: "x", headers: ["Ad", "Tutar"], rows: [["Ali", 100], ["Veli", 200]] }, 1);
    expect(t.headers).toEqual(["Ali", "100"]);
    expect(t.rows).toEqual([["Veli", 200]]);
  });

  it("leaves per-student ledger sheets as written", () => {
    const ledger = {
      name: "Ali Kaya",
      headers: ["ÖĞRENCİ ADI SOYADI: Ali Kaya", "", ""],
      rows: [
        ["ÖĞRETMEN: Ayşe Öz", "", ""],
        ["HAFTALIK DERS SAYISI: 2", "", ""],
        ["TARİH", "DERS SAATİ", "DERS ÜCRETİ", "TUTAR"],
        ["01.10.2026", 1, 400, 400],
      ] as RawCell[][],
    };
    const plain = { name: "Ödemeler", headers: ["Rapor", ""], rows: [["Ad", "Tutar"], ["Ali", 100]] as RawCell[][] };
    const [l, p] = prepareSheetsForImport([ledger, plain]);
    expect(l).toBe(ledger);
    expect(p!.headers).toEqual(["Ad", "Tutar"]);
  });
});

describe("values", () => {
  it("reads Turkish and international amounts", () => {
    const cases: [RawCell, number | null][] = [
      ["1.500", 1500],
      ["1.500,50", 1500.5],
      ["1500,5", 1500.5],
      ["1,500,000", 1500000],
      ["1500.50", 1500.5],
      ["₺1.250", 1250],
      ["1.250 TL", 1250],
      ["-250", -250],
      ["(250)", -250],
      ["12.000.000", 12000000],
      ["abc", null],
      ["", null],
      [750, 750],
    ];
    for (const [input, expected] of cases) expect(parseCellAsNumber(input), String(input)).toBe(expected);
  });

  it("reads the date formats people type", () => {
    const cases: [RawCell, string | null][] = [
      ["13.10.2026", "2026-10-13"],
      ["13/10/2026", "2026-10-13"],
      ["13.10.26", "2026-10-13"],
      ["2026-10-13", "2026-10-13"],
      ["2026.10.13", "2026-10-13"],
      ["13.10.2026 14:30", "2026-10-13"],
      ["2026-10-13T14:30:00", "2026-10-13"],
      ["13 Ekim 2026", "2026-10-13"],
      ["1 Şubat 2026", "2026-02-01"],
      ["31.02.2026", null],
      ["13 Foo 2026", null],
    ];
    for (const [input, expected] of cases) expect(parseCellAsDateString(input), String(input)).toBe(expected);
  });
});

describe("matching columns by header", () => {
  const fields = (headers: string[], type: Parameters<typeof suggestColumnMappings>[1]) =>
    suggestColumnMappings({ name: "x", headers, rows: [] }, type).map((m) => m.systemField);

  it("understands the headers people actually write", () => {
    expect(fields(["Sıra", "Öğrencinin Adı Soyadı", "Veli Ad Soyad", "Veli Tel", "Doğum Tarihi"], "students")).toEqual([
      null,
      "fullName",
      "guardianName",
      "guardianPhone",
      "birthDate",
    ]);
    expect(fields(["Tarih", "Danışan", "Ödenen Tutar (TL)", "Ödeme Şekli", "Açıklama"], "payments")).toEqual([
      "date",
      "studentName",
      "amount",
      "method",
      "notes",
    ]);
    expect(fields(["ÖĞRENCİ ADI", "KALAN BORÇ"], "openingBalances")).toEqual(["studentName", "amount"]);
    expect(fields(["Ders Tarihi", "Öğrenci", "Terapist", "Ders Ücreti", "Ders Notu"], "sessions")).toEqual([
      "date",
      "studentName",
      "teacherName",
      "studentPrice",
      "notes",
    ]);
  });

  it("gives each field to one column only, the best fit", () => {
    expect(fields(["Kayıt Tarihi", "Ödeme Tarihi", "Öğrenci", "Tutar"], "payments")).toEqual([null, "date", "studentName", "amount"]);
  });
});
