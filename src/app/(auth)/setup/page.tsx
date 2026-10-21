"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Eye, EyeOff, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { describePasswordPolicy, validatePasswordPolicy } from "@/lib/auth/password";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// First-run setup: shown only while no account exists. The institution
// enters its name and phone and creates its own login; afterwards the
// dashboard's "Başlarken" checklist takes over.
export default function SetupPage() {
  const router = useRouter();
  const { setup, needsSetup, isAuthenticated, isLoading } = useAuth();

  const [institutionName, setInstitutionName] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Already set up — this page has nothing to do.
  useEffect(() => {
    if (isLoading || needsSetup) return;
    router.replace(isAuthenticated ? "/app/dashboard" : "/login");
  }, [isLoading, needsSetup, isAuthenticated, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!institutionName.trim() || !phone.trim() || !name.trim() || !username.trim()) {
      setError("Lütfen tüm alanları doldurun.");
      return;
    }
    if (/\s/.test(username.trim())) {
      setError("Kullanıcı adı boşluk içeremez.");
      return;
    }
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
    const result = await setup({ name, username, password, institutionName, institutionPhone: phone });
    if (!result.success) {
      setSubmitting(false);
      setError(result.errorMessage ?? "Kurulum tamamlanamadı.");
      return;
    }
    router.replace("/app/dashboard");
  };

  if (isLoading || !needsSetup) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-sm">
            <GraduationCap className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Hoş geldiniz</h1>
          <p className="text-sm text-muted-foreground">Sistemi kullanmaya başlamak için kurumunuzu tanıtın.</p>
        </div>

        <Card>
          <form onSubmit={handleSubmit}>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Kurulum</CardTitle>
              <CardDescription>Bu bilgileri bir kez girersiniz. Sonra Ayarlar ve Profil sayfasından değiştirebilirsiniz.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <fieldset className="space-y-4">
                <legend className="mb-3 text-sm font-semibold text-foreground">Kurum bilgileri</legend>
                <div className="space-y-1.5">
                  <Label htmlFor="institution-name">Kurum adı</Label>
                  <Input
                    id="institution-name"
                    autoComplete="organization"
                    placeholder="Örn. Umut Özel Eğitim ve Rehabilitasyon Merkezi"
                    value={institutionName}
                    onChange={(e) => { setInstitutionName(e.target.value); setError(null); }}
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="institution-phone">Kurum telefonu</Label>
                  <Input
                    id="institution-phone"
                    type="tel"
                    autoComplete="tel"
                    placeholder="0 (5xx) xxx xx xx"
                    value={phone}
                    onChange={(e) => { setPhone(e.target.value); setError(null); }}
                  />
                </div>
              </fieldset>

              <div className="border-t" aria-hidden />
              <fieldset className="space-y-4">
                <legend className="mb-1 text-sm font-semibold text-foreground">Giriş bilgileri</legend>
                <p className="text-xs text-muted-foreground">
                  Kurumda sistemi kullanacak herkes bu kullanıcı adı ve şifreyle girer.
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="account-name">Adınız soyadınız</Label>
                  <Input
                    id="account-name"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => { setName(e.target.value); setError(null); }}
                  />
                  <p className="text-xs text-muted-foreground">Üst menüde görünür.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="account-username">Kullanıcı adı</Label>
                  <Input
                    id="account-username"
                    autoComplete="username"
                    autoCapitalize="none"
                    placeholder="Örn. umutmerkez"
                    value={username}
                    onChange={(e) => { setUsername(e.target.value); setError(null); }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="account-password">Şifre</Label>
                  <div className="relative">
                    <Input
                      id="account-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
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
                  <p className="text-xs text-muted-foreground">{describePasswordPolicy()}</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="account-password-confirm">Şifre (tekrar)</Label>
                  <Input
                    id="account-password-confirm"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setError(null); }}
                  />
                </div>
              </fieldset>

              {error && (
                <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Kuruluyor…" : "Kurulumu Tamamla"}
              </Button>
            </CardContent>
          </form>
        </Card>
      </div>
    </div>
  );
}
