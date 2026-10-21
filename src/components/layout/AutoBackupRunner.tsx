"use client";

import { useEffect, useRef } from "react";
import { useStore } from "@/lib/data/store";
import { saveDailyAutoBackup } from "@/lib/data/persistence";
import { toLocalDateKey } from "@/lib/helpers/scheduling-rules";
import { initBackupFolder, useBackupFolder, writeBackupToFolder } from "@/lib/backup/backup-folder";

/** Ayarlar → Excel ve Veri Yönetimi → Otomatik yedekleme: keeps one backup
 *  per day in this browser (see saveDailyAutoBackup) and, when a folder was
 *  chosen, writes the day's file there too, refreshing it every 30 minutes
 *  so it holds the day's latest data. Renders nothing. */
export function AutoBackupRunner() {
  const store = useStore();
  const enabled = store.institutionSettings.dataManagement.autoBackupEnabled;
  const { status: folderStatus, location: folderLocation } = useBackupFolder();
  const storeRef = useRef(store);

  useEffect(() => {
    storeRef.current = store;
  });

  useEffect(() => {
    void initBackupFolder();
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const run = async () => {
      const today = toLocalDateKey(new Date());
      const snapshot = storeRef.current.getBackupSnapshot();
      const inBrowser = saveDailyAutoBackup(snapshot, today);
      const inFolder = await writeBackupToFolder(snapshot, today);
      if (inBrowser || inFolder === "created") storeRef.current.recordBackup();
    };
    void run();
    const timer = setInterval(() => void run(), 30 * 60_000);
    return () => clearInterval(timer);
    // Re-run as soon as a folder is chosen, moved or allowed again.
  }, [enabled, folderStatus, folderLocation]);

  return null;
}
