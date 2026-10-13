"use client";

import { Folder } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMockStore } from "@/lib/mock/store";
import { formatTime } from "@/lib/helpers/finance";
import { toLocalDateKey } from "@/lib/helpers/scheduling-rules";
import {
  BACKUP_FOLDER_NAME,
  KEEP_DAILY_BACKUP_FILES,
  chooseBackupFolder,
  forgetBackupFolder,
  grantBackupFolderPermission,
  useBackupFolder,
  writeBackupToFolder,
} from "@/lib/backup/backup-folder";

/** Ayarlar → Excel ve Veri Yönetimi → Yedekleme: the folder on this computer
 *  that daily backups are written to (see lib/backup/backup-folder.ts). */
export function BackupFolderSection({ onMessage }: { onMessage: (text: string, tone?: "success" | "error") => void }) {
  const store = useMockStore();
  const { dataManagement } = store.institutionSettings;
  const { status, location, lastWrite, error } = useBackupFolder();

  const choose = async () => {
    if (!(await chooseBackupFolder())) return;
    if (!dataManagement.autoBackupEnabled) {
      store.updateSettingsSection("dataManagement", { ...dataManagement, autoBackupEnabled: true });
    }
    onMessage("Yedek klasörü ayarlandı; günlük yedek buraya kaydedilecek.");
  };

  const backupNow = async () => {
    const result = await writeBackupToFolder(store.getBackupSnapshot(), toLocalDateKey(new Date()));
    if (result === "unavailable") onMessage("Yedek klasöre yazılamadı.", "error");
    else {
      if (result === "created") store.recordBackup();
      onMessage("Yedek klasöre kaydedildi.");
    }
  };

  if (status === "loading") return null;

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-border/60 px-3 py-2">
      <div className="flex items-start gap-2">
        <Folder className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-foreground">Bilgisayardaki yedek klasörü</p>
          {status === "unsupported" ? (
            <p className="text-[11px] text-muted-foreground">
              Bu tarayıcı bilgisayardaki bir klasöre yazmayı desteklemiyor; klasöre yedek için Chrome veya Edge kullanın.
              Yedekler şimdilik yalnızca bu tarayıcıda tutulur.
            </p>
          ) : status === "none" ? (
            <p className="text-[11px] text-muted-foreground">
              Henüz seçilmedi. Klasör Seç&apos;e basın, açılan pencerede Masaüstü&apos;nü seçip onaylayın; içinde
              &quot;{BACKUP_FOLDER_NAME}&quot; klasörü yoksa oluşturulur.
            </p>
          ) : (
            <>
              <p className="break-words text-[11px] font-medium text-foreground">{location}</p>
              <p className="text-[11px] text-muted-foreground">
                {status === "needs-permission"
                  ? "Tarayıcı bu klasöre yazmak için tekrar izin istiyor."
                  : lastWrite
                    ? `Son kayıt: ${lastWrite.fileName} (${formatTime(lastWrite.at)})`
                    : `Her gün yedek-YYYY-AA-GG.json adıyla bir dosya; son ${KEEP_DAILY_BACKUP_FILES} gün tutulur.`}
              </p>
            </>
          )}
          {error && <p className="text-[11px] text-destructive">{error}</p>}
        </div>
      </div>
      {status !== "unsupported" && (
        <div className="flex flex-wrap gap-1.5">
          {status === "none" && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => void choose()}>
              Klasör Seç
            </Button>
          )}
          {status === "needs-permission" && (
            <Button size="sm" className="h-7 text-xs" onClick={() => void grantBackupFolderPermission()}>
              İzin Ver
            </Button>
          )}
          {status === "granted" && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => void backupNow()}>
              Şimdi Klasöre Yedekle
            </Button>
          )}
          {(status === "granted" || status === "needs-permission") && (
            <>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => void choose()}>
                Konumu Değiştir
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => void forgetBackupFolder()}>
                Klasörü Kaldır
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
