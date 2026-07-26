import type { ReactNode } from "react";

// Chrome-free wrapper for /login (and future /forgot-password,
// /accept-invite, /reset-password) — deliberately no sidebar/topbar. The
// login page itself already centers its own content; this exists so those
// deferred routes share the same "no app shell" placement without each
// re-deciding it.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
