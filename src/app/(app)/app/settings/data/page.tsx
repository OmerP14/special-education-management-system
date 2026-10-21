"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { FileSpreadsheet, DownloadCloud, DatabaseBackup, Trash2, AlertTriangle } from "lucide-react";
import { useStore, type BackupData } from "@/lib/data/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { buildBackupFile, loadAutoBackups, parseBackupFile } from "@/lib/data/persistence";
import { toLocalDateKey } from "@/lib/helpers/scheduling-rules";
import { BackupFolderSection } from "@/components/settings/BackupFolderSection";

// ─── Dangerous action confirmation ──────────────────────────────────────────
// The user types EVET (no Turkish-only letters, any case) — hard to do by
// accident, easy to do on purpose.

const CONFIRM_WORD = "EVET";

function TypedConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  impact,
  confirmLabel,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  impact: string[];
  confirmLabel: string;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState("");
  const canConfirm = typed.trim().toLocaleUpperCase("tr") === CONFIRM_WORD;

  const close = () => {
    setTyped("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(o) : close())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg text-destructive">
            <AlertTriangle className="h-5 w-5" aria-hidden />
            {title}
          </DialogTitle>
          <DialogDescription className="text-base">{description}</DialogDescription>
        </DialogHeader>

        <ul className="list-inside list-disc space-y-1 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {impact.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>

        <div className="space-y-2">
          <label htmlFor="confirm-word" className="text-sm text-foreground">
            Emin iseniz kutuya <strong>{CONFIRM_WORD}</strong> yazın:
          </label>
          <Input
            id="confirm-word"
            className="h-11 text-base"
            autoComplete="off"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoFocus
          />
        </div>

        <DialogFooter>
          <Button variant="outline" size="lg" onClick={close}>
            Vazgeç
          </Button>
          <Button
            variant="destructive"
            size="lg"
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

// ─── Section card ────────────────────────────────────────────────────────────

function ActionCard({
  icon: Icon,
  title,
  description,
  tone = "default",
  children,
}: {
  icon: typeof FileSpreadsheet;
  title: string;
  description: React.ReactNode;
  tone?: "default" | "danger";
  children: React.ReactNode;
}) {
  return (
    <section
      className={
        tone === "danger"
          ? "rounded-xl border border-destructive/30 bg-card p-5"
          : "rounded-xl border border-border bg-card p-5"
      }
    >
      <div className="flex items-start gap-3">
        <div
          className={
            tone === "danger"
              ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive"
              : "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
          }
        >
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </section>
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
  const store = useStore();
  const { dataManagement } = store.institutionSettings;
  const [pendingRestore, setPendingRestore] = useState<{ data: BackupData; label: string } | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [toast, setToast] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [autoBackups] = useState(() => loadAutoBackups<BackupData>());

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
    showToast("Yedek dosyası bilgisayarınıza indirildi (İndirilenler klasörü).");
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
    else showToast("Yedeğe geri dönüldü.");
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
  };

  const handleClearAll = () => {
    store.clearAllRecords();
    showToast("Tüm kayıtlar silindi.");
  };

  return (
    <div className="space-y-4">
      {toast && (
        <div
          role={toast.tone === "error" ? "alert" : "status"}
          className={
            toast.tone === "success"
              ? "rounded-lg border border-emerald-500/30 bg-emerald-50 px-4 py-3 text-base font-medium text-emerald-800"
              : "rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-base font-medium text-destructive"
          }
        >
          {toast.text}
        </div>
      )}

      <ActionCard
        icon={DatabaseBackup}
        title="Yedekleme"
        description={
          <>
            Bütün kayıtlarınız sunucuda güvenle saklanır ve her cihazdan görünür. Ek güvence için sistem her gün
            kendiliğinden yedek alır; önemli işlerden sonra <strong>Yedek Al</strong> ile bir kopyayı bilgisayarınıza da indirebilirsiniz.
            <span className="mt-1 block font-medium text-foreground">
              {dataManagement.lastBackupAt
                ? `Son yedek: ${formatDateTime(dataManagement.lastBackupAt)}`
                : "Henüz yedek alınmadı."}
            </span>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" onClick={handleBackup}>
            <DownloadCloud className="h-4 w-4" aria-hidden />
            Yedek Al
          </Button>
          <Button size="lg" variant="outline" onClick={() => fileInputRef.current?.click()}>
            Yedekten Geri Yükle
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            aria-label="Yedek dosyası seç"
            onChange={(e) => {
              void handleFileChosen(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
        <BackupFolderSection onMessage={showToast} />
        {autoBackups.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-medium text-foreground">Son günlerin otomatik yedekleri</p>
            <div className="mt-2 divide-y divide-border/60 rounded-lg border border-border/60">
              {autoBackups.map((b) => (
                <div key={b.createdAt} className="flex items-center justify-between gap-2 px-4 py-2.5">
                  <span className="text-sm tabular-nums text-foreground">{formatDateTime(b.createdAt)}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPendingRestore({ data: b.data, label: `Otomatik yedek (${formatDateTime(b.createdAt)})` })}
                  >
                    Bu Yedeğe Dön
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </ActionCard>

      <div className="grid gap-4 md:grid-cols-2">
        <ActionCard
          icon={FileSpreadsheet}
          title="Excel'den Bilgi Aktar"
          description="Elinizdeki Excel dosyasındaki öğrenci, öğretmen ve ders bilgilerini sisteme aktarın."
        >
          <Button size="lg" variant="outline" render={<Link href="/app/import" />}>
            Excel Dosyası Yükle
          </Button>
        </ActionCard>

        <ActionCard
          icon={DownloadCloud}
          title="Excel'e Aktar"
          description="Listeleri Excel'de açılabilen bir dosya olarak bilgisayarınıza indirin."
        >
          <div className="flex flex-wrap gap-2">
            {(Object.keys(EXPORT_LABELS) as ExportKind[]).map((kind) => (
              <Button key={kind} variant="outline" onClick={() => handleExport(kind)}>
                {EXPORT_LABELS[kind]}
              </Button>
            ))}
          </div>
        </ActionCard>
      </div>

      <ActionCard
        icon={Trash2}
        tone="danger"
        title="Tüm Kayıtları Sil"
        description="Öğrenci, veli, öğretmen, ders ve ödeme kayıtlarının hepsini siler. Kurum bilgileri, eğitim türleri ve ayarlar silinmez. Bu işlem geri alınamaz; önce yedek almayı unutmayın."
      >
        <Button size="lg" variant="destructive" onClick={() => setClearOpen(true)}>
          Tüm Kayıtları Sil
        </Button>
      </ActionCard>

      <TypedConfirmDialog
        open={!!pendingRestore}
        onOpenChange={(open) => !open && setPendingRestore(null)}
        title="Yedeğe Geri Dön"
        description={`Şu anki bütün kayıtların yerine bu yedek gelecek: ${pendingRestore?.label ?? ""}`}
        impact={[
          "Yedekten sonra girilen bütün bilgiler kaybolur",
          "Giriş kullanıcı adı ve şifresi değişmez",
        ]}
        confirmLabel="Yedeğe Geri Dön"
        onConfirm={handleRestore}
      />

      <TypedConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title="Tüm Kayıtları Sil"
        description="Bütün öğrenci, veli, öğretmen, ders, ödeme ve öğretmen ödemesi kayıtları silinecek."
        impact={[
          "Kurum bilgileri, eğitim türleri ve ayarlar korunur",
          "Bu işlem geri alınamaz",
        ]}
        confirmLabel="Hepsini Sil"
        onConfirm={handleClearAll}
      />
    </div>
  );
}

export default function DataManagementPage() {
  return <DataManagementContent />;
}
