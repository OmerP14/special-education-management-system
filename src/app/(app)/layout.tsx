"use client";

import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppTopbar } from "@/components/layout/AppTopbar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { MockDataProvider } from "@/lib/mock/store";
import { useSidebarVisibility } from "@/hooks/use-sidebar-visibility";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { visible, setVisible, toggle } = useSidebarVisibility();

  return (
    <MockDataProvider>
      <SidebarProvider open={visible} onOpenChange={setVisible}>
        <AppSidebar />
        <SidebarInset className="flex h-svh flex-col overflow-hidden">
          <AppTopbar sidebarVisible={visible} onToggleSidebar={toggle} />
          <div className="flex-1 overflow-y-auto bg-muted/20">
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
    </MockDataProvider>
  );
}
