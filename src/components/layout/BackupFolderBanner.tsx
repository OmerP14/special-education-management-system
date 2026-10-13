"use client";

import { FolderLock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMockStore } from "@/lib/mock/store";
import { grantBackupFolderPermission, useBackupFolder } from "@/lib/backup/backup-folder";

/** After a browser restart the browser may ask again before the app can
 *  write to the backup folder — that needs a click, so it is asked here. */
export function BackupFolderBanner() {
  const enabled = useMockStore().institutionSettings.dataManagement.autoBackupEnabled;
  const { status, location } = useBackupFolder();
  if (!enabled || status !== "needs-permission") return null;
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-amber-500/30 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
      <FolderLock className="h-4 w-4 shrink-0" />
      <p className="flex-1">
        Otomatik yedeğin <span className="font-medium">{location}</span> klasörüne yazılabilmesi için tarayıcı izin istiyor.
      </p>
      <Button size="sm" variant="outline" className="h-7" onClick={() => void grantBackupFolderPermission()}>
        İzin Ver
      </Button>
    </div>
  );
}
