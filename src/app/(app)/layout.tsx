"use client";

import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppTopbar } from "@/components/layout/AppTopbar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { useSidebarVisibility } from "@/hooks/use-sidebar-visibility";
import { RouteGuard } from "@/components/auth/RouteGuard";
import { StorageFullBanner } from "@/components/layout/StorageFullBanner";
import { BackupFolderBanner } from "@/components/layout/BackupFolderBanner";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { visible, setVisible, toggle } = useSidebarVisibility();

  return (
    <RouteGuard>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:shadow-md focus:ring-2 focus:ring-ring"
      >
        İçeriğe geç
      </a>
      <SidebarProvider open={visible} onOpenChange={setVisible}>
        <AppSidebar />
        <SidebarInset className="flex h-svh flex-col overflow-hidden">
          <StorageFullBanner />
          <BackupFolderBanner />
          <AppTopbar sidebarVisible={visible} onToggleSidebar={toggle} />
          <div id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto bg-muted/20 outline-none">
            {/* max-w keeps content at a comfortable reading/table width — wide
                enough to fill 1366/1440 with the sidebar open, but capped so
                a collapsed sidebar or an ultra-wide monitor doesn't stretch a
                6-column table across 1800+px into sparse, awkwardly-gapped
                columns. Vertical padding is intentionally tight (not py-6) so
                pages — the calendar especially — don't lose height to unused
                top/bottom whitespace. */}
            <div className="mx-auto max-w-[1440px] px-4 py-4 sm:px-5 lg:px-6 lg:py-5">
              {children}
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </RouteGuard>
  );
}
