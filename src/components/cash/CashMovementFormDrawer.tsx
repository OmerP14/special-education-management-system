"use client";

import { useState, useEffect } from "react";
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
import { formatCurrency, getPaymentMethodLabel } from "@/lib/helpers/finance";
import { getCashCategoryLabel } from "@/lib/helpers/cash";
import type { CashMovement, CashMovementType, CashCategory, PaymentMethod } from "@/types";
import { cn } from "@/lib/utils";

// ─── Constants ─────────────────────────────────────────────────────────────────

const INCOME_CATEGORIES: CashCategory[] = [
  "guardian_payment",
  "loan_received",
  "other",
];

const EXPENSE_CATEGORIES: CashCategory[] = [
  "rent",
  "salary",
  "grocery",
  "stationery",
  "utility",
  "other",
];

// ─── Form state ────────────────────────────────────────────────────────────────

interface FormState {
  date: string;
  type: CashMovementType;
  category: CashCategory;
  amount: number;
  method: PaymentMethod;
  description: string;
  studentId: string;
}

function today(): string {
  return new Date().toISOString().split("T")[0]!;
}

const EMPTY_FORM: FormState = {
  date: today(),
  type: "income",
  category: "guardian_payment",
  amount: 0,
  method: "cash",
  description: "",
  studentId: "",
};

function buildFromMovement(m: CashMovement): FormState {
  return {
    date: m.date,
    type: m.type,
    category: m.category,
    amount: m.amount,
    method: m.method,
    description: m.description ?? "",
    studentId: m.studentId ?? "",
  };
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface CashMovementFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDate?: string;
  initialData?: CashMovement;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function CashMovementFormDrawer({
  open,
  onOpenChange,
  initialDate,
  initialData,
}: CashMovementFormDrawerProps) {
  const store = useMockStore();
  const isEditing = !!initialData;

  const { defaultPaymentMethod, enabledPaymentMethods } = store.institutionSettings.finance;
  const methodValues = enabledPaymentMethods.length > 0 ? enabledPaymentMethods : ["cash" as PaymentMethod];

  const [form, setForm] = useState<FormState>(() =>
    initialData
      ? buildFromMovement(initialData)
      : { ...EMPTY_FORM, method: defaultPaymentMethod, date: initialDate ?? today() }
  );

  useEffect(() => {
    if (open) {
      setForm(
        initialData
          ? buildFromMovement(initialData)
          : { ...EMPTY_FORM, method: defaultPaymentMethod, date: initialDate ?? today() }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialData?.id]);

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  // When switching type, reset category to first valid option
  const setType = (t: CashMovementType) => {
    const cats = t === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    setForm((prev) => ({
      ...prev,
      type: t,
      category: cats[0]!,
      studentId: t === "expense" ? "" : prev.studentId,
    }));
  };

  const canSave = !!form.date && form.amount > 0;

  const handleSave = () => {
    if (!canSave) return;
    const id = initialData?.id ?? `cm-${Date.now()}`;
    const movement: CashMovement = {
      id,
      tenantId: "tenant-1",
      date: form.date,
      type: form.type,
      category: form.category,
      amount: form.amount,
      method: form.method,
      description: form.description.trim() || undefined,
      studentId: form.studentId || undefined,
      createdAt: initialData?.createdAt ?? new Date().toISOString(),
    };
    if (isEditing) {
      store.updateCashMovement(movement);
    } else {
      store.addCashMovement(movement);
    }
    onOpenChange(false);
  };

  const categories =
    form.type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? "Hareketi Düzenle" : "Yeni Kasa Hareketi"}
      description="Kasaya giriş veya çıkış işlemi ekleyin."
      onSave={handleSave}
      saveLabel={isEditing ? "Değişiklikleri Kaydet" : "Hareketi Kaydet"}
    >
      <div className="space-y-5">
        {/* Type toggle */}
        <div className="space-y-1.5">
          <Label>İşlem Türü</Label>
          <div className="flex rounded-lg border border-border p-0.5 bg-muted/30">
            {(["income", "expense"] as CashMovementType[]).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={cn(
                  "flex-1 rounded-md py-1.5 text-xs font-medium transition-colors",
                  form.type === t
                    ? t === "income"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "bg-destructive text-destructive-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t === "income" ? "Gelir" : "Gider"}
              </button>
            ))}
          </div>
        </div>

        {/* Date */}
        <div className="space-y-1.5">
          <Label htmlFor="cm-date">Tarih</Label>
          <Input
            id="cm-date"
            type="date"
            value={form.date}
            onChange={(e) => set("date", e.target.value)}
          />
        </div>

        {/* Category */}
        <div className="space-y-1.5">
          <Label>Kategori</Label>
          <Select
            value={form.category}
            onValueChange={(v) => set("category", v as CashCategory)}
          >
            <SelectTrigger className="w-full">
              <SelectValue>{(val: CashCategory) => getCashCategoryLabel(val)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {getCashCategoryLabel(cat)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Student selector — shown for income > guardian_payment */}
        {form.type === "income" && form.category === "guardian_payment" && (
          <div className="space-y-1.5">
            <Label>Öğrenci (isteğe bağlı)</Label>
            <Select
              value={form.studentId || "__none__"}
              onValueChange={(v) => set("studentId", !v || v === "__none__" ? "" : v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Öğrenci seçin">
                  {(val: string) =>
                    val === "__none__" || !val
                      ? "Seçilmedi"
                      : store.students.find((s) => s.id === val)?.fullName ?? "Seçilmedi"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Seçilmedi</SelectItem>
                {store.students.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Amount */}
        <div className="space-y-1.5">
          <Label htmlFor="cm-amount">Tutar (₺)</Label>
          <NumericInput
            id="cm-amount"
            min={0}
            step={10}
            value={form.amount}
            placeholder="0"
            onValueChange={(v) => set("amount", v ?? 0)}
          />
          {form.amount > 0 && (
            <p className="text-xs text-muted-foreground">
              {formatCurrency(form.amount)}
            </p>
          )}
        </div>

        {/* Method */}
        <div className="space-y-1.5">
          <Label>Ödeme Yöntemi</Label>
          <Select
            value={form.method}
            onValueChange={(v) => set("method", v as PaymentMethod)}
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

        {/* Description */}
        <div className="space-y-1.5">
          <Label htmlFor="cm-desc">Açıklama / Not</Label>
          <textarea
            id="cm-desc"
            rows={3}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="İşlem hakkında kısa açıklama… (isteğe bağlı)"
            className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>
    </FormDrawer>
  );
}
