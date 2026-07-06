"use client";

import type { LucideIcon } from "lucide-react";
import { FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/shared/StatCard";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { downloadCsv, printHtmlReport, type PrintReportColumn } from "@/lib/helpers/export";

export interface ReportSummaryCard {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  variant?: "default" | "success" | "warning" | "danger";
}

export interface ReportViewerProps<T> {
  /** Small context line above the summary cards, e.g. the active period label. */
  note?: string;
  summaryCards?: ReportSummaryCard[];
  columns: Column<T>[];
  rows: T[];
  keyExtractor: (row: T) => string;
  emptyTitle?: string;
  emptyDescription?: string;
  csv: {
    filename: string;
    headers: string[];
    rowMapper: (row: T) => (string | number)[];
  };
  pdf: {
    title: string;
    subtitle?: string;
    columns: PrintReportColumn[];
    rowMapper: (row: T) => string[];
  };
}

/**
 * The single reusable report shell every report in the Reports module renders
 * through: summary cards → export buttons → table. Filtering happens upstream
 * (see reports.ts) — this component only presents already-filtered rows, so CSV/PDF
 * exports always match exactly what's on screen.
 */
export function ReportViewer<T>({
  note,
  summaryCards = [],
  columns,
  rows,
  keyExtractor,
  emptyTitle,
  emptyDescription,
  csv,
  pdf,
}: ReportViewerProps<T>) {
  const handleExportCsv = () => {
    downloadCsv(csv.filename, csv.headers, rows.map(csv.rowMapper));
  };

  const handleExportPdf = () => {
    printHtmlReport({
      title: pdf.title,
      subtitle: pdf.subtitle,
      summary: summaryCards.map((c) => ({ label: c.title, value: String(c.value) })),
      columns: pdf.columns,
      rows: rows.map(pdf.rowMapper),
    });
  };

  return (
    <div className="space-y-4">
      {note && <p className="text-xs text-muted-foreground">{note}</p>}

      {summaryCards.length > 0 && (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {summaryCards.map((card) => (
            <StatCard
              key={card.title}
              title={card.title}
              value={card.value}
              description={card.description}
              icon={card.icon}
              variant={card.variant ?? "default"}
            />
          ))}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={handleExportCsv}
          disabled={rows.length === 0}
        >
          <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />
          Excel&apos;e Aktar
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleExportPdf}
          disabled={rows.length === 0}
        >
          <FileText className="h-3.5 w-3.5 mr-1.5" />
          PDF Rapor
        </Button>
      </div>

      <DataTable
        data={rows}
        columns={columns}
        keyExtractor={keyExtractor}
        emptyTitle={emptyTitle ?? "Kayıt bulunamadı"}
        emptyDescription={emptyDescription ?? "Seçilen filtrelerde veri mevcut değil."}
      />
    </div>
  );
}
