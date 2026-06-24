"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface TabItem {
  key: string;
  label: string;
  badge?: string | number;
  content: ReactNode;
}

interface TabsProps {
  tabs: TabItem[];
  defaultTab?: string;
  className?: string;
}

export function Tabs({ tabs, defaultTab, className }: TabsProps) {
  const [active, setActive] = useState<string>(defaultTab ?? tabs[0]?.key ?? "");
  const activeTab = tabs.find((t) => t.key === active);

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Tab strip */}
      <div className="flex gap-0.5 border-b border-border overflow-x-auto no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            className={cn(
              "relative flex shrink-0 items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none",
              "after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-t-full after:transition-colors",
              active === tab.key
                ? "text-foreground after:bg-primary"
                : "text-muted-foreground hover:text-foreground after:bg-transparent"
            )}
          >
            {tab.label}
            {tab.badge !== undefined && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
                  active === tab.key
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Active tab content */}
      <div className="pt-5">{activeTab?.content}</div>
    </div>
  );
}
