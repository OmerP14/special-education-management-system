"use client";

import { useState } from "react";
import { UserPlus, ShieldCheck, Ban, RotateCcw } from "lucide-react";
import { SettingsAccessGuard } from "@/components/settings/SettingsAccessGuard";
import { useMockStore } from "@/lib/mock/store";
import { CURRENT_USER } from "@/lib/permissions";
import { FormDrawer } from "@/components/shared/FormDrawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateTime } from "@/lib/helpers/finance";
import { cn } from "@/lib/utils";
import type { AppUser, AppUserRole, AppUserStatus } from "@/types/settings";

const ROLE_LABELS: Record<AppUserRole, string> = {
  owner: "Sahip",
  admin: "Yönetici",
  teacher: "Öğretmen",
  accounting: "Muhasebe",
  front_desk: "Danışma",
  viewer: "Görüntüleyici",
};

const STATUS_CONFIG: Record<AppUserStatus, { label: string; className: string }> = {
  active: { label: "Aktif", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  invited: { label: "Davet Edildi", className: "bg-amber-100 text-amber-700 border-amber-200" },
  inactive: { label: "Pasif", className: "bg-gray-100 text-gray-600 border-gray-200" },
};

function StatusPill({ status }: { status: AppUserStatus }) {
  const c = STATUS_CONFIG[status];
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", c.className)}>
      {c.label}
    </span>
  );
}

// ─── Invite / edit drawer ───────────────────────────────────────────────────

interface UserFormState {
  name: string;
  email: string;
  role: AppUserRole;
}

const EMPTY_FORM: UserFormState = { name: "", email: "", role: "teacher" };

function UserFormDrawer({
  open,
  onOpenChange,
  initialData,
  existingEmails,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: AppUser;
  existingEmails: string[];
}) {
  const store = useMockStore();
  const isEditing = !!initialData;
  const [form, setForm] = useState<UserFormState>(
    initialData ? { name: initialData.name, email: initialData.email, role: initialData.role } : EMPTY_FORM
  );
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof UserFormState>(key: K, value: UserFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
  };

  const resetAndClose = () => {
    setForm(EMPTY_FORM);
    setError(null);
    onOpenChange(false);
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.email.trim()) return;
    const normalizedEmail = form.email.trim().toLowerCase();
    const isDuplicate = existingEmails
      .filter((e) => e !== initialData?.email.toLowerCase())
      .includes(normalizedEmail);
    if (isDuplicate) {
      setError("Bu e-posta adresiyle zaten bir kullanıcı veya davet var.");
      return;
    }

    if (isEditing) {
      store.updateAppUser({ ...initialData, name: form.name.trim(), email: form.email.trim(), role: form.role });
    } else {
      store.inviteAppUser({
        id: `user-${Date.now()}`,
        tenantId: "tenant-1",
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        status: "invited",
        invitedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
    }
    resetAndClose();
  };

  return (
    <FormDrawer
      open={open}
      onOpenChange={(o) => (o ? onOpenChange(o) : resetAndClose())}
      title={isEditing ? "Kullanıcıyı Düzenle" : "Kullanıcı Davet Et"}
      description={
        isEditing
          ? "Ad, e-posta ve rol bilgilerini güncelleyin."
          : "Davet edilen kullanıcı, gerçek kimlik doğrulama devreye girdiğinde giriş yapabilecek."
      }
      onSave={handleSave}
      saveLabel={isEditing ? "Değişiklikleri Kaydet" : "Davet Gönder"}
      saveDisabled={!form.name.trim() || !form.email.trim()}
    >
      <div className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="user-name">Ad Soyad</Label>
          <Input id="user-name" value={form.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="user-email">E-posta</Label>
          <Input
            id="user-email"
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            aria-invalid={!!error}
          />
          {error && <p className="text-xs font-medium text-destructive">{error}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Rol</Label>
          <Select value={form.role} onValueChange={(v) => { if (v) set("role", v as AppUserRole); }}>
            <SelectTrigger className="w-full">
              <SelectValue>{() => ROLE_LABELS[form.role]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(ROLE_LABELS) as AppUserRole[]).map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </FormDrawer>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

function UsersSettingsContent() {
  const store = useMockStore();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);

  const openInvite = () => {
    setEditingUser(null);
    setDrawerOpen(true);
  };
  const openEdit = (user: AppUser) => {
    setEditingUser(user);
    setDrawerOpen(true);
  };

  const activeOwnerCount = store.appUsers.filter((u) => u.role === "owner" && u.status === "active").length;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Kullanıcılar ve Roller</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Ekip üyeleri ve rol etiketleri. Rol adları görsel ve geleceğe hazırlıktır — bugün yetkiyi yalnızca
              Finans görünürlüğü açısından{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-[11px]">canViewFinance</code> kontrol eder.
            </p>
          </div>
          <Button size="sm" onClick={openInvite} className="gap-1.5">
            <UserPlus className="h-3.5 w-3.5" />
            Kullanıcı Davet Et
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Ad Soyad</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">E-posta</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Rol</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Durum</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Son Giriş</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {store.appUsers.map((u) => {
              const isSoleActiveOwner = u.role === "owner" && u.status === "active" && activeOwnerCount <= 1;
              return (
                <tr key={u.id} className="border-b border-border/60 last:border-b-0 hover:bg-muted/20">
                  <td className="px-4 py-2.5 font-medium text-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      {u.name}
                      {u.email === CURRENT_USER.email && (
                        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                          Siz
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-1 text-foreground">
                      {u.role === "owner" && <ShieldCheck className="h-3.5 w-3.5 text-primary" />}
                      {ROLE_LABELS[u.role]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusPill status={u.status} />
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>
                        Düzenle
                      </Button>
                      {u.status === "inactive" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => store.activateAppUser(u.id)}
                          className="gap-1 text-emerald-600 hover:text-emerald-700"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Etkinleştir
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => store.deactivateAppUser(u.id)}
                          disabled={isSoleActiveOwner}
                          title={isSoleActiveOwner ? "Tek aktif sahip devre dışı bırakılamaz" : undefined}
                          className="gap-1 text-destructive hover:text-destructive/80"
                        >
                          <Ban className="h-3.5 w-3.5" />
                          Devre Dışı Bırak
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

      <UserFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        initialData={editingUser ?? undefined}
        existingEmails={store.appUsers.map((u) => u.email.toLowerCase())}
      />
    </div>
  );
}

export default function UsersSettingsPage() {
  return (
    <SettingsAccessGuard sectionKey="users">
      <UsersSettingsContent />
    </SettingsAccessGuard>
  );
}
