"use client";

import { ErrorState } from "@/components/shared/ErrorState";

// Sits inside (app)/layout.tsx, so a crashing page keeps the sidebar/topbar
// and the user can navigate elsewhere without a full reload.
export default function AppError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState {...props} />;
}
