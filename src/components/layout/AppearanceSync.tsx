"use client";

import { useEffect } from "react";
import { useMockStore } from "@/lib/mock/store";
import { DEFAULT_INSTITUTION_SETTINGS } from "@/lib/settings/defaults";
import type { CardRadiusPreference } from "@/types/settings";

const RADIUS: Record<CardRadiusPreference, string> = {
  sm: "0.375rem",
  md: "0.5rem",
  lg: "0.625rem",
  xl: "0.875rem",
};

/** Black or white text, whichever reads better on `hex`. */
function readableTextOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "oklch(0.985 0 0)";
  const n = parseInt(m[1]!, 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  return luminance > 0.45 ? "oklch(0.145 0 0)" : "oklch(0.985 0 0)";
}

/**
 * Applies Ayarlar → Belge ve Görünüm to the whole document: brand/accent
 * colors, card radius, UI density, animations and the light/dark theme.
 * Renders nothing — it only syncs <html> attributes and CSS variables.
 */
export function AppearanceSync() {
  const { appearance } = useMockStore().institutionSettings;

  useEffect(() => {
    const root = document.documentElement;
    const style = root.style;

    // The default brand color is the theme's own neutral primary — leave the
    // theme in charge then, so dark mode keeps its light primary.
    const customBrand = appearance.primaryBrandColor.toLowerCase() !== DEFAULT_INSTITUTION_SETTINGS.appearance.primaryBrandColor;
    for (const name of ["--primary", "--sidebar-primary"]) {
      if (customBrand) style.setProperty(name, appearance.primaryBrandColor);
      else style.removeProperty(name);
    }
    for (const name of ["--primary-foreground", "--sidebar-primary-foreground"]) {
      if (customBrand) style.setProperty(name, readableTextOn(appearance.primaryBrandColor));
      else style.removeProperty(name);
    }
    style.setProperty("--ring", appearance.accentColor);
    style.setProperty("--sidebar-ring", appearance.accentColor);
    style.setProperty("--radius", RADIUS[appearance.cardRadius]);
    style.fontSize = appearance.density === "compact" ? "15px" : "";
    root.dataset.animations = appearance.animationsEnabled ? "on" : "off";
  }, [appearance]);

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
