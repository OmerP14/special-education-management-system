import type { ReactNode } from "react";

// Chrome-free wrapper for /login — deliberately no sidebar/topbar. The login
// page itself already centers its own content.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
