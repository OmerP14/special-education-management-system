"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/data/store";
import type { InstitutionSettings, InstitutionSettingsKey } from "@/types/settings";
import {
  validateInstitutionSettingsSection,
  hasValidationErrors,
  type SettingsValidationErrors,
} from "@/lib/settings/validation";
import { useSettingsDirty } from "@/components/settings/settings-dirty-context";

/**
 * One hook every settings section page uses instead of talking to the store
 * directly — local draft state (so typing doesn't write to the store on
 * every keystroke), dirty tracking wired into SettingsDirtyProvider, and
 * save/cancel/reset that all route through validateInstitutionSettingsSection
 * first. Section-level save behavior only — nothing here autosaves a field.
 */
export function useSettingsSection<K extends InstitutionSettingsKey>(key: K) {
  const store = useStore();
  const saved = store.institutionSettings[key];
  const { setDirty } = useSettingsDirty();

  const [draft, setDraft] = useState<InstitutionSettings[K]>(saved);
  const [errors, setErrors] = useState<SettingsValidationErrors>({});
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  // Only re-syncs when THIS section's saved value changes (save/reset) — no
  // other store action touches institutionSettings[key], so an in-progress
  // edit is never silently clobbered by an unrelated update elsewhere.
  const [prevSaved, setPrevSaved] = useState(saved);
  if (saved !== prevSaved) {
    setPrevSaved(saved);
    setDraft(saved);
  }

  const isDirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);

  useEffect(() => {
    setDirty(isDirty);
    return () => setDirty(false);
  }, [isDirty, setDirty]);

  useEffect(() => {
    if (!savedMessage) return;
    const t = setTimeout(() => setSavedMessage(null), 6000);
    return () => clearTimeout(t);
  }, [savedMessage]);

  const save = useCallback(() => {
    const validationErrors = validateInstitutionSettingsSection(key, draft);
    if (hasValidationErrors(validationErrors)) {
      setErrors(validationErrors);
      return false;
    }
    setErrors({});
    store.updateSettingsSection(key, draft);
    setSavedMessage("Değişiklikler kaydedildi.");
    return true;
  }, [key, draft, store]);

  const cancel = useCallback(() => {
    setDraft(saved);
    setErrors({});
  }, [saved]);

  const resetToDefaults = useCallback(() => {
    store.resetSettingsSection(key);
    setErrors({});
    setSavedMessage("Varsayılan değerlere döndürüldü.");
  }, [key, store]);

  return {
    draft,
    setDraft,
    isDirty,
    errors,
    savedMessage,
    save,
    cancel,
    resetToDefaults,
    metadata: store.institutionSettings.metadata[key],
  };
}
