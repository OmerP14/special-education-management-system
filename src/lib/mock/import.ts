import type { ImportType } from "@/types";

export const MOCK_FILE_NAMES: Record<ImportType, string> = {
  students: "ogrenci_listesi_haziran_2026.xlsx",
  sessions: "seans_takibi_mayis_haziran.xlsx",
  payments: "odeme_kayitlari_2026.xlsx",
  "teacher-earnings": "ogretmen_hakedisleri_2026.xlsx",
};

export const MOCK_EXCEL_COLUMNS: Record<
  ImportType,
  Array<{ column: string; sampleData: string }>
> = {
  students: [
    { column: "Ad Soyad", sampleData: "Mehmet Kaya" },
    { column: "Veli Adı", sampleData: "Ahmet Kaya" },
    { column: "Telefon", sampleData: "0532 111 2233" },
    { column: "Eğitim Türü", sampleData: "Özel Eğitim" },
    { column: "Seans/Hafta", sampleData: "2" },
    { column: "Aktif/Pasif", sampleData: "Aktif" },
    { column: "Notlar", sampleData: "Dikkat eksikliği var" },
  ],
  sessions: [
    { column: "Öğrenci Adı", sampleData: "Mehmet Kaya" },
    { column: "Öğretmen", sampleData: "Elif Şahin" },
    { column: "Eğitim", sampleData: "Dil Terapisi" },
    { column: "Tarih", sampleData: "15/05/2026" },
    { column: "Saat", sampleData: "10:00" },
    { column: "Adet", sampleData: "1" },
    { column: "Fiyat (₺)", sampleData: "200" },
    { column: "Hakediş (₺)", sampleData: "150" },
    { column: "Durum", sampleData: "Tamamlandı" },
  ],
  payments: [
    { column: "Öğrenci", sampleData: "Mehmet Kaya" },
    { column: "Tutar (₺)", sampleData: "1.500" },
    { column: "Tarih", sampleData: "01/06/2026" },
    { column: "Ödeme Şekli", sampleData: "Nakit" },
    { column: "Notlar", sampleData: "" },
  ],
  "teacher-earnings": [
    { column: "Öğretmen Adı", sampleData: "Elif Şahin" },
    { column: "Öğrenci", sampleData: "Mehmet Kaya" },
    { column: "Seans Tarihi", sampleData: "15/05/2026" },
    { column: "Hakediş (₺)", sampleData: "150" },
    { column: "Ödendi mi?", sampleData: "Evet" },
  ],
};
