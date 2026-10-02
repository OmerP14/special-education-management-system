"use client";

import { useEffect } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/** Shared body for the app's error.tsx boundaries — a crash in one page shows
 *  this (with a retry) instead of Next's default error screen. */
export function ErrorState({ error, reset }: ErrorStateProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="rounded-full bg-destructive/10 p-4">
        <TriangleAlert className="h-8 w-8 text-destructive" />
      </div>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold text-foreground">Bir hata oluştu</h1>
        <p className="text-sm text-muted-foreground">
          Bu sayfa yüklenirken beklenmeyen bir sorun çıktı. Tekrar deneyebilir ya da panele dönebilirsiniz.
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground tabular-nums">Hata kodu: {error.digest}</p>
        )}
      </div>
      <div className="flex gap-2">
        <Button onClick={reset}>Tekrar Dene</Button>
        <Button variant="outline" render={<Link href="/app/dashboard" />}>
          Panele Dön
        </Button>
      </div>
    </div>
  );
}
