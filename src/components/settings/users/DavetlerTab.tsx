"use client";

import { useState } from "react";
import { Copy, RotateCcw, Ban, Check } from "lucide-react";
import { useMockStore } from "@/lib/mock/store";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/helpers/finance";
import { cn } from "@/lib/utils";
import type { Invitation, InvitationStatus } from "@/types/auth";

const STATUS_CONFIG: Record<InvitationStatus, { label: string; className: string }> = {
  pending: { label: "Bekliyor", className: "bg-amber-100 text-amber-700 border-amber-200" },
  accepted: { label: "Kabul Edildi", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  revoked: { label: "İptal Edildi", className: "bg-gray-100 text-gray-600 border-gray-200" },
  expired: { label: "Süresi Doldu", className: "bg-red-100 text-red-700 border-red-200" },
};

function effectiveStatus(invitation: Invitation): InvitationStatus {
  if (invitation.status === "pending" && new Date(invitation.expiresAt).getTime() <= Date.now()) return "expired";
  return invitation.status;
}

export function DavetlerTab() {
  const store = useMockStore();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const invitations = [...store.invitations].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const buildLink = (token: string) =>
    typeof window !== "undefined" ? `${window.location.origin}/accept-invite?token=${token}` : `/accept-invite?token=${token}`;

  const copyLink = async (invitation: Invitation) => {
    try {
      await navigator.clipboard.writeText(buildLink(invitation.token));
      setCopiedId(invitation.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Clipboard API unavailable — link is still visible in the row itself.
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-base font-semibold text-foreground">Davetler</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Gerçek e-posta gönderimi bağlı değil (mock) — davet bağlantısını kopyalayıp elle iletin. Bağlantılar 7
          gün geçerlidir ve tek kullanımlıktır.
        </p>
      </div>

      {invitations.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/20 py-16 text-center">
          <p className="text-sm text-muted-foreground">Henüz davet gönderilmedi.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">E-posta</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Rol</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Durum</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Gönderilme</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Son Geçerlilik</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {invitations.map((invitation) => {
                const status = effectiveStatus(invitation);
                const role = store.roles.find((r) => r.id === invitation.roleId);
                const user = store.appUsers.find((u) => u.id === invitation.userId);
                const c = STATUS_CONFIG[status];
                return (
                  <tr key={invitation.id} className="border-b border-border/60 last:border-b-0 hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-medium text-foreground">{invitation.email}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{role?.name ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", c.className)}>
                        {c.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{formatDateTime(invitation.createdAt)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{formatDateTime(invitation.expiresAt)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1.5">
                        {status === "pending" && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => copyLink(invitation)} className="gap-1">
                              {copiedId === invitation.id ? (
                                <>
                                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                                  Kopyalandı
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3.5 w-3.5" />
                                  Bağlantıyı Kopyala
                                </>
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => user && store.resendInvitation(user.id)}
                              className="gap-1"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              Yeniden Gönder
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => store.revokeInvitation(invitation.id)}
                              className="gap-1 text-destructive hover:text-destructive/80"
                            >
                              <Ban className="h-3.5 w-3.5" />
                              İptal Et
                            </Button>
                          </>
                        )}
                        {status === "expired" && user && (
                          <Button variant="ghost" size="sm" onClick={() => store.resendInvitation(user.id)} className="gap-1">
                            <RotateCcw className="h-3.5 w-3.5" />
                            Yeniden Gönder
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
