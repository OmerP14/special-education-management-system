"use client";

import { useState } from "react";
import Link from "next/link";
import { FileSpreadsheet, DownloadCloud, DatabaseBackup, RotateCcw, AlertTriangle } from "lucide-react";
import { SettingsAccessGuard } from "@/components/settings/SettingsAccessGuard";
import { useMockStore } from "@/lib/mock/store";
import { CURRENT_USER } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/helpers/finance";

// ─── Dangerous action confirmation ──────────────────────────────────────────

function TypedConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  impact,
  confirmWord,
  confirmLabel,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  impact: string[];
  confirmWord: string;
  confirmLabel: string;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState("");
  const canConfirm = typed.trim() === confirmWord;

  const close = () => {
    setTyped("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(o) : close())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5">
          <p className="text-xs font-semibold text-destructive">Bu işlem şunları etkiler:</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs text-destructive/90">
            {impact.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Devam etmek için <span className="font-mono font-semibold text-foreground">{confirmWord}</span> yazın
          </label>
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={close}>
            Vazgeç
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={!canConfirm}
            onClick={() => {
              onConfirm();
              close();
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Action card ─────────────────────────────────────────────────────────────

function ActionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof FileSpreadsheet;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          <div className="mt-3">{children}</div>
        </div>
      </div>
    </div>
  );
}

function DataManagementContent() {
  const store = useMockStore();
  const { dataManagement } = store.institutionSettings;
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleBackup = () => {
    store.updateSettingsSection("dataManagement", {
      ...dataManagement,
      lastBackupAt: new Date().toISOString(),
      backupCount: dataManagement.backupCount + 1,
    });
    store.logAuditEvent({
      userName: CURRENT_USER.name,
      action: "backup_created",
      module: "data",
      recordLabel: "Manuel yedek",
    });
    showToast("Yedek alındı (mock — dosya üretilmez).");
  };

  const handleExport = (label: string) => {
    store.logAuditEvent({
      userName: CURRENT_USER.name,
      action: "data_exported",
      module: "data",
      recordLabel: label,
    });
    showToast(`${label} dışa aktarıldı (mock).`);
  };

  const handleRestore = () => {
    store.logAuditEvent({
      userName: CURRENT_USER.name,
      action: "backup_restored",
      module: "data",
      recordLabel: `Son yedek (${dataManagement.lastBackupAt ? formatDateTime(dataManagement.lastBackupAt) : "yok"})`,
    });
    showToast("Geri yükleme başlatıldı (mock — bu ortamda gerçek veri değişmez).");
  };

  const handleReset = () => {
    store.resetToDemo();
    showToast("Tüm veriler demo verilerine sıfırlandı.");
  };

  const toggleAutoBackup = (v: boolean) => {
    store.updateSettingsSection("dataManagement", { ...dataManagement, autoBackupEnabled: v });
  };

  return (
    <div className="space-y-4">
      {toast && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400">
          {toast}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-base font-semibold text-foreground">Excel ve Veri Yönetimi</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          İçe aktarım, dışa aktarım, yedekleme ve veri sıfırlama. Yedekleme/geri yükleme/dışa aktarma bu ortamda
          mock işlemlerdir — İşlem Geçmişi&apos;ne kaydedilir ancak gerçek dosya üretmez.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ActionCard
          icon={FileSpreadsheet}
          title="Excel İçe Aktarım"
          description="Öğrenci, öğretmen ve seans verilerini mevcut Excel içe aktarma sihirbazıyla yükleyin."
        >
          <Button size="sm" variant="outline" render={<Link href="/app/import" />}>
            İçe Aktarım Sihirbazını Aç
          </Button>
        </ActionCard>

        <ActionCard
          icon={DownloadCloud}
          title="Dışa Aktarım"
          description="Mevcut verileri CSV/PDF olarak dışa aktarın (mock — dosya indirilmez, işlem geçmişine kaydedilir)."
        >
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="outline" onClick={() => handleExport("Öğrenciler (CSV)")}>
              Öğrenciler (CSV)
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleExport("Finans Raporu (PDF)")}>
              Finans Raporu (PDF)
            </Button>
          </div>
        </ActionCard>

        <ActionCard
          icon={DatabaseBackup}
          title="Yedekleme"
          description={
            dataManagement.lastBackupAt
              ? `Son yedek: ${formatDateTime(dataManagement.lastBackupAt)} · Toplam ${dataManagement.backupCount} yedek`
              : "Henüz yedek alınmadı."
          }
        >
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" onClick={handleBackup}>
              Şimdi Yedek Al
            </Button>
            <Button size="sm" variant="outline" onClick={() => setRestoreOpen(true)}>
              Geri Yükle
            </Button>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2">
            <p className="text-xs text-foreground">Otomatik yedeklemeyi etkinleştir</p>
            <Switch checked={dataManagement.autoBackupEnabled} onCheckedChange={toggleAutoBackup} />
          </div>
        </ActionCard>

        <ActionCard
          icon={RotateCcw}
          title="Demo Verilerine Sıfırla"
          description="Tüm öğrenci, öğretmen, seans, ödeme ve ayar verilerini başlangıç demo verilerine döndürür. Geri alınamaz."
        >
          <Button size="sm" variant="destructive" onClick={() => setResetOpen(true)}>
            Verileri Sıfırla
          </Button>
        </ActionCard>
      </div>

      <TypedConfirmDialog
        open={restoreOpen}
        onOpenChange={setRestoreOpen}
        title="Yedeği Geri Yükle"
        description="Bu işlem, mevcut verilerin üzerine en son yedeği geri yükler."
        impact={["Son yedekten sonra yapılan tüm değişiklikler kaybolur", "Bu ortamda gerçek veri değişmez (mock)"]}
        confirmWord="GERİ YÜKLE"
        confirmLabel="Geri Yükle"
        onConfirm={handleRestore}
      />

      <TypedConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Tüm Verileri Sıfırla"
        description="Bu işlem tüm öğrenci, öğretmen, veli, seans, ödeme, hakediş ve ayar verilerini siler ve başlangıç demo verileriyle değiştirir."
        impact={[
          "Tüm öğrenci ve veli kayıtları silinir",
          "Tüm seans ve ödeme geçmişi silinir",
          "Tüm kurum ayarları varsayılana döner",
          "Bu işlem geri alınamaz",
        ]}
        confirmWord="SIFIRLA"
        confirmLabel="Verileri Sıfırla"
        onConfirm={handleReset}
      />
    </div>
  );
}

export default function DataManagementPage() {
  return (
    <SettingsAccessGuard sectionKey="data">
      <DataManagementContent />
    </SettingsAccessGuard>
  );
}
