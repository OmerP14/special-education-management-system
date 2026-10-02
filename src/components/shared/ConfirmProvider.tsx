"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useMockStore } from "@/lib/mock/store";

/** Which Ayarlar → Güvenlik ve Sistem rule gates a confirmation. */
export type ConfirmKind = "sensitive" | "financial" | "export";

export interface ConfirmOptions {
  kind: ConfirmKind;
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * App-wide confirmation dialog. `confirm()` resolves true straight away when
 * the matching rule is off — "Hassas işlemlerde onay iste", "Finansal
 * düzenlemede onay iste", "Veri dışa aktarımında onay iste".
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { security } = useMockStore().institutionSettings;
  const [pending, setPending] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    const rules = security;
    const required =
      options.kind === "sensitive"
        ? rules.confirmSensitiveActions
        : options.kind === "financial"
          ? rules.confirmFinancialEdits
          : rules.confirmDataExport;
    if (!required) return Promise.resolve(true);
    resolver.current?.(false);
    setPending(options);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, [security]);

  const settle = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setPending(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={!!pending} onOpenChange={(open) => !open && settle(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pending?.title}</DialogTitle>
            {pending?.description && <DialogDescription>{pending.description}</DialogDescription>}
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => settle(false)}>
              Vazgeç
            </Button>
            <Button variant={pending?.destructive ? "destructive" : "default"} onClick={() => settle(true)}>
              {pending?.confirmLabel ?? "Onayla"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}
