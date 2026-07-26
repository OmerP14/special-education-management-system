"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { GraduationCap, Copy, Check } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    const result = await requestPasswordReset(email.trim());
    setSubmitting(false);
    setSubmitted(true);
    const token = result.success && result.data && "token" in result.data ? result.data.token : null;
    setResetLink(token ? `${window.location.origin}/reset-password?token=${token}` : null);
  };

  const copyLink = async () => {
    if (!resetLink) return;
    try {
      await navigator.clipboard.writeText(resetLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — link text is still shown below.
    }
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
            <CardTitle className="text-base">Şifremi Unuttum</CardTitle>
            <CardDescription>
              E-posta adresinizi girin — hesap varsa bir sıfırlama bağlantısı oluşturulur. Bu ortamda gerçek
              e-posta gönderimi yoktur (mock).
            </CardDescription>
          </CardHeader>
          {submitted ? (
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Bu e-posta adresine kayıtlı bir hesap varsa, aşağıda bağlantı görünür. 1 saat geçerlidir.
              </p>
              {resetLink ? (
                <div className="space-y-2">
                  <div className="break-all rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-foreground">
                    {resetLink}
                  </div>
                  <Button size="sm" variant="outline" onClick={copyLink} className="gap-1.5">
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Kopyalandı" : "Bağlantıyı Kopyala"}
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Bu e-posta adresiyle eşleşen bir hesap bulunamadı.</p>
              )}
            </CardContent>
          ) : (
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">E-posta</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? "Gönderiliyor…" : "Sıfırlama Bağlantısı Oluştur"}
                </Button>
              </CardContent>
            </form>
          )}
          <CardFooter className="border-t pt-4">
            <Link href="/login" className="w-full text-center text-xs text-muted-foreground hover:text-foreground">
              Girişe dön
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
