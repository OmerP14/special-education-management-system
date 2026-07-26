"use client";

import { useAuth } from "@/lib/auth/AuthProvider";
import { useMockStore } from "@/lib/mock/store";
import { getCurrentUserScope, type CurrentUserScope } from "@/lib/auth/scope";

/** The one place components read `useAuth()` + `useMockStore().guardians`
 *  together to build a CurrentUserScope — every page that needs scoped data
 *  calls this instead of re-deriving teacherId/guardianId/linkedStudentIds
 *  itself. See lib/auth/scope.ts for the getScopedX/canAccessX functions
 *  this feeds. */
export function useUserScope(): CurrentUserScope {
  const { user } = useAuth();
  const { guardians } = useMockStore();
  return getCurrentUserScope(user, guardians);
}
