"use client";

import { AlertTriangle, Scale } from "lucide-react";
import { NumericInput } from "@/components/ui/numeric-input";
import { formatCurrency, formatDateDMY } from "@/lib/helpers/finance";
import { isDevirIncluded, type DevirPlan } from "@/lib/helpers/import-devir";

interface DevirReviewProps {
  plan: DevirPlan;
  devirDate: string;
  amountOf: (id: string, suggested: number) => number;
  onAmountChange: (id: string, amount: number) => void;
  included: Record<string, boolean>;
  onIncludedChange: (id: string, value: boolean) => void;
}

const cell = "px-3 py-2 text-sm";
const head = "px-3 py-2 text-left text-xs font-medium text-muted-foreground";
const num = "text-right tabular-nums";

/** Excel import → Önizleme: the devir each student and teacher enters with,
 *  editable before the import is confirmed (see lib/helpers/import-devir.ts). */
export function DevirReview({ plan, devirDate, amountOf, onAmountChange, included, onIncludedChange }: DevirReviewProps) {
  if (plan.students.length === 0 && plan.teachers.length === 0) return null;

  const studentTotal = plan.students.reduce((sum, l) => {
    if (l.source === "file") return sum + (l.fileDevir ?? 0);
    return isDevirIncluded(included, l.studentId, l) ? sum + amountOf(l.studentId, l.suggested) : sum;
  }, 0);
  const teacherTotal = plan.teachers
    .filter((l) => isDevirIncluded(included, l.teacherId, l))
    .reduce((sum, l) => sum + amountOf(l.teacherId, l.suggested), 0);
  const noPayments = plan.students.some((l) => l.source === "no_payments");

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4" data-testid="devir-review">
      <div className="flex items-start gap-3">
        <Scale className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div>
          <p className="text-sm font-semibold text-foreground">Devir — {formatDateDMY(devirDate)} itibarıyla</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Bu tarihten önceki dersler ve ödemeler geçmiş olarak eklenir; borca ve hakedişe katılmaz. Her öğrencinin ve öğretmenin
            o tarihteki bakiyesi aşağıdaki devir tutarıyla girer. Tutarları kontrol edip gerekirse düzeltin.
          </p>
        </div>
      </div>

      {noPayments && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            Dosyada ödeme bilgisi yok, bu yüzden kalan borçlar bilinemiyor: bu öğrencilerin devri 0 önerildi. Bildiğiniz kalan borçları
            &quot;Devir&quot; sütununa yazın.
          </p>
        </div>
      )}

      {plan.students.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border/60">
          <table className="w-full min-w-[560px]">
            <thead className="bg-muted/40">
              <tr>
                <th className={head}>Uygula</th>
                <th className={head}>Öğrenci</th>
                <th className={`${head} ${num}`}>Dersler</th>
                <th className={`${head} ${num}`}>Ödemeler</th>
                <th className={`${head} ${num}`}>Devir (borç + / alacak −)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {plan.students.map((l) => {
                // A devir row from the file itself is always imported.
                const on = l.source === "file" || isDevirIncluded(included, l.studentId, l);
                return (
                  <tr key={l.studentId} className={on ? "" : "opacity-50"}>
                    <td className={cell}>
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={l.source === "file"}
                        onChange={(e) => onIncludedChange(l.studentId, e.target.checked)}
                        className="h-4 w-4 accent-primary"
                        aria-label={`${l.studentName} devrini uygula`}
                      />
                    </td>
                    <td className={cell}>
                      <span className="font-medium text-foreground">{l.studentName}</span>
                      {l.hasExistingDevir && <span className="block text-[11px] text-amber-700">Zaten bir devri var — işaretlerseniz eklenir</span>}
                    </td>
                    <td className={`${cell} ${num}`}>{formatCurrency(l.lessonTotal)}</td>
                    <td className={`${cell} ${num}`}>{formatCurrency(l.paymentTotal)}</td>
                    <td className={`${cell} ${num}`}>
                      {l.source === "file" ? (
                        <span title="Dosyadaki devir satırından">{formatCurrency(l.fileDevir ?? 0)} · dosyadan</span>
                      ) : (
                        <NumericInput
                          value={amountOf(l.studentId, l.suggested)}
                          onValueChange={(v) => onAmountChange(l.studentId, v ?? 0)}
                          disabled={!on}
                          className="ml-auto h-8 w-32 text-right"
                          aria-label={`${l.studentName} devir tutarı`}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-muted/20">
              <tr>
                <td className={cell} colSpan={4}>
                  <span className="text-xs font-medium text-muted-foreground">Toplam öğrenci devri (bu aktarımla eklenecek)</span>
                </td>
                <td className={`${cell} ${num} font-semibold`}>{formatCurrency(studentTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {plan.teachers.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border/60">
          <table className="w-full min-w-[560px]">
            <thead className="bg-muted/40">
              <tr>
                <th className={head}>Uygula</th>
                <th className={head}>Öğretmen</th>
                <th className={`${head} ${num}`}>Hakediş</th>
                <th className={`${head} ${num}`}>Ödenen</th>
                <th className={`${head} ${num}`}>Devir (öğretmenin alacağı)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {plan.teachers.map((l) => {
                const on = isDevirIncluded(included, l.teacherId, l);
                return (
                  <tr key={l.teacherId} className={on ? "" : "opacity-50"}>
                    <td className={cell}>
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={(e) => onIncludedChange(l.teacherId, e.target.checked)}
                        className="h-4 w-4 accent-primary"
                        aria-label={`${l.teacherName} devrini uygula`}
                      />
                    </td>
                    <td className={cell}>
                      <span className="font-medium text-foreground">{l.teacherName}</span>
                      {l.salaryBased && (
                        <span className="block text-[11px] text-muted-foreground">Maaşlı — hakediş derslerden hesaplanamaz, tutarı yazın</span>
                      )}
                      {l.hasExistingDevir && <span className="block text-[11px] text-amber-700">Zaten bir devri var — işaretlerseniz değişir</span>}
                    </td>
                    <td className={`${cell} ${num}`}>{l.salaryBased ? "—" : formatCurrency(l.earningTotal)}</td>
                    <td className={`${cell} ${num}`}>{formatCurrency(l.paymentTotal)}</td>
                    <td className={`${cell} ${num}`}>
                      <NumericInput
                        value={amountOf(l.teacherId, l.suggested)}
                        onValueChange={(v) => onAmountChange(l.teacherId, Math.max(0, v ?? 0))}
                        disabled={!on}
                        className="ml-auto h-8 w-32 text-right"
                        aria-label={`${l.teacherName} devir tutarı`}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-muted/20">
              <tr>
                <td className={cell} colSpan={4}>
                  <span className="text-xs font-medium text-muted-foreground">Toplam öğretmen devri</span>
                </td>
                <td className={`${cell} ${num} font-semibold`}>{formatCurrency(teacherTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
