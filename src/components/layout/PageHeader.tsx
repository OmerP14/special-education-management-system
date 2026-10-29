"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

// Deliberately minimal — the app no longer repeats a page title/subtitle in
// the body (the sidebar's active item already says where you are, and the
// topbar breadcrumb was removed too; see AppTopbar). `title` stays as a
// screen-reader-only <h1> so pages still have real document structure, and
// `description` is intentionally not rendered at all: it was always
// decorative or a count already visible in the content below. When a page
// has no `actions`, this renders nothing — zero height, no gap to account for.
export function PageHeader({ title, actions, className }: PageHeaderProps) {
  return (
    <>
      <h1 className="sr-only">{title}</h1>
      {actions && (
        <div className={cn("flex items-center justify-end gap-2", className)}>{actions}</div>
      )}
    </>
  );
}
