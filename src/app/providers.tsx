"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { ConfirmProvider } from "@/components/shared/ConfirmProvider";

// Wraps the WHOLE app (mounted from the root layout): /login, /setup and
// every /app/* route share the auth context. The data store is NOT here — it
// loads inside (app)/layout.tsx once the visitor is signed in.
export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ConfirmProvider>{children}</ConfirmProvider>
    </AuthProvider>
  );
}
