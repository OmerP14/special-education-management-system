import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
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
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Giriş Yap</CardTitle>
            <CardDescription>
              Hesabınıza erişmek için bilgilerinizi girin.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">E-posta</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@kurumunuz.com"
                autoComplete="email"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Şifre</Label>
                <button className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  Şifremi unuttum
                </button>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
            <Link href="/app/dashboard">
              <Button className="w-full mt-1">Giriş Yap</Button>
            </Link>
          </CardContent>
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
