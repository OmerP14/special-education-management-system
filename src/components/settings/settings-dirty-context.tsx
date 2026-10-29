"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

// Lets SettingsShell's nav links warn before leaving a section with unsaved
// changes, without every settings page needing to know about the shell (or
// vice versa) — SettingsFormSection reports its own dirty state in here,
// SettingsShell just reads it before letting a nav click through.
interface SettingsDirtyContextValue {
  isDirty: boolean;
  setDirty: (dirty: boolean) => void;
}

const SettingsDirtyContext = createContext<SettingsDirtyContextValue | null>(null);

export function SettingsDirtyProvider({ children }: { children: ReactNode }) {
  const [isDirty, setIsDirty] = useState(false);
  const setDirty = useCallback((dirty: boolean) => setIsDirty(dirty), []);
  return (
    <SettingsDirtyContext.Provider value={{ isDirty, setDirty }}>
      {children}
    </SettingsDirtyContext.Provider>
  );
}

export function useSettingsDirty(): SettingsDirtyContextValue {
  const ctx = useContext(SettingsDirtyContext);
  if (!ctx) throw new Error("useSettingsDirty must be used within SettingsDirtyProvider");
  return ctx;
}
