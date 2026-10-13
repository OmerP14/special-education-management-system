"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { FileSpreadsheet, DownloadCloud, DatabaseBackup, RotateCcw, AlertTriangle } from "lucide-react";
import { useMockStore, type BackupData } from "@/lib/mock/store";
import { useAuth } from "@/lib/auth/AuthProvider";
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
import {
  formatDateDMY,
  formatDateTime,
  formatTime,
  getPaymentMethodLabel,
  getSessionStatusLabel,
  getStudentDebt,
  getStudentStatusLabel,
  getTeacherPaymentModelLabel,
  getTeacherStatusLabel,
} from "@/lib/helpers/finance";
import { downloadBlob, downloadCsv } from "@/lib/helpers/export";
import { buildBackupFile, loadAutoBackups, parseBackupFile } from "@/lib/mock/persistence";
import { toLocalDateKey } from "@/lib/helpers/scheduling-rules";
import { BackupFolderSection } from "@/components/settings/BackupFolderSection";

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

type ExportKind = "students" | "guardians" | "teachers" | "sessions" | "payments";

const EXPORT_LABELS: Record<ExportKind, string> = {
  students: "Öğrenciler",
  guardians: "Veliler",
  teachers: "Öğretmenler",
  sessions: "Seanslar",
  payments: "Ödemeler",
};

function DataManagementContent() {
  const store = useMockStore();
  const { user } = useAuth();
  const actorName = user?.name ?? "Bilinmeyen kullanıcı";
  const { dataManagement } = store.institutionSettings;
  const [pendingRestore, setPendingRestore] = useState<{ data: BackupData; label: string } | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [toast, setToast] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [autoBackups, setAutoBackups] = useState(() => loadAutoBackups<BackupData>());

  const showToast = (text: string, tone: "success" | "error" = "success") => {
    setToast({ tone, text });
    setTimeout(() => setToast(null), 4000);
  };

  const handleBackup = () => {
    const stamp = new Date();
    const name = `yedek-${toLocalDateKey(stamp)}-${String(stamp.getHours()).padStart(2, "0")}${String(stamp.getMinutes()).padStart(2, "0")}.json`;
    downloadBlob(
      name,
      new Blob([JSON.stringify(buildBackupFile(store.getBackupSnapshot()))], { type: "application/json" })
    );
    store.recordBackup();
    store.logAuditEvent({ userName: actorName, action: "backup_created", module: "data", recordLabel: name });
    showToast("Yedek dosyası indirildi.");
  };

  const handleFileChosen = async (file: File | undefined) => {
    if (!file) return;
    const parsed = parseBackupFile<BackupData>(await file.text());
    if ("error" in parsed) {
      showToast(parsed.error, "error");
      return;
    }
    setPendingRestore({
      data: parsed.data,
      label: `${file.name}${parsed.createdAt ? ` (${formatDateTime(parsed.createdAt)})` : ""}`,
    });
  };

  const handleRestore = () => {
    if (!pendingRestore) return;
    const error = store.restoreBackup(pendingRestore.data);
    if (error) showToast(error, "error");
    else showToast(`Yedek geri yüklendi: ${pendingRestore.label}`);
    setPendingRestore(null);
  };

  const handleExport = (kind: ExportKind) => {
    const date = toLocalDateKey(new Date());
    const nameOf = <T extends { id: string; fullName: string }>(list: T[], id: string) =>
      list.find((x) => x.id === id)?.fullName ?? "";
    if (kind === "students") {
      downloadCsv(
        `ogrenciler-${date}.csv`,
        ["Öğrenci No", "Ad Soyad", "Doğum Tarihi", "Durum", "Veli", "Veli Telefonu", "Eğitim Türleri", "Kalan Borç"],
        store.students.map((s) => {
          const guardian = store.guardians.find((g) => g.id === s.guardianIds[0]);
          return [
            s.studentNumber ?? "",
            s.fullName,
            s.birthDate ? formatDateDMY(s.birthDate) : "",
            getStudentStatusLabel(s.status),
            guardian?.fullName ?? "",
            guardian?.phone ?? "",
            s.educationTypeIds.map((id) => store.educationTypes.find((e) => e.id === id)?.name ?? "").join(", "),
            getStudentDebt(s.id, store.sessions, store.payments, store.openingBalances),
          ];
        })
      );
    } else if (kind === "guardians") {
      downloadCsv(
        `veliler-${date}.csv`,
        ["Ad Soyad", "Yakınlık", "Telefon", "E-posta", "Adres", "Öğrenciler"],
        store.guardians.map((g) => [
          g.fullName,
          g.relationship,
          g.phone,
          g.email ?? "",
          g.address ?? "",
          g.studentIds.map((id) => nameOf(store.students, id)).join(", "),
        ])
      );
    } else if (kind === "teachers") {
      downloadCsv(
        `ogretmenler-${date}.csv`,
        ["Ad Soyad", "Telefon", "E-posta", "Durum", "Hakediş Modeli"],
        store.teachers.map((t) => [t.fullName, t.phone, t.email ?? "", getTeacherStatusLabel(t.status), getTeacherPaymentModelLabel(t)])
      );
    } else if (kind === "sessions") {
      downloadCsv(
        `seanslar-${date}.csv`,
        ["Tarih", "Saat", "Öğrenci", "Öğretmen", "Eğitim Türü", "Süre (dk)", "Durum", "Ücret", "Öğretmen Hakedişi"],
        [...store.sessions]
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((s) => [
            formatDateDMY(s.date),
            formatTime(s.date),
            nameOf(store.students, s.studentId),
            nameOf(store.teachers, s.teacherId),
            store.educationTypes.find((e) => e.id === s.educationTypeId)?.name ?? "",
            s.durationMinutes,
            getSessionStatusLabel(s.status),
            s.studentPrice * s.sessionCount,
            s.teacherEarning * s.sessionCount,
          ])
      );
    } else {
      downloadCsv(
        `odemeler-${date}.csv`,
        ["Makbuz No", "Tarih", "Öğrenci", "Tutar", "Yöntem", "Açıklama"],
        [...store.payments]
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((p) => [
            p.receiptNumber ?? "",
            formatDateDMY(p.date),
            nameOf(store.students, p.studentId),
            p.amount,
            getPaymentMethodLabel(p.method),
            p.notes ?? "",
          ])
      );
    }
    store.logAuditEvent({
      userName: actorName,
      action: "data_exported",
      module: "data",
      recordLabel: `${EXPORT_LABELS[kind]} (CSV)`,
    });
  };

  const handleReset = () => {
    store.resetToDemo();
    showToast("Tüm veriler demo verilerine sıfırlandı.");
  };

  const toggleAutoBackup = (v: boolean) => {
    store.updateSettingsSection("dataManagement", { ...dataManagement, autoBackupEnabled: v });
    if (v) setTimeout(() => setAutoBackups(loadAutoBackups<BackupData>()), 500);
  };

  return (
    <div className="space-y-4">
      {toast && (
        <div
          className={
            toast.tone === "success"
              ? "rounded-lg border border-emerald-500/30 bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400"
              : "rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm font-medium text-destructive"
          }
        >
          {toast.text}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-base font-semibold text-foreground">Excel ve Veri Yönetimi</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          İçe aktarım, dışa aktarım, yedekleme ve veri sıfırlama. Veriler bu tarayıcıda saklandığından düzenli yedek
          almanız önerilir — yedek dosyası tüm kayıtları ve ayarları içerir.
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
          description="Kayıtları Excel'de açılabilen CSV dosyası olarak indirin. Finansal PDF raporları Raporlar sayfasındadır."
        >
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(EXPORT_LABELS) as ExportKind[]).map((kind) => (
              <Button key={kind} size="sm" variant="outline" onClick={() => handleExport(kind)}>
                {EXPORT_LABELS[kind]}
              </Button>
            ))}
            <Button size="sm" variant="ghost" render={<Link href="/app/reports" />}>
              Raporlar (PDF)
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
              Yedek Dosyası İndir
            </Button>
            <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
              Dosyadan Geri Yükle
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                void handleFileChosen(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2">
            <div>
              <p className="text-xs text-foreground">Otomatik yedeklemeyi etkinleştir</p>
              <p className="text-[11px] text-muted-foreground">
                Her gün yedek alınır: seçilen klasöre ve bu tarayıcıya (son 3 gün).
              </p>
            </div>
            <Switch checked={dataManagement.autoBackupEnabled} onCheckedChange={toggleAutoBackup} />
          </div>
          <BackupFolderSection onMessage={showToast} />
          {autoBackups.length > 0 && (
            <div className="mt-2 divide-y divide-border/60 rounded-lg border border-border/60">
              {autoBackups.map((b) => (
                <div key={b.createdAt} className="flex items-center justify-between gap-2 px-3 py-1.5">
                  <span className="text-xs tabular-nums text-muted-foreground">{formatDateTime(b.createdAt)}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs"
                    onClick={() => setPendingRestore({ data: b.data, label: `Otomatik yedek (${formatDateTime(b.createdAt)})` })}
                  >
                    Geri Yükle
                  </Button>
                </div>
              ))}
            </div>
          )}
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
        open={!!pendingRestore}
        onOpenChange={(open) => !open && setPendingRestore(null)}
        title="Yedeği Geri Yükle"
        description={`Mevcut tüm veriler şu yedekle değiştirilecek: ${pendingRestore?.label ?? ""}`}
        impact={[
          "Yedekten sonra yapılan tüm değişiklikler kaybolur",
          "Ayarlar da yedektekiyle değişir; giriş kullanıcı adı ve şifresi değişmez",
          "Öncesinde güncel durumun yedeğini almanız önerilir",
        ]}
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
          "Tüm kurum ayarları varsayılana döner (giriş bilgileri korunur)",
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
  return <DataManagementContent />;
}
