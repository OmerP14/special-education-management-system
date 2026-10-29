"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AlertCircle, CheckCircle2, UserCog } from "lucide-react";
import { staffAccountService } from "@/lib/auth/http-auth-service";
import { describePasswordPolicy, validatePasswordPolicy } from "@/lib/auth/password";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/helpers/finance";
import type { StaffAccountInfo } from "@/types/auth";

// Ayarlar → Personel Hesabı: the optional second login for people who only
// schedule lessons. What it can see is enforced on the server
// (src/lib/server/staff-view.ts); this page only opens, changes or closes it.

export default function StaffAccountPage() {
  const confirm = useConfirm();
  const [loaded, setLoaded] = useState(false);
  const [staff, setStaff] = useState<StaffAccountInfo | null>(null);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void staffAccountService.get().then((result) => {
      const current = result.data?.staff ?? null;
      setStaff(current);
      setName(current?.name ?? "");
      setUsername(current?.username ?? "");
      if (!result.success) setError(result.errorMessage ?? "Personel hesabı okunamadı.");
      setLoaded(true);
    });
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!name.trim() || !username.trim()) {
      setError("Ad ve kullanıcı adı gereklidir.");
      return;
    }
    if (!staff && !password) {
      setError("Personel hesabı için bir şifre belirleyin.");
      return;
    }
    const policyError = password ? validatePasswordPolicy(password) : null;
    if (policyError) {
      setError(policyError);
      return;
    }
    setBusy(true);
    const result = await staffAccountService.save({ name, username, password: password || undefined });
    setBusy(false);
    if (!result.success) {
      setError(result.errorMessage ?? "Kaydedilemedi.");
      return;
    }
    setMessage(
      !staff
        ? "Personel hesabı açıldı. Bu kullanıcı adı ve şifreyle giriş yapılabilir."
        : password
          ? "Bilgiler ve şifre güncellendi. Personel cihazlarındaki oturumlar kapandı."
          : "Bilgiler güncellendi."
    );
    setStaff(result.data?.staff ?? null);
    setPassword("");
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: "Personel hesabı kapatılsın mı?",
      description: "Bu hesapla giriş yapılamaz ve açık oturumlar kapanır. Kayıtlar silinmez.",
      confirmLabel: "Hesabı kapat",
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    const result = await staffAccountService.remove();
    setBusy(false);
    if (!result.success) {
      setError(result.errorMessage ?? "Hesap kapatılamadı.");
      return;
    }
    setStaff(null);
    setName("");
    setUsername("");
    setPassword("");
    setMessage("Personel hesabı kapatıldı.");
  };

  if (!loaded) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <UserCog className="h-4 w-4 text-muted-foreground" />
          Personel Hesabı
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Ders programını yönetecek kişiler için ikinci bir giriş hesabı. Bu hesap seansları, takvimi, öğrencileri ve
          öğretmenleri görür; ücretleri, ödemeleri, hakedişleri, raporları ve ayarları göremez.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="max-w-sm space-y-4">
          {staff && (
            <p className="text-sm text-muted-foreground">
              Son giriş: {staff.lastLoginAt ? formatDateTime(staff.lastLoginAt) : "henüz giriş yapılmadı"}
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="staff-name">Görünen ad</Label>
            <Input id="staff-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn. Sekreterlik" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="staff-username">Kullanıcı adı</Label>
            <Input
              id="staff-username"
              autoComplete="off"
              autoCapitalize="none"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="staff-password">{staff ? "Yeni şifre (değiştirmek için)" : "Şifre"}</Label>
            <Input
              id="staff-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{describePasswordPolicy()}</p>
          </div>

          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
          {message && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-50 px-3 py-2.5 dark:bg-emerald-950/20">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">{message}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={busy}>
              {staff ? "Kaydet" : "Personel Hesabı Aç"}
            </Button>
            {staff && (
              <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void handleDelete()}>
                Hesabı Kapat
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
