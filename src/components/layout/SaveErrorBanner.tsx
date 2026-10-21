"use client";

import { AlertTriangle } from "lucide-react";
import { useStore } from "@/lib/data/store";

/** Shown while the latest changes couldn't reach the server. Saving retries
 *  by itself; the user just mustn't close the page meanwhile. */
export function SaveErrorBanner() {
  const { saveFailed } = useStore();
  if (!saveFailed) return null;
  return (
    <div role="alert" className="flex items-start gap-2 border-b border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        Son değişiklikler sunucuya kaydedilemedi. İnternet bağlantınızı kontrol edin; bağlantı gelince kendiliğinden kaydedilir.
        Bu sırada sayfayı kapatmayın.
      </p>
    </div>
  );
}
