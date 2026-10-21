"use client";

import type { ReactNode } from "react";
import { DataProvider } from "@/lib/data/store";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { ConfirmProvider } from "@/components/shared/ConfirmProvider";
import { AutoBackupRunner } from "@/components/layout/AutoBackupRunner";

// Wraps the WHOLE app (mounted from the root layout), not just /app/* — both
// /login and every /app/* route need the same auth context. Order matters:
// AuthProvider calls useStore() (to stamp settings changes with the account
// name), so it must render inside DataProvider.
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
