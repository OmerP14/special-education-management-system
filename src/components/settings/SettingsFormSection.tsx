"use client";

import { useEffect, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/helpers/finance";
import type { SettingsValidationErrors } from "@/lib/settings/validation";
import type { SettingsSectionMetadataEntry } from "@/types/settings";

interface SettingsFormSectionProps {
  title: string;
  description?: string;
  isDirty: boolean;
  errors: SettingsValidationErrors;
  savedMessage: string | null;
  metadata?: SettingsSectionMetadataEntry;
  onSave: () => void;
  onCancel: () => void;
  onReset: () => void;
  children: ReactNode;
}

/**
 * The one save/cancel/reset shell every settings section renders its fields
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
  metadata,
  onSave,
  onCancel,
  onReset,
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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base font-semibold">{title}</CardTitle>
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          </div>
          {metadata && (
            <p className="text-[11px] text-muted-foreground/70">
              Son güncelleme: {formatDateTime(metadata.updatedAt)} · {metadata.updatedBy}
            </p>
          )}
        </div>
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
                <p key={i} className="text-xs text-destructive/80">
                  {e}
                </p>
              ))}
            </div>
          </div>
        )}

        {savedMessage && !isDirty && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-50 px-3 py-2.5 dark:bg-emerald-950/20">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
              {savedMessage}
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="gap-1.5 text-muted-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Varsayılana Sıfırla
          </Button>
          <div className="flex items-center gap-2">
            {isDirty && (
              <span className="text-xs font-medium text-amber-600">Kaydedilmemiş değişiklikler</span>
            )}
            <Button variant="outline" size="sm" onClick={onCancel} disabled={!isDirty}>
              İptal
            </Button>
            <Button size="sm" onClick={onSave} disabled={!isDirty}>
              Kaydet
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
