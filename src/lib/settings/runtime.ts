import type { InstitutionSettings } from "@/types/settings";
import { DEFAULT_INSTITUTION_SETTINGS } from "@/lib/settings/defaults";

// ─── Active institution settings for non-React code ────────────────────────
//
// Formatting helpers (formatCurrency, formatTime, …) and finance calculations
// are plain functions called from hundreds of places, so threading the
// settings object through every call site isn't practical. MockDataProvider
// publishes the current settings here on every render, before any consumer
// renders, so these helpers always see the same values as the UI around them.
// Tests can call setActiveSettings directly.

let active: InstitutionSettings = DEFAULT_INSTITUTION_SETTINGS;

export function setActiveSettings(settings: InstitutionSettings): void {
  active = settings;
}

export function getActiveSettings(): InstitutionSettings {
  return active;
}
