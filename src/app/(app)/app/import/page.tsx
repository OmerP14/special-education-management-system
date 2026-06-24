"use client";

import { useState, useMemo, Fragment } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Upload,
  FileCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronRight,
  ChevronLeft,
  Users,
  CalendarDays,
  CreditCard,
  Banknote,
  RotateCcw,
  Table2,
  FileWarning,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { cn } from "@/lib/utils";
import type {
  ImportType,
  ImportColumnMapping,
  ImportPreviewRow,
  ImportRowStatus,
} from "@/types";
import {
  getImportTypeLabel,
  getSystemFieldsForImportType,
  buildMockColumnMappings,
  buildImportPreviewRows,
  buildImportSummary,
} from "@/lib/helpers/import";
import { MOCK_FILE_NAMES } from "@/lib/mock/import";

// ─── Constants ────────────────────────────────────────────────────────────────

const IMPORT_TYPES: Array<{
  type: ImportType;
  icon: LucideIcon;
  description: string;
}> = [
  { type: "students", icon: Users, description: "Öğrenci listesi ve veli bilgileri" },
  { type: "sessions", icon: CalendarDays, description: "Seans kayıtları ve fiyat bilgileri" },
  { type: "payments", icon: CreditCard, description: "Ödeme geçmişi ve tutarlar" },
  { type: "teacher-earnings", icon: Banknote, description: "Öğretmen hakediş kayıtları" },
];

const WIZARD_STEPS = [
  { key: "upload", label: "Dosya Yükle" },
  { key: "mapping", label: "Kolon Eşleştir" },
  { key: "preview", label: "Önizleme ve Onay" },
];

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
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
      <XCircle className="h-3 w-3" />
      Hata
    </span>
  );
}

// Button helpers — use Tailwind directly to avoid component API uncertainty
const btnPrimary =
  "inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:pointer-events-none";
const btnOutline =
  "inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-input bg-background text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ImportPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [importType, setImportType] = useState<ImportType>("students");
  const [mockFile, setMockFile] = useState<string | null>(null);
  const [mappings, setMappings] = useState<ImportColumnMapping[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [importConfirmed, setImportConfirmed] = useState(false);

  // ── Derived ────────────────────────────────────────────────────────────────

  const systemFields = useMemo(() => getSystemFieldsForImportType(importType), [importType]);

  const mappedFieldKeys = useMemo(
    () => mappings.map((m) => m.systemField).filter((f): f is string => f !== null),
    [mappings]
  );

  const unmappedRequiredFields = useMemo(
    () => systemFields.filter((f) => f.required && !mappedFieldKeys.includes(f.key)),
    [systemFields, mappedFieldKeys]
  );

  const previewRows = useMemo(() => buildImportPreviewRows(importType), [importType]);
  const summary = useMemo(() => buildImportSummary(previewRows), [previewRows]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleImportTypeChange(type: ImportType) {
    setImportType(type);
    setMockFile(null);
  }

  function handleSimulateUpload() {
    setMockFile(MOCK_FILE_NAMES[importType]);
  }

  function handleProceedToMapping() {
    setMappings(buildMockColumnMappings(importType));
    setStep(2);
  }

  function handleUpdateMapping(index: number, value: string) {
    setMappings((prev) =>
      prev.map((m, i) =>
        i === index ? { ...m, systemField: value === "" ? null : value } : m
      )
    );
  }

  function handleConfirmImport() {
    setImportConfirmed(true);
  }

  function handleReset() {
    setStep(1);
    setImportType("students");
    setMockFile(null);
    setMappings([]);
    setImportConfirmed(false);
  }

  // ── Preview table columns ──────────────────────────────────────────────────

  const previewColumns: Column<ImportPreviewRow>[] = [
    {
      key: "row",
      header: "#",
      render: (row) => (
        <span className="tabular-nums text-xs text-muted-foreground">
          {row.rowNumber}
        </span>
      ),
      className: "w-12",
      headerClassName: "w-12",
    },
    {
      key: "data",
      header: "Veri Özeti",
      render: (row) => (
        <div>
          <span
            className={cn(
              "text-sm font-medium",
              row.status === "error"
                ? "text-destructive"
                : row.status === "warning"
                ? "text-amber-700"
                : "text-foreground"
            )}
          >
            {row.displayText}
          </span>
          {row.entityMatches.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {row.entityMatches.map((match, i) => (
                <span
                  key={i}
                  className={cn(
                    "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium",
                    match.matched
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
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
      render: (row) => <ImportRowBadge status={row.status} />,
      className: "w-28",
      headerClassName: "w-28",
    },
    {
      key: "issues",
      header: "Açıklama",
      render: (row) =>
        row.issues.length > 0 ? (
          <span className="text-xs text-muted-foreground">{row.issues.join("; ")}</span>
        ) : (
          <span className="text-muted-foreground/30 text-xs">—</span>
        ),
      className: "hidden md:table-cell",
      headerClassName: "hidden md:table-cell",
    },
  ];

  // ── Step indicator ─────────────────────────────────────────────────────────

  const stepIndicator = (
    <div className="flex items-center gap-0">
      {WIZARD_STEPS.map((s, i) => {
        const stepNum = i + 1;
        const isCompleted = step > stepNum;
        const isActive = step === stepNum;
        return (
          <Fragment key={s.key}>
            {i > 0 && (
              <div
                className={cn(
                  "flex-1 h-px min-w-8",
                  step > i ? "bg-primary" : "bg-border"
                )}
              />
            )}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                  isCompleted || isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  stepNum
                )}
              </div>
              <span
                className={cn(
                  "text-xs font-medium whitespace-nowrap",
                  isActive ? "text-primary" : isCompleted ? "text-primary/70" : "text-muted-foreground"
                )}
              >
                {s.label}
              </span>
            </div>
          </Fragment>
        );
      })}
    </div>
  );

  // ── Success screen ─────────────────────────────────────────────────────────

  if (importConfirmed) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Excel Aktarımı"
          description="Mevcut Excel verilerinizi sisteme aktarın"
        />
        <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="h-7 w-7 text-emerald-600" />
          </div>
          <h2 className="mb-1 text-xl font-bold text-emerald-900">
            Aktarım Başarıyla Tamamlandı
          </h2>
          <p className="mb-0.5 text-emerald-700 font-medium">
            {getImportTypeLabel(importType)}
          </p>
          <p className="text-emerald-700 text-sm mb-2">
            {summary.totalRows} satırdan{" "}
            <span className="font-semibold">{summary.validRows}</span> tanesi başarıyla aktarıldı.
          </p>
          {summary.warningRows > 0 && (
            <p className="text-amber-700 text-sm mb-4">
              {summary.warningRows} satır uyarıyla aktarıldı — ilgili modülleri kontrol edin.
            </p>
          )}
          <button className={btnOutline} onClick={handleReset}>
            <RotateCcw className="h-4 w-4" />
            Yeni Aktarım Başlat
          </button>
        </div>
      </div>
    );
  }

  // ── Step 1: Upload ─────────────────────────────────────────────────────────

  const step1 = (
    <div className="space-y-5">
      {/* Import type selector */}
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="mb-3 text-sm font-semibold text-foreground">Aktarım Türü</p>
        <div className="grid grid-cols-2 gap-3">
          {IMPORT_TYPES.map(({ type, icon: Icon, description }) => (
            <button
              key={type}
              onClick={() => handleImportTypeChange(type)}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3.5 text-left transition-colors",
                importType === type
                  ? "border-primary bg-primary/5 text-foreground"
                  : "border-border bg-background hover:border-primary/40 hover:bg-muted/30 text-muted-foreground"
              )}
            >
              <Icon
                className={cn(
                  "mt-0.5 h-4 w-4 shrink-0",
                  importType === type ? "text-primary" : "text-muted-foreground"
                )}
              />
              <div>
                <p
                  className={cn(
                    "text-sm font-medium leading-none",
                    importType === type ? "text-foreground" : "text-foreground/70"
                  )}
                >
                  {getImportTypeLabel(type)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Dropzone */}
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="mb-3 text-sm font-semibold text-foreground">Dosya Seçin</p>
        {mockFile ? (
          <div className="flex items-center gap-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100">
              <FileCheck className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{mockFile}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {getImportTypeLabel(importType)} · Hazır
              </p>
            </div>
            <button
              onClick={() => setMockFile(null)}
              className="shrink-0 text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
            >
              Dosyayı Kaldır
            </button>
          </div>
        ) : (
          <div
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-12 px-6 text-center transition-colors select-none",
              isDragging
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 hover:bg-muted/20"
            )}
            onClick={handleSimulateUpload}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              handleSimulateUpload();
            }}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
              <Upload className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                Dosya seçmek için tıklayın veya sürükleyip bırakın
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                .xlsx ve .xls dosyaları desteklenmektedir
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Action */}
      <div className="flex justify-end">
        <button
          className={btnPrimary}
          disabled={!mockFile}
          onClick={handleProceedToMapping}
        >
          Devam
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  // ── Step 2: Column mapping ─────────────────────────────────────────────────

  const step2 = (
    <div className="space-y-4">
      {/* File info */}
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <FileCheck className="h-4 w-4 text-emerald-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{mockFile}</p>
          <p className="text-xs text-muted-foreground">
            {mappings.length} sütun tespit edildi · {getImportTypeLabel(importType)}
          </p>
        </div>
      </div>

      {/* Mapping table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="border-b border-border/60 px-5 py-4">
          <p className="text-sm font-semibold text-foreground">Kolon Eşleştirme</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Her Excel sütununu karşılık gelen sistem alanıyla eşleştirin
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Excel Kolonu
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Sistem Alanı
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">
                  Örnek Veri
                </th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell w-28">
                  Zorunlu mu?
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide w-28">
                  Durum
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {mappings.map((mapping, i) => {
                const field = systemFields.find((f) => f.key === mapping.systemField);
                return (
                  <tr
                    key={mapping.excelColumn}
                    className="hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-0.5 text-xs font-medium font-mono text-foreground">
                        <Table2 className="h-3 w-3 text-muted-foreground" />
                        {mapping.excelColumn}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={mapping.systemField ?? ""}
                        onChange={(e) => handleUpdateMapping(i, e.target.value)}
                        className="h-8 w-full min-w-[160px] rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="">— Eşleştirme Yok —</option>
                        {systemFields.map((f) => (
                          <option key={f.key} value={f.key}>
                            {f.label}
                            {f.required ? " *" : ""}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-xs text-muted-foreground">
                        {mapping.sampleData || (
                          <span className="text-muted-foreground/40">(boş)</span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center hidden md:table-cell">
                      {field ? (
                        <span
                          className={cn(
                            "text-xs font-medium",
                            field.required ? "text-destructive" : "text-muted-foreground"
                          )}
                        >
                          {field.required ? "Evet" : "Hayır"}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/40 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {mapping.systemField ? (
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

        {/* Unmapped required fields warning */}
        {unmappedRequiredFields.length > 0 && (
          <div className="mx-4 mb-4 mt-2 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5">
            <FileWarning className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-amber-800">Zorunlu alanlar eşleştirilmedi</p>
              <p className="text-xs text-amber-700 mt-0.5">
                {unmappedRequiredFields.map((f) => f.label).join(", ")}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button className={btnOutline} onClick={() => setStep(1)}>
          <ChevronLeft className="h-4 w-4" />
          Geri
        </button>
        <button className={btnPrimary} onClick={() => setStep(3)}>
          Önizlemeye Geç
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  // ── Step 3: Preview & confirm ──────────────────────────────────────────────

  const step3 = (
    <div className="space-y-5">
      {/* Summary stat cards */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <StatCard
          title="Toplam Satır"
          value={summary.totalRows}
          description="Dosyadan okunan"
          icon={Table2}
          variant="default"
        />
        <StatCard
          title="Geçerli"
          value={summary.validRows}
          description="Aktarılabilir"
          icon={CheckCircle2}
          variant="success"
        />
        <StatCard
          title="Uyarılı"
          value={summary.warningRows}
          description="Uyarıyla aktarılır"
          icon={AlertTriangle}
          variant={summary.warningRows > 0 ? "warning" : "success"}
        />
        <StatCard
          title="Hatalı"
          value={summary.errorRows}
          description="Aktarılamaz"
          icon={XCircle}
          variant={summary.errorRows > 0 ? "danger" : "success"}
        />
      </div>

      {/* Error banner */}
      {summary.errorRows > 0 && (
        <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <p className="text-sm text-destructive">
            <span className="font-semibold">{summary.errorRows} hatalı satır</span> aktarım
            yapılmasını engelliyor. Kolon eşleştirmeyi düzeltin veya kaynak Excel dosyasını
            güncelleyin.
          </p>
        </div>
      )}

      {/* Preview table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="border-b border-border/60 px-5 py-4">
          <p className="text-sm font-semibold text-foreground">Veri Önizleme</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {getImportTypeLabel(importType)} · Satır başına doğrulama sonuçları
          </p>
        </div>
        <DataTable
          data={previewRows}
          columns={previewColumns}
          keyExtractor={(r) => String(r.rowNumber)}
          emptyTitle="Önizleme verisi yok"
          emptyDescription="Seçilen aktarım türü için önizleme verisi bulunamadı."
        />
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button className={btnOutline} onClick={() => setStep(2)}>
          <ChevronLeft className="h-4 w-4" />
          Geri
        </button>
        <div className="flex items-center gap-3">
          {summary.errorRows > 0 && (
            <p className="text-xs text-muted-foreground hidden sm:block">
              Hataları giderin veya hatalı satırları atlayarak devam edin
            </p>
          )}
          <button
            className={btnPrimary}
            disabled={summary.errorRows > 0}
            onClick={handleConfirmImport}
          >
            <CheckCircle2 className="h-4 w-4" />
            Aktarımı Onayla
          </button>
        </div>
      </div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader
        title="Excel Aktarımı"
        description="Mevcut Excel verilerinizi sisteme aktarın ve kayıt oluşturmaya başlayın"
      />

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
        <Table2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <p className="text-sm text-foreground/80">
          Mevcut Excel tablolarınızı doğrudan bu sisteme aktarabilirsiniz. Sıfırdan başlamak
          yerine geçmiş kayıtlarınızı birkaç adımda taşıyın.
        </p>
      </div>

      {/* Step indicator */}
      <div className="rounded-xl border border-border bg-card px-6 py-5">
        {stepIndicator}
      </div>

      {/* Step content */}
      {step === 1 && step1}
      {step === 2 && step2}
      {step === 3 && step3}
    </div>
  );
}
