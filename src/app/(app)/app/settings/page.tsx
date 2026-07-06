"use client";

import { useState } from "react";
import { Settings, RotateCcw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMockStore } from "@/lib/mock/store";

export default function SettingsPage() {
  const store = useMockStore();
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  const handleReset = () => {
    store.resetToDemo();
    setConfirmVisible(false);
    setResetDone(true);
    setTimeout(() => setResetDone(false), 3000);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ayarlar"
        description="Kurum ve hesap ayarları"
      />

      {/* Demo data reset */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Settings className="h-3.5 w-3.5" />
            Demo Veri Yönetimi
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-foreground">Demo Veriyi Sıfırla</p>
            <p className="text-sm text-muted-foreground">
              Tüm mevcut kayıtları siler ve uygulamayı başlangıç demo durumuna geri yükler.
              Öğrenciler, veliler ve öğretmenler sıfırlanır; seans, ödeme ve kasa
              hareketleri tamamen temizlenir.
            </p>
          </div>

          {!confirmVisible && !resetDone && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmVisible(true)}
              className="gap-2"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Demo Veriyi Sıfırla
            </Button>
          )}

          {confirmVisible && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-destructive">
                    Bu işlem geri alınamaz.
                  </p>
                  <p className="mt-0.5 text-xs text-destructive/80">
                    Tüm eklenen kayıtlar (seanslar, ödemeler, taksit planları, kasa
                    hareketleri) kalıcı olarak silinir ve uygulama demo durumuna döner.
                    Devam etmek istiyor musunuz?
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleReset}
                  className="gap-2"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Evet, Sıfırla
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmVisible(false)}
                >
                  İptal
                </Button>
              </div>
            </div>
          )}

          {resetDone && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                Demo verisi başarıyla yüklendi.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
