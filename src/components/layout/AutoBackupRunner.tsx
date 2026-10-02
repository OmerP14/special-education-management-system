"use client";

import { useEffect, useRef } from "react";
import { useMockStore } from "@/lib/mock/store";
import { saveDailyAutoBackup } from "@/lib/mock/persistence";
import { toLocalDateKey } from "@/lib/helpers/scheduling-rules";

/** Ayarlar → Excel ve Veri Yönetimi → Otomatik yedekleme: keeps one backup
 *  per day in this browser (see saveDailyAutoBackup). Renders nothing. */
export function AutoBackupRunner() {
  const store = useMockStore();
  const enabled = store.institutionSettings.dataManagement.autoBackupEnabled;
  const storeRef = useRef(store);

  useEffect(() => {
    storeRef.current = store;
  });

  useEffect(() => {
    if (!enabled) return;
    const run = () => {
      if (saveDailyAutoBackup(storeRef.current.getBackupSnapshot(), toLocalDateKey(new Date()))) {
        storeRef.current.recordBackup();
      }
    };
    run();
    const timer = setInterval(run, 60 * 60_000);
    return () => clearInterval(timer);
  }, [enabled]);

  return null;
}
