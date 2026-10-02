"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { AlertTriangle, User, CalendarDays } from "lucide-react";
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
  formatDate,
  getCurrencySymbol,
} from "@/lib/helpers/finance";
import {
  buildInstallmentRecords,
  splitAmountIntoInstallments,
  computeInstallmentDueDate,
  getIntervalLabel,
} from "@/lib/helpers/installments";
import {
  fillCollectionTemplate,
  getDefaultInstallmentInterval,
  OVERPAYMENT_POLICY_MESSAGES,
} from "@/lib/helpers/finance-rules";
import type {
  Payment,
  PaymentMethod,
  InstallmentInterval,
  InstallmentPlan,
} from "@/types";
import type { OverpaymentPolicy } from "@/types/settings";
import { cn } from "@/lib/utils";
import { toLocalDateKey } from "@/lib/helpers/scheduling-rules";
import { useConfirm } from "@/components/shared/ConfirmProvider";

// ─── Constants ─────────────────────────────────────────────────────────────────

type PaymentMode = "single" | "installment";

const INTERVAL_OPTIONS: { value: InstallmentInterval; label: string }[] = [
  { value: "monthly", label: getIntervalLabel("monthly") },
  { value: "weekly", label: getIntervalLabel("weekly") },
  { value: "custom", label: "Özel Aralık" },
];

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

// ─── Installment plan form state ───────────────────────────────────────────────

interface InstallmentFormState {
  studentId: string;
  totalAmount: number;
  installmentCount: number;
  firstDueDate: string;
  interval: InstallmentInterval;
  customIntervalDays: number;
  method: PaymentMethod;
  notes: string;
}

const EMPTY_INSTALLMENT: InstallmentFormState = {
  studentId: "",
  totalAmount: 0,
  installmentCount: 3,
  firstDueDate: "",
  interval: "monthly",
  customIntervalDays: 30,
  method: "cash",
  notes: "",
};

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
  // the default a NEW payment/plan starts on — editing an existing record
  // always keeps whatever method it already has.
  const finance = store.institutionSettings.finance;
  const { defaultPaymentMethod, enabledPaymentMethods } = finance;
  const methodValues = enabledPaymentMethods.length > 0 ? enabledPaymentMethods : ["cash" as PaymentMethod];
  const studentName = (id: string) => store.students.find((s) => s.id === id)?.fullName ?? "";
  const today = toLocalDateKey(new Date());

  // New payments start with today's date and the "Tahsilat Açıklama Şablonu"
  // filled in for the preselected student; plans with the default interval.
  const buildNewSingle = (): SingleFormState => {
    const studentId = preselectedStudentId ?? "";
    return {
      ...EMPTY_SINGLE,
      date: today,
      method: defaultPaymentMethod,
      studentId,
      notes: studentId ? fillCollectionTemplate(finance.collectionDescriptionTemplate, studentName(studentId), today) : "",
    };
  };
  const buildNewInstallment = (): InstallmentFormState => ({
    ...EMPTY_INSTALLMENT,
    ...getDefaultInstallmentInterval(finance.defaultInstallmentIntervalDays),
    method: defaultPaymentMethod,
    studentId: preselectedStudentId ?? "",
  });

  const [mode, setMode] = useState<PaymentMode>("single");
  const [single, setSingle] = useState<SingleFormState>(() =>
    initialData ? buildSingleFromPayment(initialData) : buildNewSingle()
  );
  const [inst, setInst] = useState<InstallmentFormState>(buildNewInstallment);
  const [overpaymentAcknowledged, setOverpaymentAcknowledged] = useState(false);

  // Reset when the drawer opens (or targets another record). Done during
  // render rather than in an effect so stale values never paint.
  const resetKey = open ? initialData?.id ?? "" : null;
  const [prevResetKey, setPrevResetKey] = useState<string | null>(resetKey);
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    if (open) {
      setMode("single");
      setSingle(initialData ? buildSingleFromPayment(initialData) : buildNewSingle());
      setInst(buildNewInstallment());
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
          ? fillCollectionTemplate(finance.collectionDescriptionTemplate, studentName(prev.studentId), prev.date)
          : "";
        if (!prev.notes || prev.notes === previousAuto) {
          next.notes = next.studentId
            ? fillCollectionTemplate(finance.collectionDescriptionTemplate, studentName(next.studentId), next.date)
            : "";
        }
      }
      return next;
    });
  };

  const setInstField = <K extends keyof InstallmentFormState>(
    key: K,
    val: InstallmentFormState[K]
  ) => setInst((prev) => ({ ...prev, [key]: val }));

  // ─── Derived: single mode ──────────────────────────────────────────────────

  const studentId = mode === "single" ? single.studentId : inst.studentId;

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
  const remainingAfter =
    mode === "single" ? Math.max(0, currentDebt - single.amount) : 0;
  const isOverpayment =
    mode === "single" && single.amount > currentDebt && single.amount > 0;
  // Ayarlar → Finans → Fazla Ödeme Politikası
  const overpaymentBlocked = isOverpayment && finance.overpaymentPolicy === "block";
  const overpaymentNeedsAck = isOverpayment && finance.overpaymentPolicy === "warn" && !overpaymentAcknowledged;
  const installmentsAllowed = finance.allowInstallments;

  // ─── Derived: installment preview ─────────────────────────────────────────

  const installmentPreview = useMemo(() => {
    if (
      mode !== "installment" ||
      inst.totalAmount <= 0 ||
      inst.installmentCount < 2 ||
      !inst.firstDueDate
    )
      return [];

    const amounts = splitAmountIntoInstallments(
      inst.totalAmount,
      inst.installmentCount
    );
    return amounts.map((amount, i) => ({
      no: i + 1,
      dueDate: computeInstallmentDueDate(
        inst.firstDueDate,
        i,
        inst.interval,
        inst.customIntervalDays
      ),
      amount,
    }));
  }, [
    mode,
    inst.totalAmount,
    inst.installmentCount,
    inst.firstDueDate,
    inst.interval,
    inst.customIntervalDays,
  ]);

  // ─── Save ──────────────────────────────────────────────────────────────────

  const canSaveSingle =
    !!single.studentId && !!single.date && single.amount > 0;

  const canSaveInstallment =
    !!inst.studentId &&
    inst.totalAmount > 0 &&
    inst.installmentCount >= 2 &&
    !!inst.firstDueDate;

  const handleSave = async () => {
    if (mode === "single") {
      if (!canSaveSingle) return;
      if (overpaymentBlocked || overpaymentNeedsAck) return;
      if (
        isEditing &&
        !(await confirm({
          kind: "financial",
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
    } else {
      if (!canSaveInstallment || !installmentsAllowed) return;
      const planId = `iplan-${Date.now()}`;
      const plan: InstallmentPlan = {
        id: planId,
        tenantId: "tenant-1",
        studentId: inst.studentId,
        totalAmount: inst.totalAmount,
        installmentCount: inst.installmentCount,
        firstDueDate: inst.firstDueDate,
        interval: inst.interval,
        customIntervalDays:
          inst.interval === "custom" ? inst.customIntervalDays : undefined,
        method: inst.method,
        notes: inst.notes.trim() || undefined,
        installments: buildInstallmentRecords(
          planId,
          inst.totalAmount,
          inst.installmentCount,
          inst.firstDueDate,
          inst.interval,
          inst.interval === "custom" ? inst.customIntervalDays : undefined
        ),
        createdAt: new Date().toISOString(),
      };
      store.addInstallmentPlan(plan);
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
      saveLabel={
        isEditing
          ? "Değişiklikleri Kaydet"
          : mode === "single"
            ? "Ödeme Kaydet"
            : "Taksit Planı Oluştur"
      }
      saveDisabled={mode === "single" && (overpaymentBlocked || overpaymentNeedsAck)}
    >
      <div className="space-y-5">
        {/* Mode toggle — hidden when editing existing payment */}
        {!isEditing && installmentsAllowed && (
          <div className="flex rounded-lg border border-border p-0.5 bg-muted/30">
            {(["single", "installment"] as PaymentMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "flex-1 rounded-md py-1.5 text-xs font-medium transition-colors",
                  mode === m
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {m === "single" ? "Tek Ödeme" : "Taksit Planı"}
              </button>
            ))}
          </div>
        )}

        {mode === "single" ? (
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
            overpaymentPolicy={finance.overpaymentPolicy}
            overpaymentAcknowledged={overpaymentAcknowledged}
            onOverpaymentAcknowledgedChange={setOverpaymentAcknowledged}
            onClose={() => onOpenChange(false)}
            isEditing={isEditing}
          />
        ) : (
          <InstallmentPlanForm
            form={inst}
            set={setInstField}
            students={store.students}
            methodValues={methodValues}
            connectedGuardian={connectedGuardian}
            preview={installmentPreview}
            onClose={() => onOpenChange(false)}
          />
        )}
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
  overpaymentPolicy,
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
  overpaymentPolicy: OverpaymentPolicy;
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
              <div
                className={cn(
                  "space-y-2 rounded-lg border px-3 py-2.5",
                  overpaymentPolicy === "block"
                    ? "border-destructive/40 bg-destructive/5"
                    : "border-amber-200 bg-amber-50 dark:bg-amber-950/20"
                )}
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle
                    className={cn(
                      "h-3.5 w-3.5 mt-0.5 shrink-0",
                      overpaymentPolicy === "block" ? "text-destructive" : "text-amber-600"
                    )}
                  />
                  <p className={cn("text-xs", overpaymentPolicy === "block" ? "text-destructive" : "text-amber-700 dark:text-amber-400")}>
                    Girilen tutar mevcut borçtan{" "}
                    <span className="font-semibold">{formatCurrency(form.amount - currentDebt)}</span> fazla.{" "}
                    {OVERPAYMENT_POLICY_MESSAGES[overpaymentPolicy]}
                  </p>
                </div>
                {overpaymentPolicy === "warn" && (
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
                )}
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

// ─── Installment plan form ─────────────────────────────────────────────────────

function InstallmentPlanForm({
  form,
  set,
  students,
  methodValues,
  connectedGuardian,
  preview,
  onClose,
}: {
  form: InstallmentFormState;
  set: <K extends keyof InstallmentFormState>(
    k: K,
    v: InstallmentFormState[K]
  ) => void;
  students: { id: string; fullName: string }[];
  methodValues: PaymentMethod[];
  connectedGuardian: { id: string; fullName: string; relationship: string; phone: string } | null;
  preview: { no: number; dueDate: string; amount: number }[];
  onClose: () => void;
}) {
  const perInstallment =
    preview.length > 0 ? preview[0]!.amount : 0;
  const lastAmount =
    preview.length > 0 ? preview[preview.length - 1]!.amount : 0;
  const hasRemainder = preview.length > 1 && lastAmount !== perInstallment;

  return (
    <>
      {/* Öğrenci */}
      <div className="space-y-1.5">
        <Label>Öğrenci</Label>
        <Select
          value={form.studentId}
          onValueChange={(val) => { if (val) set("studentId", val); }}
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

      {/* Toplam tutar */}
      <div className="space-y-1.5">
        <Label htmlFor="inst-total">Toplam Taksit Tutarı ({getCurrencySymbol()})</Label>
        <NumericInput
          id="inst-total"
          min={0}
          step={100}
          value={form.totalAmount}
          placeholder="0"
          onValueChange={(v) => set("totalAmount", v ?? 0)}
        />
      </div>

      {/* Count + first due */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="inst-count">Taksit Sayısı</Label>
          <NumericInput
            id="inst-count"
            min={2}
            max={36}
            integer
            value={form.installmentCount}
            emptyValue={2}
            transform={(v) => Math.min(36, Math.max(2, v))}
            onValueChange={(v) => set("installmentCount", v ?? 2)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inst-first-date">İlk Taksit Tarihi</Label>
          <Input
            id="inst-first-date"
            type="date"
            value={form.firstDueDate}
            onChange={(e) => set("firstDueDate", e.target.value)}
          />
        </div>
      </div>

      {/* Interval */}
      <div className="space-y-1.5">
        <Label>Taksit Aralığı</Label>
        <Select
          value={form.interval}
          onValueChange={(val) => set("interval", val as InstallmentInterval)}
        >
          <SelectTrigger className="w-full">
            <SelectValue>
              {(val: InstallmentInterval) =>
                INTERVAL_OPTIONS.find((opt) => opt.value === val)?.label ?? getIntervalLabel(val)
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {INTERVAL_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {form.interval === "custom" && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-sm text-muted-foreground shrink-0">Her</span>
            <NumericInput
              min={1}
              max={365}
              integer
              value={form.customIntervalDays}
              emptyValue={30}
              transform={(v) => Math.min(365, Math.max(1, v))}
              onValueChange={(v) => set("customIntervalDays", v ?? 30)}
              className="w-20"
            />
            <span className="text-sm text-muted-foreground shrink-0">günde bir</span>
          </div>
        )}
      </div>

      {/* Ödeme yöntemi */}
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

      {/* Notes */}
      <div className="space-y-1.5">
        <Label htmlFor="inst-notes">Açıklama</Label>
        <textarea
          id="inst-notes"
          rows={2}
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="Plan hakkında notlar… (isteğe bağlı)"
          className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* Live preview table */}
      {preview.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Taksit Planı Önizlemesi
              </p>
              <p className="text-xs text-muted-foreground">
                {getIntervalLabel(form.interval, form.customIntervalDays)} ·{" "}
                {formatCurrency(form.totalAmount)} toplam
              </p>
            </div>
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="grid grid-cols-3 bg-muted/40 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <span>#</span>
                <span>Vade Tarihi</span>
                <span className="text-right">Tutar</span>
              </div>
              <div className="divide-y divide-border/60 max-h-52 overflow-y-auto">
                {preview.map((row) => (
                  <div
                    key={row.no}
                    className="grid grid-cols-3 px-3 py-2 text-xs"
                  >
                    <span className="text-muted-foreground">{row.no}.</span>
                    <span className="flex items-center gap-1 text-foreground tabular-nums">
                      <CalendarDays className="h-3 w-3 text-muted-foreground shrink-0" />
                      {formatDate(row.dueDate)}
                    </span>
                    <span
                      className={cn(
                        "text-right tabular-nums font-semibold",
                        hasRemainder && row.no === preview.length
                          ? "text-amber-600"
                          : "text-foreground"
                      )}
                    >
                      {formatCurrency(row.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            {hasRemainder && (
              <p className="text-[11px] text-amber-600">
                Son taksit kalan tutar nedeniyle{" "}
                <span className="font-semibold">{formatCurrency(lastAmount)}</span>{" "}
                olarak ayarlandı.
              </p>
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
