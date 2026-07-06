// ─── Client-side export helpers ────────────────────────────────────────────────
// No external libraries: "Excel" export is a CSV file (opens natively in Excel),
// and "PDF" export opens a print-friendly window using the browser's native
// print-to-PDF flow. Both run entirely client-side.

function escapeCsvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number)[][]
): void {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(","));
  // Leading BOM so Excel opens UTF-8 (Turkish characters) correctly.
  const csv = "﻿" + lines.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return;

  const summaryHtml = opts.summary
    ? `<div class="summary">${opts.summary
        .map(
          (s) =>
            `<div>${escapeHtml(s.label)}<strong>${escapeHtml(s.value)}</strong></div>`
        )
        .join("")}</div>`
    : "";

  const theadHtml = `<tr>${opts.columns
    .map(
      (c) =>
        `<th class="${c.align === "right" ? "amount" : ""}">${escapeHtml(c.header)}</th>`
    )
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

  win.document.write(`<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(opts.title)}</title>
<style>
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
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <h1>${escapeHtml(opts.title)}</h1>
  ${opts.subtitle ? `<p class="subtitle">${escapeHtml(opts.subtitle)}</p>` : ""}
  ${summaryHtml}
  <table>
    <thead>${theadHtml}</thead>
    <tbody>${tbodyHtml}</tbody>
  </table>
</body>
</html>`);
  win.document.close();
  win.focus();
  win.print();
}
