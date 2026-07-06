"use client";

import { useState, useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { FormDrawer } from "@/components/shared/FormDrawer";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMockStore } from "@/lib/mock/store";
import {
  getTeacherEarningTotals,
  formatCurrency,
  TEACHER_PAYMENT_TYPES,
  getTeacherPaymentTypeLabel,
  isDeductionPaymentType,
} from "@/lib/helpers/finance";
import type { TeacherPayment, PaymentMethod, TeacherPaymentType } from "@/types";
import { cn } from "@/lib/utils";

// ─── Constants ─────────────────────────────────────────────────────────────────
// Institutions pay teachers by cash or bank transfer only — no card option here.

const METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Nakit" },
  { value: "bank_transfer", label: "EFT/Havale" },
];

const DEFAULT_PAYMENT_TYPE: TeacherPaymentType = "salary";
const DEFAULT_METHOD: PaymentMethod = "cash";

function getMethodLabel(method: PaymentMethod): string {
  return METHOD_OPTIONS.find((o) => o.value === method)?.label ?? method;
}

function today(): string {
  return new Date().toISOString().split("T")[0]!;
}

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

// ─── Props ─────────────────────────────────────────────────────────────────────

interface TeacherPaymentFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedTeacherId?: string;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function TeacherPaymentFormDrawer({
  open,
  onOpenChange,
  preselectedTeacherId,
}: TeacherPaymentFormDrawerProps) {
  const store = useMockStore();

  const [teacherId, setTeacherId] = useState(preselectedTeacherId ?? "");
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>(DEFAULT_METHOD);
  const [paymentType, setPaymentType] = useState<TeacherPaymentType>(DEFAULT_PAYMENT_TYPE);
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (open) {
      setTeacherId(preselectedTeacherId ?? "");
      setDate(today());
      setAmount(0);
      setMethod(DEFAULT_METHOD);
      setPaymentType(DEFAULT_PAYMENT_TYPE);
      setDescription("");
    }
  }, [open, preselectedTeacherId]);

  const isDeduction = isDeductionPaymentType(paymentType);

  const teachersWithPending = store.teachers
    .map((t) => ({
      teacher: t,
      totals: getTeacherEarningTotals(t, store.sessions, store.teacherPayments),
    }))
    .filter((t) => t.totals.pendingEarning > 0);

  const selected = teachersWithPending.find((t) => t.teacher.id === teacherId);
  const pendingEarning = selected?.totals.pendingEarning ?? 0;
  const paidEarning = selected?.totals.paidEarning ?? 0;
  const deductedEarning = selected?.totals.deductedEarning ?? 0;
  const totalEarning = selected?.totals.totalEarning ?? 0;

  const isOverpayment = amount > pendingEarning && amount > 0;
  const remainingAfter = Math.max(0, pendingEarning - amount);

  const canSave = !!teacherId && !!date && amount > 0 && !isOverpayment;

  const handleSave = () => {
    if (!canSave) return;
    const payment: TeacherPayment = {
      id: `tpmt-${Date.now()}`,
      tenantId: selected?.teacher.tenantId ?? "tenant-1",
      teacherId,
      amount,
      method,
      paymentType,
      date,
      description: description.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    store.addTeacherPayment(payment);
    onOpenChange(false);
  };

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Öğretmen Ödemesi"
      description="Öğretmene yapılan ödeme, öğrenci/veli ödemesinden bağımsızdır."
      onSave={handleSave}
      saveLabel="Ödeme Kaydet"
    >
      <div className="space-y-5">
        {/* Öğretmen */}
        <div className="space-y-1.5">
          <Label>Öğretmen</Label>
          <Select
            value={teacherId || "__none__"}
            onValueChange={(val) => {
              if (val && val !== "__none__") setTeacherId(val);
            }}
            disabled={!!preselectedTeacherId}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Öğretmen seçin">
                {(val: string) =>
                  store.teachers.find((t) => t.id === val)?.fullName ?? "Öğretmen seçin"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {teachersWithPending.map(({ teacher, totals }) => (
                <SelectItem key={teacher.id} value={teacher.id}>
                  {teacher.fullName} — {formatCurrency(totals.pendingEarning)} bekliyor
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {teachersWithPending.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Bekleyen hakedişi olan öğretmen bulunmuyor.
            </p>
          )}
        </div>

        {/* Tarih */}
        <div className="space-y-1.5">
          <Label htmlFor="tp-date">Ödeme Tarihi</Label>
          <Input
            id="tp-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        {/* Tutar */}
        <div className="space-y-1.5">
          <Label htmlFor="tp-amount">Tutar (₺)</Label>
          <NumericInput
            id="tp-amount"
            min={0}
            step={50}
            value={amount}
            placeholder="0"
            onValueChange={(v) => setAmount(v ?? 0)}
          />
        </div>

        {/* Ödeme türü */}
        <div className="space-y-1.5">
          <Label>Ödeme Türü</Label>
          <Select
            value={paymentType}
            onValueChange={(val) => setPaymentType(val as TeacherPaymentType)}
          >
            <SelectTrigger className="w-full">
              <SelectValue>
                {(val: TeacherPaymentType) => getTeacherPaymentTypeLabel(val)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {TEACHER_PAYMENT_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {getTeacherPaymentTypeLabel(type)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Ödeme yöntemi — Kesinti'de gizli, çünkü bir Kesinti nakit/banka işlemi değildir */}
        {isDeduction ? (
          <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              Kesinti kasa çıkışı oluşturmaz, yalnızca bekleyen hakedişten düşülür.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label>Ödeme Yöntemi</Label>
            <Select value={method} onValueChange={(val) => setMethod(val as PaymentMethod)}>
              <SelectTrigger className="w-full">
                <SelectValue>{(val: PaymentMethod) => getMethodLabel(val)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {METHOD_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Açıklama */}
        <div className="space-y-1.5">
          <Label htmlFor="tp-desc">Açıklama</Label>
          <textarea
            id="tp-desc"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={
              isDeduction
                ? 'Örn. "Devamsızlık kesintisi", "Avans mahsup"…'
                : "Ödeme hakkında notlar… (isteğe bağlı)"
            }
            className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        {/* Hakediş özeti */}
        {!!teacherId && selected && (
          <div className="rounded-lg bg-muted/50 p-3 space-y-2.5">
            <PreviewRow label="Toplam Hakediş" value={formatCurrency(totalEarning)} />
            <PreviewRow
              label="Nakit/EFT Ödenen"
              value={formatCurrency(paidEarning)}
              variant="success"
            />
            <PreviewRow
              label="Kesintiler"
              value={formatCurrency(deductedEarning)}
              variant={deductedEarning > 0 ? "warning" : "neutral"}
            />
            <PreviewRow
              label="Bekleyen Hakediş"
              value={formatCurrency(pendingEarning)}
              variant={pendingEarning > 0 ? "warning" : "success"}
              bold
            />
            {amount > 0 && (
              <div className="border-t border-border/60 pt-2.5 space-y-2">
                <PreviewRow
                  label={isDeduction ? "Bu Kesinti" : "Bu Ödeme"}
                  value={formatCurrency(amount)}
                  variant="warning"
                />
                <PreviewRow
                  label="Sonrasında Kalan Bekleyen"
                  value={formatCurrency(remainingAfter)}
                  variant={remainingAfter === 0 ? "success" : "danger"}
                  bold
                />
              </div>
            )}
          </div>
        )}

        {isOverpayment && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-600" />
            <p className="text-xs text-amber-700">
              Girilen tutar bekleyen hakedişten{" "}
              <span className="font-semibold">
                {formatCurrency(amount - pendingEarning)}
              </span>{" "}
              fazla. Bekleyen hakedişten fazla {isDeduction ? "kesinti" : "ödeme"} kaydedilemez.
            </p>
          </div>
        )}
      </div>
    </FormDrawer>
  );
}
