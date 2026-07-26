"use client";

import type { ReactNode } from "react";
import { MockDataProvider } from "@/lib/mock/store";
import { AuthProvider } from "@/lib/auth/AuthProvider";

// Wraps the WHOLE app (mounted from the root layout), not just /app/* — both
// /login and every /app/* route need the same store (LocalAuthService reads
// appUsers/credentials/roles through it) and the same auth context. Order
// matters: AuthProvider calls useMockStore(), so it must render inside
// MockDataProvider.
export function Providers({ children }: { children: ReactNode }) {
  return (
    <MockDataProvider>
      <AuthProvider>{children}</AuthProvider>
    </MockDataProvider>
  );
}
