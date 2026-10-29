// ─── Client-side export helpers ────────────────────────────────────────────────
// No external libraries: "Excel" export is a CSV file (opens natively in Excel),
// and "PDF" export opens a print-friendly window using the browser's native
// print-to-PDF flow. Both run entirely client-side with fixed formats (";"
// CSV, A4 portrait, GG.AA.YYYY dates) and take the document header from
// Ayarlar → Kurum Bilgileri (name, logo, contact).

import { getActiveSettings } from "@/lib/settings/runtime";
import { formatCurrency, formatDateDMY, getPaymentMethodLabel } from "@/lib/helpers/finance";
import type { Payment } from "@/types";

/** Text Excel would run as a formula (CSV injection: a guardian named
 *  "=HYPERLINK(…)"). Negative amounts like "-1.250,00 ₺" stay as they are. */
function looksLikeFormula(s: string): boolean {
  return /^[=+@\t\r]/.test(s) || (s.startsWith("-") && !/^-[\d.,\s₺%]+$/.test(s));
}

function escapeCsvCell(value: string | number, delimiter: string): string {
  let s = String(value);
  if (typeof value === "string" && looksLikeFormula(s)) s = `'${s}`;
  return s.includes(delimiter) || /["\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Semicolon: Turkish Excel uses the comma as its decimal separator, so it
 *  splits columns on ";". */
const CSV_DELIMITER = ";";

const RECEIPT_TITLE = "Tahsilat Makbuzu";

/** Builds the CSV text (with Excel's UTF-8 BOM). */
export function buildCsv(headers: string[], rows: (string | number)[][]): string {
  const delimiter = CSV_DELIMITER;
  const lines = [headers, ...rows].map((row) => row.map((cell) => escapeCsvCell(cell, delimiter)).join(delimiter));
  // Leading BOM so Excel opens UTF-8 (Turkish characters) correctly.
  return "﻿" + lines.join("\r\n");
}

/** Saves a Blob as a file download. */
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number)[][]
): void {
  downloadBlob(filename, new Blob([buildCsv(headers, rows)], { type: "text/csv;charset=utf-8;" }));
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface PrintReportSummaryItem {
  label: string;
  value: string;
}

export interface PrintReportColumn {
  header: string;
  align?: "left" | "right";
}

/** Only http(s)/data: image URLs are put into printed documents. */
function safeImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return /^(https?:|data:image\/)/i.test(url.trim()) ? url.trim() : null;
}

/** Institution header block shared by reports and receipts. */
function institutionHeaderHtml(): string {
  const { institution } = getActiveSettings();
  const logo = safeImageUrl(institution.logoUrl);
  const contact = [
    institution.address,
    [institution.district, institution.city].filter(Boolean).join(" / "),
    institution.phone,
    institution.email,
  ]
    .filter((x) => x && x.trim())
    .map((x) => escapeHtml(x))
    .join(" · ");
  return `<div class="inst">
    ${logo ? `<img src="${escapeHtml(logo)}" alt="" class="logo" />` : ""}
    <div>
      <div class="inst-name">${escapeHtml(institution.name)}</div>
      ${contact ? `<div class="inst-meta">${contact}</div>` : ""}
    </div>
  </div>`;
}

function documentStyles(): string {
  return `
  @page { size: A4 portrait; margin: 14mm; }
  body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; padding: 24px; color: #111; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .subtitle { color: #666; font-size: 13px; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { padding: 8px 10px; border-bottom: 1px solid #ddd; text-align: left; }
  th { background: #f5f5f5; text-transform: uppercase; font-size: 11px; letter-spacing: 0.03em; color: #555; }
  td.amount, th.amount { text-align: right; }
  .summary { display: flex; flex-wrap: wrap; gap: 20px; margin-bottom: 20px; }
  .summary div { font-size: 12px; color: #555; }
  .summary strong { display: block; font-size: 15px; margin-top: 2px; color: #111; }
  .inst { display: flex; align-items: center; gap: 12px; padding-bottom: 12px; margin-bottom: 16px; border-bottom: 2px solid #111; }
  .logo { max-height: 48px; max-width: 140px; object-fit: contain; }
  .inst-name { font-size: 15px; font-weight: 700; }
  .inst-meta { font-size: 11px; color: #555; margin-top: 2px; }
  .signs { display: flex; justify-content: space-between; gap: 40px; margin-top: 48px; }
  .sign { flex: 1; text-align: center; font-size: 12px; color: #444; }
  .sign .line { border-top: 1px solid #999; margin-top: 56px; padding-top: 6px; }
  @media print { body { padding: 0; } }`;
}

function openPrintWindow(title: string, bodyHtml: string): void {
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return;
  win.document.write(`<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>${documentStyles()}</style>
</head>
<body>
${bodyHtml}
</body>
</html>`);
  win.document.close();
  win.focus();
  win.print();
}

/**
 * Opens a new window with a minimal, print-ready HTML report and triggers the
 * browser's print dialog — the user picks "Save as PDF" there. All dynamic text
 * is HTML-escaped before being interpolated.
 */
export function printHtmlReport(opts: {
  title: string;
  subtitle?: string;
  summary?: PrintReportSummaryItem[];
  columns: PrintReportColumn[];
  rows: string[][];
}): void {
  const summaryHtml = opts.summary
    ? `<div class="summary">${opts.summary
        .map((s) => `<div>${escapeHtml(s.label)}<strong>${escapeHtml(s.value)}</strong></div>`)
        .join("")}</div>`
    : "";

  const theadHtml = `<tr>${opts.columns
    .map((c) => `<th class="${c.align === "right" ? "amount" : ""}">${escapeHtml(c.header)}</th>`)
    .join("")}</tr>`;

  const tbodyHtml = opts.rows
    .map(
      (row) =>
        `<tr>${row
          .map((cell, i) => {
            const align = opts.columns[i]?.align === "right" ? "amount" : "";
            return `<td class="${align}">${escapeHtml(cell)}</td>`;
          })
          .join("")}</tr>`
    )
    .join("");

  openPrintWindow(
    opts.title,
    `${institutionHeaderHtml()}
  <h1>${escapeHtml(opts.title)}</h1>
  ${opts.subtitle ? `<p class="subtitle">${escapeHtml(opts.subtitle)}</p>` : ""}
  ${summaryHtml}
  <table>
    <thead>${theadHtml}</thead>
    <tbody>${tbodyHtml}</tbody>
  </table>
`
  );
}

/**
 * Prints a collection receipt (Tahsilat Makbuzu) for a student payment, with
 * signature and stamp areas and the payment's receipt number.
 */
export function printPaymentReceipt(opts: {
  payment: Payment;
  studentName: string;
  guardianName?: string;
}): void {
  const { payment } = opts;
  const rows: [string, string][] = [
    ["Makbuz No", payment.receiptNumber ?? "—"],
    ["Tarih", formatDateDMY(payment.date)],
    ["Öğrenci", opts.studentName],
    ...(opts.guardianName ? ([["Ödeyen (Veli)", opts.guardianName]] as [string, string][]) : []),
    ["Ödeme Yöntemi", getPaymentMethodLabel(payment.method)],
    ...(payment.notes ? ([["Açıklama", payment.notes]] as [string, string][]) : []),
  ];
  const signs = `<div class="signs">
      <div class="sign"><div class="line">Teslim Alan (İmza)</div></div>
      <div class="sign"><div class="line">Kurum Kaşesi</div></div>
    </div>`;

  openPrintWindow(
    `${RECEIPT_TITLE} ${payment.receiptNumber ?? ""}`.trim(),
    `${institutionHeaderHtml()}
  <h1>${RECEIPT_TITLE}</h1>
  <table>
    <tbody>
      ${rows.map(([k, v]) => `<tr><th style="width:35%">${escapeHtml(k)}</th><td>${escapeHtml(v)}</td></tr>`).join("")}
      <tr><th>Tutar</th><td class="amount"><strong>${escapeHtml(formatCurrency(payment.amount))}</strong></td></tr>
    </tbody>
  </table>
  ${signs}`
  );
}
