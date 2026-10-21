"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { useStore } from "@/lib/data/store";

/** Shown while the latest change couldn't be saved to this browser — without
 *  it the user keeps working and loses everything on the next reload. */
export function StorageFullBanner() {
  const { storageFull } = useStore();
  if (!storageFull) return null;
  return (
    <div className="flex items-start gap-2 border-b border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        Son değişiklikler bu tarayıcıya kaydedilemedi (depolama alanı dolu). Sayfayı yenilemeden önce{" "}
        <Link href="/app/settings/data" className="font-medium underline">
          Veri Yönetimi
        </Link>
        &apos;nden yedek dosyası indirin; aksi halde bu değişiklikler kaybolur.
      </p>
    </div>
  );
}
