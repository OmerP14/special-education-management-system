"use client";

import { useEffect, type ReactNode } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { SettingsValidationErrors } from "@/lib/settings/validation";

interface SettingsFormSectionProps {
  title: string;
  description?: string;
  isDirty: boolean;
  errors: SettingsValidationErrors;
  savedMessage: string | null;
  onSave: () => void;
  onCancel: () => void;
  children: ReactNode;
}

/**
 * The one save/cancel shell every settings section renders its fields
 * inside of. Section-level save only — nothing here writes to the store
 * until Kaydet is pressed. Also owns the "unsaved changes" browser warning
 * (in-app nav warning lives in SettingsShell, which reads the same dirty
 * state via SettingsDirtyProvider).
 */
export function SettingsFormSection({
  title,
  description,
  isDirty,
  errors,
  savedMessage,
  onSave,
  onCancel,
  children,
}: SettingsFormSectionProps) {
  const errorList = Object.values(errors);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </CardHeader>
      <CardContent className="space-y-6">
        {children}

        {errorList.length > 0 && (
          <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-destructive">
                Kaydetmeden önce şu alanları düzeltin:
              </p>
              {errorList.map((e, i) => (
                <p key={i} className="text-sm text-destructive">
                  {e}
                </p>
              ))}
            </div>
          </div>
        )}

        {savedMessage && !isDirty && (
          <div role="status" className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-50 px-4 py-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
            <p className="text-base font-medium text-emerald-800">
              {savedMessage}
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border/60 pt-4">
          {isDirty && (
            <span className="text-sm font-medium text-amber-700">Değişiklikleri kaydetmeyi unutmayın</span>
          )}
          <Button variant="outline" size="lg" onClick={onCancel} disabled={!isDirty}>
            Vazgeç
          </Button>
          <Button size="lg" onClick={onSave} disabled={!isDirty}>
            Kaydet
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
