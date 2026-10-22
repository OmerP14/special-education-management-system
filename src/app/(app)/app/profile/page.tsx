"use client";

import { useState, type FormEvent } from "react";
import { UserRound, CheckCircle2, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { describePasswordPolicy, validatePasswordPolicy } from "@/lib/auth/password";

// The signed-in account: display name, username and password (staff: only the
// password). Everyone sharing the login uses these, so a password change here
// signs out every other device (see changePassword in src/lib/server/auth-core.ts).
export default function ProfilePage() {
  const { user } = useAuth();
  if (!user) return null;
  // The staff account's name and username are set by the admin (Ayarlar →
  // Personel Hesabı); staff only change their own password here.
  if (user.role === "staff") {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Profil"
          description={`Personel hesabı: ${user.name} (${user.username}). Ad ve kullanıcı adını yönetici değiştirebilir.`}
        />
        <ChangePasswordCard />
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <PageHeader title="Profil" description="Yönetici hesabının bilgileri ve şifresi. Bu hesapla giren herkes aynı bilgileri kullanır." />
      <AccountInfoCard key={`${user.name}|${user.username}`} name={user.name} username={user.username} />
      <ChangePasswordCard />
    </div>
  );
}

function AccountInfoCard({ name: savedName, username: savedUsername }: { name: string; username: string }) {
  const { updateProfile } = useAuth();
  const [name, setName] = useState(savedName);
  const [username, setUsername] = useState(savedUsername);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const dirty = name !== savedName || username !== savedUsername;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const result = await updateProfile({ name, username });
    setSubmitting(false);
    setError(result.success ? null : result.errorMessage ?? "Bilgiler kaydedilemedi.");
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <UserRound className="h-4 w-4 text-muted-foreground" />
          Hesap Bilgileri
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="max-w-sm space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="account-name">Görünen ad</Label>
            <Input id="account-name" value={name} onChange={(e) => { setName(e.target.value); setError(null); }} />
            <p className="text-xs text-muted-foreground">Üst menüde görünür.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="account-username">Kullanıcı adı</Label>
            <Input
              id="account-username"
              autoComplete="username"
              autoCapitalize="none"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError(null); }}
            />
            <p className="text-xs text-muted-foreground">Giriş ekranında yazılır.</p>
          </div>
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
          <Button type="submit" size="sm" disabled={!dirty || submitting}>
            {submitting ? "Kaydediliyor…" : "Bilgileri Kaydet"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ChangePasswordCard() {
  const { changePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const policyError = validatePasswordPolicy(newPassword);
    if (policyError) {
      setError(policyError);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Yeni şifreler eşleşmiyor.");
      return;
    }
    setSubmitting(true);
    const result = await changePassword({ currentPassword, newPassword });
    setSubmitting(false);
    if (!result.success) {
      setError(result.errorMessage ?? "Şifre değiştirilemedi.");
      return;
    }
    setSuccess("Şifre güncellendi. Diğer cihazlardaki oturumlar kapandı; yeni şifreyle giriş yapmaları gerekir.");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Şifre Değiştir</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="max-w-sm space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="current-password">Mevcut Şifre</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-password">Yeni Şifre</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{describePasswordPolicy()}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Yeni Şifre (Tekrar)</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-50 px-3 py-2.5 dark:bg-emerald-950/20">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">{success}</p>
            </div>
          )}

          <Button type="submit" size="sm" disabled={submitting}>
            {submitting ? "Kaydediliyor…" : "Şifreyi Güncelle"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
