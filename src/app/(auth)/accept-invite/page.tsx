"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GraduationCap, AlertCircle, ShieldX } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useMockStore } from "@/lib/mock/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function AcceptInviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const { getInvitationByToken, acceptInvitation, isAuthenticated, isLoading } = useAuth();
  const { roles } = useMockStore();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Captured once at mount rather than calling Date.now() directly during
  // render (impure) — a page load-time snapshot is all "is this link still
  // valid right now" needs here.
  const [loadedAt] = useState(() => Date.now());

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace("/app/dashboard");
  }, [isLoading, isAuthenticated, router]);

  const invitation = getInvitationByToken(token);
  const invalid = !invitation || invitation.status !== "pending" || new Date(invitation.expiresAt).getTime() <= loadedAt;
  const role = invitation ? roles.find((r) => r.id === invitation.roleId) : undefined;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError("Şifre en az 8 karakter olmalıdır.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Şifreler eşleşmiyor.");
      return;
    }
    if (!accepted) {
      setError("Devam etmek için kullanım şartlarını kabul etmelisiniz.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await acceptInvitation({ token, password });
    setSubmitting(false);
    if (!result.success) {
      setError(result.errorMessage ?? "Davet kabul edilemedi.");
      return;
    }
    router.replace("/app/dashboard");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-sm">
            <GraduationCap className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">ÖzelEğitim</h1>
          <p className="text-sm text-muted-foreground">Davetinizi tamamlayın</p>
        </div>

        <Card>
          {invalid ? (
            <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="rounded-full bg-destructive/10 p-3">
                <ShieldX className="h-6 w-6 text-destructive" />
              </div>
              <p className="text-sm font-medium text-foreground">Davet bağlantısı geçersiz</p>
              <p className="text-xs text-muted-foreground">
                Bu bağlantının süresi dolmuş, iptal edilmiş veya zaten kullanılmış olabilir. Kurum yöneticinizden
                yeni bir davet isteyin.
              </p>
            </CardContent>
          ) : (
            <form onSubmit={handleSubmit}>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Hesabınızı Aktifleştirin</CardTitle>
                <CardDescription>
                  {invitation!.email} · {role?.name ?? "—"} olarak davet edildiniz. Devam etmek için bir şifre
                  belirleyin.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="password">Şifre</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(null); }}
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password">Şifre (Tekrar)</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setError(null); }}
                  />
                </div>
                <label className="flex items-start gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(e) => { setAccepted(e.target.checked); setError(null); }}
                    className="mt-0.5 h-3.5 w-3.5 rounded border-input accent-primary"
                  />
                  Kullanım şartlarını ve KVKK aydınlatma metnini okudum, kabul ediyorum.
                </label>

                {error && (
                  <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? "Hesap oluşturuluyor…" : "Hesabımı Aktifleştir"}
                </Button>
              </CardContent>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={null}>
      <AcceptInviteForm />
    </Suspense>
  );
}
