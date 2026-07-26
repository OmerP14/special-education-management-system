"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { GraduationCap, Eye, EyeOff, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useMockStore } from "@/lib/mock/store";
import { LANDING_PAGE_ROUTES } from "@/lib/settings/landing-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const { signIn, isAuthenticated, isLoading } = useAuth();
  const { institutionSettings } = useMockStore();
  const landingPage = LANDING_PAGE_ROUTES[institutionSettings.appearance.defaultLandingPage];

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Already signed in (or just finished signing in) — don't leave an
  // authenticated visitor sitting on the login form.
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace(next ?? landingPage);
    }
  }, [isLoading, isAuthenticated, next, router, landingPage]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("E-posta ve şifre gereklidir.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await signIn({ email: email.trim(), password, remember });
    setSubmitting(false);
    if (!result.success) {
      setError(result.errorMessage ?? "Giriş yapılamadı.");
      return;
    }
    router.replace(next ?? landingPage);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Brand */}
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-sm">
            <GraduationCap className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">ÖzelEğitim</h1>
          <p className="text-sm text-muted-foreground">Yönetim Sistemi</p>
        </div>

        <Card>
          <form onSubmit={handleSubmit}>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Giriş Yap</CardTitle>
              <CardDescription>Hesabınıza erişmek için bilgilerinizi girin.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">E-posta</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@kurumunuz.com"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(null); }}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Şifre</Label>
                  <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground">
                    Şifremi unuttum
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(null); }}
                    className="pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-input accent-primary"
                />
                Beni hatırla
              </label>

              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <Button type="submit" className="mt-1 w-full" disabled={submitting}>
                {submitting ? "Giriş yapılıyor…" : "Giriş Yap"}
              </Button>
            </CardContent>
          </form>
          <CardFooter className="border-t pt-4">
            <p className="w-full text-center text-xs text-muted-foreground">
              Demo sistemi · Gerçek veri içermez
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
