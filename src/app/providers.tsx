"use client";

import type { ReactNode } from "react";
import { MockDataProvider } from "@/lib/mock/store";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { AppearanceSync } from "@/components/layout/AppearanceSync";
import { ConfirmProvider } from "@/components/shared/ConfirmProvider";
import { AutoBackupRunner } from "@/components/layout/AutoBackupRunner";

// Wraps the WHOLE app (mounted from the root layout), not just /app/* — both
// /login and every /app/* route need the same store (LocalAuthService reads
// the account and credential through it) and the same auth context. Order
// matters: AuthProvider calls useMockStore(), so it must render inside
// MockDataProvider.
export function Providers({ children }: { children: ReactNode }) {
  return (
    <MockDataProvider>
      <AppearanceSync />
      <AutoBackupRunner />
      <AuthProvider>
        <ConfirmProvider>{children}</ConfirmProvider>
      </AuthProvider>
    </MockDataProvider>
  );
}
