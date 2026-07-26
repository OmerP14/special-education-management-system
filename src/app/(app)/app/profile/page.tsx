"use client";

import { useState, type FormEvent } from "react";
import { UserRound, CheckCircle2, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

// Minimal, read-only-plus-change-password profile page — full profile
// editing (avatar, notification preferences, default landing page, active
// sessions/device placeholder) is deferred; this exists so the topbar's
// "Profil" menu item has a real destination instead of a dead link, and so
// changePassword (already implemented in LocalAuthService) is reachable from
// somewhere in the UI.
export default function ProfilePage() {
  const { user, role, changePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!user) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (newPassword.length < 8) {
      setError("Yeni şifre en az 8 karakter olmalıdır.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Yeni şifreler eşleşmiyor.");
      return;
    }
    setSubmitting(true);
    const result = await changePassword({ userId: user.id, currentPassword, newPassword });
    setSubmitting(false);
    if (!result.success) {
      setError(result.errorMessage ?? "Şifre değiştirilemedi.");
      return;
    }
    setSuccess("Şifreniz güncellendi.");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Profil" description="Hesap bilgileriniz ve şifre değişikliği." />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <UserRound className="h-4 w-4 text-muted-foreground" />
            Hesap Bilgileri
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Ad Soyad</dt>
              <dd className="text-sm font-medium text-foreground">{user.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">E-posta</dt>
              <dd className="text-sm font-medium text-foreground">{user.email}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Rol</dt>
              <dd className="text-sm font-medium text-foreground">{role?.name ?? "—"}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

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
    </div>
  );
}
