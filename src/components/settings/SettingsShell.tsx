"use client";

import { useEffect, type ReactNode, type MouseEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SETTINGS_SECTIONS } from "@/lib/settings/sections";
import { SettingsDirtyProvider, useSettingsDirty } from "@/components/settings/settings-dirty-context";
import { cn } from "@/lib/utils";

const LAST_SECTION_KEY = "settings-last-section";

function SettingsNav() {
  const pathname = usePathname();
  const { isDirty } = useSettingsDirty();

  useEffect(() => {
    if (pathname && pathname !== "/app/settings") {
      try {
        window.localStorage.setItem(LAST_SECTION_KEY, pathname);
      } catch {
        // Storage unavailable — no persistence this session, not fatal.
      }
    }
  }, [pathname]);

  // Unsaved-changes nav guard — SettingsFormSection reports dirty state into
  // the same provider, so any section's nav link (desktop or mobile) is
  // covered without each section page wiring its own confirm dialog.
  const guardNav = (e: MouseEvent) => {
    if (!isDirty) return;
    const proceed = window.confirm(
      "Kaydedilmemiş değişiklikleriniz var. Bu sayfadan ayrılmak istediğinize emin misiniz?"
    );
    if (!proceed) e.preventDefault();
  };

  return (
    <>
      {/* Desktop left nav */}
      <nav className="hidden w-64 shrink-0 lg:block" aria-label="Ayarlar bölümleri">
        <div className="space-y-0.5">
          {SETTINGS_SECTIONS.map((section) => {
            const active = pathname === section.href;
            return (
              <Link
                key={section.key}
                href={section.href}
                onClick={guardNav}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <section.icon className="h-4.5 w-4.5 shrink-0" aria-hidden />
                <span className="flex-1">{section.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Mobile — horizontally scrolling pill tabs */}
      <nav
        className="scrollbar-thin -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:hidden"
        aria-label="Ayarlar bölümleri"
      >
        {SETTINGS_SECTIONS.map((section) => {
          const active = pathname === section.href;
          return (
            <Link
              key={section.key}
              href={section.href}
              onClick={guardNav}
              className={cn(
                "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
              )}
            >
              <section.icon className="h-4 w-4 shrink-0" aria-hidden />
              {section.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

export function SettingsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // The section pages only render card titles, so the page's <h1> lives here.
  const section = SETTINGS_SECTIONS.find((s) => pathname?.startsWith(s.href));

  return (
    <SettingsDirtyProvider>
      <h1 className="sr-only">{section ? `Ayarlar — ${section.label}` : "Ayarlar"}</h1>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <SettingsNav />
        <div className="min-w-0 flex-1 space-y-5">{children}</div>
      </div>
    </SettingsDirtyProvider>
  );
}
