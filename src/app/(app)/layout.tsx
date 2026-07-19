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
            <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
              {children}
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </MockDataProvider>
  );
}
