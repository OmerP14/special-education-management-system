"use client";

import { useEffect } from "react";
import { useMockStore } from "@/lib/mock/store";

/**
 * Applies Ayarlar → Görünüm → Tema (light/dark/system) to <html>. Colors,
 * radius and density come from the theme in globals.css. Renders nothing.
 */
export function AppearanceSync() {
  const { appearance } = useMockStore().institutionSettings;

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = appearance.theme === "dark" || (appearance.theme === "system" && media.matches);
      root.classList.toggle("dark", dark);
      root.style.colorScheme = dark ? "dark" : "light";
    };
    apply();
    if (appearance.theme !== "system") return;
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [appearance.theme]);

  return null;
}
