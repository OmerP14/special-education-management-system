"use client";

import { useState } from "react";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppTopbar } from "@/components/layout/AppTopbar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { MockDataProvider } from "@/lib/mock/store";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <MockDataProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Desktop sidebar */}
        <div className="hidden lg:flex lg:shrink-0">
          <AppSidebar />
        </div>

        {/* Mobile sidebar via Sheet */}
        <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
          <SheetContent side="left" className="w-64 p-0">
            <AppSidebar />
          </SheetContent>
        </Sheet>

        {/* Main content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppTopbar onMenuToggle={() => setMobileSidebarOpen(true)} />
          <main className="flex-1 overflow-y-auto bg-muted/20">
            <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </MockDataProvider>
  );
}
