"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { resolvePostLoginPath } from "@/lib/settings/landing-page";

// Client component (not a server redirect) so it waits for the session
// check (and the first-run setup check) to come back from the server. RouteGuard (mounted inside
// (app)/layout.tsx) still handles the actual auth check once we get there.
export default function RootPage() {
  const router = useRouter();
  const { isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    router.replace(resolvePostLoginPath(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  return null;
}
