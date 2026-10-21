"use client";

import type { ReactNode } from "react";
import { DataProvider } from "@/lib/data/store";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { ConfirmProvider } from "@/components/shared/ConfirmProvider";
import { AutoBackupRunner } from "@/components/layout/AutoBackupRunner";

// Wraps the WHOLE app (mounted from the root layout), not just /app/* — both
// /login and every /app/* route need the same store (LocalAuthService reads
// the account and credential through it) and the same auth context. Order
// matters: AuthProvider calls useStore(), so it must render inside
// DataProvider.
export function Providers({ children }: { children: ReactNode }) {
  return (
    <DataProvider>
      <AutoBackupRunner />
      <AuthProvider>
        <ConfirmProvider>{children}</ConfirmProvider>
      </AuthProvider>
    </DataProvider>
  );
}
