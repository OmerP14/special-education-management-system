"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, User } from "lucide-react";
import { FormDrawer } from "@/components/shared/FormDrawer";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMockStore } from "@/lib/mock/store";
import {
  getStudentTotalBilled,
  getStudentNetBalance,
  getStudentGuardian,
  getPaymentMethodLabel,
  formatCurrency,
  getCurrencySymbol,
} from "@/lib/helpers/finance";
import { describeCollection } from "@/lib/helpers/finance-rules";
import type { Payment, PaymentMethod } from "@/types";
import { cn } from "@/lib/utils";
import { toLocalDateKey } from "@/lib/helpers/scheduling-rules";
import { useConfirm } from "@/components/shared/ConfirmProvider";

// ─── Constants ─────────────────────────────────────────────────────────────────

// ─── Preview row ───────────────────────────────────────────────────────────────

function PreviewRow({
  label,
  value,
  variant = "neutral",
  bold,
}: {
  label: string;
  value: string;
  variant?: "neutral" | "success" | "warning" | "danger";
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          bold ? "font-bold" : "font-semibold",
          "tabular-nums",
          variant === "neutral" && "text-foreground",
          variant === "success" && "text-emerald-600",
          variant === "warning" && "text-amber-600",
          variant === "danger" && "text-destructive"
        )}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Single payment form state ─────────────────────────────────────────────────

interface SingleFormState {
  studentId: string;
  date: string;
  amount: number;
  method: PaymentMethod;
  notes: string;
}

const EMPTY_SINGLE: SingleFormState = {
  studentId: "",
  date: "",
  amount: 0,
  method: "cash",
  notes: "",
};

function buildSingleFromPayment(payment: Payment): SingleFormState {
  return {
    studentId: payment.studentId,
    date: payment.date,
    amount: payment.amount,
    method: payment.method,
    notes: payment.notes ?? "",
  };
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface PaymentFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedStudentId?: string;
  initialData?: Payment;
}

// ─── Main component ────────────────────────────────────────────────────────────

export function PaymentFormDrawer({
  open,
  onOpenChange,
  preselectedStudentId,
  initialData,
}: PaymentFormDrawerProps) {
  const store = useMockStore();
  const confirm = useConfirm();
  const isEditing = !!initialData;

  // Ayarlar → Finans Ayarları drives both the enabled method list below and
  // the default a NEW payment starts on — editing an existing record
  // always keeps whatever method it already has.
  const finance = store.institutionSettings.finance;
  const { defaultPaymentMethod, enabledPaymentMethods } = finance;
  const methodValues = enabledPaymentMethods.length > 0 ? enabledPaymentMethods : ["cash" as PaymentMethod];
  const studentName = (id: string) => store.students.find((s) => s.id === id)?.fullName ?? "";
  const today = toLocalDateKey(new Date());

  // New payments start with today's date and the "Tahsilat Açıklama Şablonu"
  // filled in for the preselected student.
  const buildNewSingle = (): SingleFormState => {
    const studentId = preselectedStudentId ?? "";
    return {
      ...EMPTY_SINGLE,
      date: today,
      method: defaultPaymentMethod,
      studentId,
      notes: studentId ? describeCollection(studentName(studentId), today) : "",
    };
  };

  const [single, setSingle] = useState<SingleFormState>(() =>
    initialData ? buildSingleFromPayment(initialData) : buildNewSingle()
  );
  const [overpaymentAcknowledged, setOverpaymentAcknowledged] = useState(false);

  // Reset when the drawer opens (or targets another record). Done during
  // render rather than in an effect so stale values never paint.
  const resetKey = open ? initialData?.id ?? "" : null;
  const [prevResetKey, setPrevResetKey] = useState<string | null>(resetKey);
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    if (open) {
      setSingle(initialData ? buildSingleFromPayment(initialData) : buildNewSingle());
      setOverpaymentAcknowledged(false);
    }
  }

  const setSingleField = <K extends keyof SingleFormState>(
    key: K,
    val: SingleFormState[K]
  ) => {
    if (key === "amount") setOverpaymentAcknowledged(false);
    setSingle((prev) => {
      const next = { ...prev, [key]: val };
      // Keep the templated description in step with student/date while the
      // user hasn't written their own.
      if (!isEditing && (key === "studentId" || key === "date")) {
        const previousAuto = prev.studentId
          ? describeCollection(studentName(prev.studentId), prev.date)
          : "";
        if (!prev.notes || prev.notes === previousAuto) {
          next.notes = next.studentId
            ? describeCollection(studentName(next.studentId), next.date)
            : "";
        }
      }
      return next;
    });
  };

  // ─── Derived ───────────────────────────────────────────────────────────────

  const studentId = single.studentId;

  const connectedGuardian = studentId
    ? getStudentGuardian(studentId, store.students, store.guardians)
    : null;

  const totalBilled = studentId
    ? getStudentTotalBilled(studentId, store.sessions)
    : 0;
  // When editing, the payment being edited must not reduce the debt it is
  // being compared against.
  const otherPayments = initialData ? store.payments.filter((p) => p.id !== initialData.id) : store.payments;
  const totalPaid = studentId
    ? otherPayments.filter((p) => p.studentId === studentId).reduce((sum, p) => sum + p.amount, 0)
    : 0;
  // Includes opening balances (devir), so the debt matches the student's account.
  const currentDebt = studentId
    ? Math.max(0, getStudentNetBalance(studentId, store.sessions, otherPayments, store.openingBalances))
    : 0;
  const remainingAfter = Math.max(0, currentDebt - single.amount);
  const isOverpayment = single.amount > currentDebt && single.amount > 0;
  // Paying more than the debt needs an explicit confirmation; the excess
  // stays on the student's account as credit.
  const overpaymentNeedsAck = isOverpayment && !overpaymentAcknowledged;

  // ─── Save ──────────────────────────────────────────────────────────────────

  const canSaveSingle =
    !!single.studentId && !!single.date && single.amount > 0;

  const handleSave = async () => {
    if (!canSaveSingle) return;
    if (overpaymentNeedsAck) return;
    if (
      isEditing &&
      !(await confirm({
        title: "Ödeme kaydı değiştirilsin mi?",
        description: "Kayıtlı bir ödemeyi değiştirmek öğrencinin borç/bakiye hesabını etkiler.",
        confirmLabel: "Değişiklikleri Kaydet",
      }))
    ) {
      return;
    }
    const tenantId = initialData?.tenantId ?? "tenant-1";
    const payment: Payment = {
      id: initialData?.id ?? `payment-${Date.now()}`,
      tenantId,
      studentId: single.studentId,
      amount: single.amount,
      method: single.method,
      date: single.date,
      paymentSource: "manual",
      notes: single.notes.trim() || undefined,
      createdAt: initialData?.createdAt ?? new Date().toISOString(),
    };
    if (isEditing) {
      store.updatePayment(payment);
    } else {
      store.addPayment(payment);
    }
    onOpenChange(false);
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? "Ödeme Düzenle" : "Yeni Ödeme"}
      description="Öğrenci seçildiğinde mevcut borç durumu görüntülenir."
      onSave={handleSave}
      saveLabel={isEditing ? "Değişiklikleri Kaydet" : "Ödeme Kaydet"}
      saveDisabled={overpaymentNeedsAck}
    >
      <div className="space-y-5">
        <SinglePaymentForm
          form={single}
          set={setSingleField}
          students={store.students}
          methodValues={methodValues}
          connectedGuardian={connectedGuardian}
          totalBilled={totalBilled}
          totalPaid={totalPaid}
          currentDebt={currentDebt}
          remainingAfter={remainingAfter}
          isOverpayment={isOverpayment}
          overpaymentAcknowledged={overpaymentAcknowledged}
          onOverpaymentAcknowledgedChange={setOverpaymentAcknowledged}
          onClose={() => onOpenChange(false)}
          isEditing={isEditing}
        />
      </div>
    </FormDrawer>
  );
}

// ─── Single payment form ───────────────────────────────────────────────────────

function SinglePaymentForm({
  form,
  set,
  students,
  methodValues,
  connectedGuardian,
  totalBilled,
  totalPaid,
  currentDebt,
  remainingAfter,
  isOverpayment,
  overpaymentAcknowledged,
  onOverpaymentAcknowledgedChange,
  onClose,
  isEditing,
}: {
  form: SingleFormState;
  set: <K extends keyof SingleFormState>(k: K, v: SingleFormState[K]) => void;
  students: { id: string; fullName: string }[];
  methodValues: PaymentMethod[];
  connectedGuardian: { id: string; fullName: string; relationship: string; phone: string } | null;
  totalBilled: number;
  totalPaid: number;
  currentDebt: number;
  remainingAfter: number;
  isOverpayment: boolean;
  overpaymentAcknowledged: boolean;
  onOverpaymentAcknowledgedChange: (v: boolean) => void;
  onClose: () => void;
  isEditing: boolean;
}) {
  return (
    <>
      {/* Öğrenci */}
      <div className="space-y-1.5">
        <Label>Öğrenci</Label>
        <Select
          value={form.studentId}
          onValueChange={(val) => { if (val) set("studentId", val); }}
          disabled={isEditing}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Öğrenci seçiniz">
              {(val: string) =>
                students.find((s) => s.id === val)?.fullName ?? "Öğrenci seçiniz"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {students.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.fullName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {connectedGuardian && (
        <GuardianInfo guardian={connectedGuardian} onClose={onClose} />
      )}

      <div className="space-y-1.5">
        <Label htmlFor="payment-date">Ödeme Tarihi</Label>
        <Input
          id="payment-date"
          type="date"
          value={form.date}
          onChange={(e) => set("date", e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="payment-amount">Tutar ({getCurrencySymbol()})</Label>
        <NumericInput
          id="payment-amount"
          min={0}
          step={50}
          value={form.amount}
          placeholder="0"
          onValueChange={(v) => set("amount", v ?? 0)}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Ödeme Yöntemi</Label>
        <Select
          value={form.method}
          onValueChange={(val) => set("method", val as PaymentMethod)}
        >
          <SelectTrigger className="w-full">
            <SelectValue>{(val: PaymentMethod) => getPaymentMethodLabel(val)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {methodValues.map((m) => (
              <SelectItem key={m} value={m}>
                {getPaymentMethodLabel(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="payment-notes">Açıklama</Label>
        <textarea
          id="payment-notes"
          rows={3}
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="Ödeme hakkında notlar… (isteğe bağlı)"
          className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {!!form.studentId && (
        <>
          <Separator />
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Öğrenci Hesabı
            </p>
            <div className="rounded-lg bg-muted/50 p-3 space-y-2.5">
              <PreviewRow label="Toplam Tahakkuk" value={formatCurrency(totalBilled)} />
              <PreviewRow
                label="Şimdiye Kadar Ödenen"
                value={formatCurrency(totalPaid)}
                variant="success"
              />
              <PreviewRow
                label="Mevcut Borç"
                value={formatCurrency(currentDebt)}
                variant={currentDebt > 0 ? "danger" : "success"}
              />
              {form.amount > 0 && (
                <div className="border-t border-border/60 pt-2.5 space-y-2">
                  <PreviewRow
                    label="Bu Ödeme"
                    value={formatCurrency(form.amount)}
                    variant="warning"
                  />
                  <PreviewRow
                    label="Ödemeden Sonra Kalan"
                    value={formatCurrency(remainingAfter)}
                    variant={remainingAfter === 0 ? "success" : "danger"}
                    bold
                  />
                </div>
              )}
            </div>
            {isOverpayment && (
              <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 dark:bg-amber-950/20">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-600" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Girilen tutar mevcut borçtan{" "}
                    <span className="font-semibold">{formatCurrency(form.amount - currentDebt)}</span> fazla. Fazla
                    tutar öğrencinin alacağı olarak kalır ve sonraki seanslardan düşülür.
                  </p>
                </div>
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={overpaymentAcknowledged}
                    onChange={(e) => onOverpaymentAcknowledgedChange(e.target.checked)}
                    className="h-4 w-4 rounded border-amber-500/60 accent-amber-600"
                  />
                  <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                    Fazla ödemeyi onaylıyorum
                  </span>
                </label>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

// ─── Shared sub-component ──────────────────────────────────────────────────────

function GuardianInfo({
  guardian,
  onClose,
}: {
  guardian: { id: string; fullName: string; relationship: string; phone: string };
  onClose: () => void;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10">
        <User className="h-3.5 w-3.5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
          Bağlı Veli
        </p>
        <Link
          href={`/app/guardians/${guardian.id}`}
          className="text-sm font-medium text-foreground hover:text-primary transition-colors"
          onClick={onClose}
        >
          {guardian.fullName}
        </Link>
        <span className="ml-1.5 text-xs text-muted-foreground">
          {guardian.relationship} · {guardian.phone}
        </span>
      </div>
    </div>
  );
}
