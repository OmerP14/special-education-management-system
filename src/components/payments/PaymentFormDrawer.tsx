"use client";

import { useState, useEffect, useMemo } from "react";
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
  getStudentTotalPaid,
  getStudentGuardian,
  getPaymentMethodLabel,
  formatCurrency,
  formatDate,
} from "@/lib/helpers/finance";
import {
  buildInstallmentRecords,
  splitAmountIntoInstallments,
  computeInstallmentDueDate,
  getIntervalLabel,
} from "@/lib/helpers/installments";
import type {
  Payment,
  PaymentMethod,
  InstallmentInterval,
  InstallmentPlan,
} from "@/types";
import { cn } from "@/lib/utils";

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
  const isEditing = !!initialData;

  // Ayarlar → Finans Ayarları drives both the enabled method list below and
  // the default a NEW payment/plan starts on — editing an existing record
  // always keeps whatever method it already has.
  const { defaultPaymentMethod, enabledPaymentMethods } = store.institutionSettings.finance;
  const methodValues = enabledPaymentMethods.length > 0 ? enabledPaymentMethods : ["cash" as PaymentMethod];

  const [mode, setMode] = useState<PaymentMode>("single");
  const [single, setSingle] = useState<SingleFormState>(() =>
    initialData
      ? buildSingleFromPayment(initialData)
      : { ...EMPTY_SINGLE, method: defaultPaymentMethod, studentId: preselectedStudentId ?? "" }
  );
  const [inst, setInst] = useState<InstallmentFormState>({
    ...EMPTY_INSTALLMENT,
    method: defaultPaymentMethod,
    studentId: preselectedStudentId ?? "",
  });

  useEffect(() => {
    if (open) {
      setMode("single");
      setSingle(
        initialData
          ? buildSingleFromPayment(initialData)
          : { ...EMPTY_SINGLE, method: defaultPaymentMethod, studentId: preselectedStudentId ?? "" }
      );
      setInst({ ...EMPTY_INSTALLMENT, method: defaultPaymentMethod, studentId: preselectedStudentId ?? "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialData?.id]);

  const setSingleField = <K extends keyof SingleFormState>(
    key: K,
    val: SingleFormState[K]
  ) => setSingle((prev) => ({ ...prev, [key]: val }));

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
  const totalPaid = studentId
    ? getStudentTotalPaid(studentId, store.payments)
    : 0;
  const currentDebt = Math.max(0, totalBilled - totalPaid);
  const remainingAfter =
    mode === "single" ? Math.max(0, currentDebt - single.amount) : 0;
  const isOverpayment =
    mode === "single" && single.amount > currentDebt && single.amount > 0;

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

  const handleSave = () => {
    if (mode === "single") {
      if (!canSaveSingle) return;
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
      if (!canSaveInstallment) return;
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

  const canSave = mode === "single" ? canSaveSingle : canSaveInstallment;

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
    >
      <div className="space-y-5">
        {/* Mode toggle — hidden when editing existing payment */}
        {!isEditing && (
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
        <Label htmlFor="payment-amount">Tutar (₺)</Label>
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
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-600" />
                <p className="text-xs text-amber-700">
                  Girilen tutar mevcut borçtan{" "}
                  <span className="font-semibold">
                    {formatCurrency(form.amount - currentDebt)}
                  </span>{" "}
                  fazla.
                </p>
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
        <Label htmlFor="inst-total">Toplam Taksit Tutarı (₺)</Label>
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
