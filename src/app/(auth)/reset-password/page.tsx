"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GraduationCap, AlertCircle, CheckCircle2, ShieldX } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { describePasswordPolicy, validatePasswordPolicy } from "@/lib/auth/password";
import { useMockStore } from "@/lib/mock/store";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const { resetPassword, isLoading } = useAuth();
  const { passwordResets } = useMockStore();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Same load-time snapshot as accept-invite: a used/expired/unknown link is
  // rejected up front, not only after the user has typed a new password.
  const [loadedAt] = useState(() => Date.now());

  const resetEntry = passwordResets.find((t) => t.token === token);
  const invalid = !resetEntry || !!resetEntry.usedAt || new Date(resetEntry.expiresAt).getTime() <= loadedAt;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const policyError = validatePasswordPolicy(password);
    if (policyError) {
      setError(policyError);
      return;
    }
    if (password !== confirmPassword) {
      setError("Şifreler eşleşmiyor.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await resetPassword({ token, newPassword: password });
    setSubmitting(false);
    if (!result.success) {
      setError(result.errorMessage ?? "Şifre sıfırlanamadı.");
      return;
    }
    setSuccess(true);
    setTimeout(() => router.replace("/login"), 1500);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-sm">
            <GraduationCap className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">ÖzelEğitim</h1>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Yeni Şifre Belirle</CardTitle>
            <CardDescription>Hesabınız için yeni bir şifre girin.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Reset tokens live in client-only storage: render neither branch
                until the first client render settles, so server HTML matches. */}
            {isLoading ? (
              <div className="py-4" />
            ) : success ? (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-50 px-3 py-2.5 dark:bg-emerald-950/20">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  Şifreniz güncellendi, girişe yönlendiriliyorsunuz…
                </p>
              </div>
            ) : invalid ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <div className="rounded-full bg-destructive/10 p-3">
                  <ShieldX className="h-6 w-6 text-destructive" />
                </div>
                <p className="text-sm font-medium text-foreground">Sıfırlama bağlantısı geçersiz</p>
                <p className="text-xs text-muted-foreground">
                  Bu bağlantının süresi dolmuş veya zaten kullanılmış olabilir. Yeni bir sıfırlama bağlantısı isteyin.
                </p>
                <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
                  Yeni bağlantı iste
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="password">Yeni Şifre</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(null); }}
                    autoFocus
                  />
                <p className="text-xs text-muted-foreground">{describePasswordPolicy()}</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password">Yeni Şifre (Tekrar)</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setError(null); }}
                  />
                </div>
                {error && (
                  <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? "Kaydediliyor…" : "Şifreyi Güncelle"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
