"use client";

import { useMemo, useState } from "react";
import { UserPlus, ShieldCheck, Ban, RotateCcw, Send, Search } from "lucide-react";
import { useMockStore } from "@/lib/mock/store";
import { useAuth } from "@/lib/auth/AuthProvider";
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
import type { Role } from "@/types/auth";
import type { AppUser, AppUserStatus } from "@/types/settings";

const STATUS_CONFIG: Record<AppUserStatus, { label: string; className: string }> = {
  active: { label: "Aktif", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  invited: { label: "Davet Edildi", className: "bg-amber-100 text-amber-700 border-amber-200" },
  inactive: { label: "Pasif", className: "bg-gray-100 text-gray-600 border-gray-200" },
  locked: { label: "Kilitli", className: "bg-red-100 text-red-700 border-red-200" },
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
  roleId: string;
  teacherId: string;
  guardianId: string;
}

function emptyForm(defaultRoleId: string): UserFormState {
  return { name: "", email: "", roleId: defaultRoleId, teacherId: "", guardianId: "" };
}

function UserFormDrawer({
  open,
  onOpenChange,
  initialData,
  existingEmails,
  roles,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: AppUser;
  existingEmails: string[];
  roles: Role[];
}) {
  const store = useMockStore();
  const isEditing = !!initialData;
  const defaultRoleId = roles.find((r) => r.key === "teacher")?.id ?? roles[0]?.id ?? "";
  const [form, setForm] = useState<UserFormState>(
    initialData
      ? {
          name: initialData.name,
          email: initialData.email,
          roleId: initialData.roleId,
          teacherId: initialData.teacherId ?? "",
          guardianId: initialData.guardianId ?? "",
        }
      : emptyForm(defaultRoleId)
  );
  const [error, setError] = useState<string | null>(null);

  const selectedRole = roles.find((r) => r.id === form.roleId);
  const activeTeachers = store.teachers.filter((t) => t.status === "active");
  const guardians = store.guardians;

  const set = <K extends keyof UserFormState>(key: K, value: UserFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
  };

  const resetAndClose = () => {
    setForm(emptyForm(defaultRoleId));
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

    const teacherId = selectedRole?.key === "teacher" && form.teacherId ? form.teacherId : undefined;
    const guardianId = selectedRole?.key === "guardian" && form.guardianId ? form.guardianId : undefined;

    if (isEditing) {
      store.updateAppUser({
        ...initialData,
        name: form.name.trim(),
        email: form.email.trim(),
        roleId: form.roleId,
        teacherId,
        guardianId,
      });
    } else {
      store.inviteAppUser({
        id: `user-${Date.now()}`,
        tenantId: "tenant-1",
        name: form.name.trim(),
        email: form.email.trim(),
        roleId: form.roleId,
        teacherId,
        guardianId,
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
          : "Davet edilen kullanıcı, davet bağlantısıyla şifresini oluşturup hesabını aktifleştirebilecek (Davetler sekmesi)."
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
          <Select value={form.roleId} onValueChange={(v) => { if (v) set("roleId", v); }}>
            <SelectTrigger className="w-full">
              <SelectValue>{() => roles.find((r) => r.id === form.roleId)?.name ?? ""}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {roles.filter((r) => r.isActive).map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedRole?.key === "teacher" && (
          <div className="space-y-1.5">
            <Label>Bağlı Öğretmen Kaydı</Label>
            <Select value={form.teacherId} onValueChange={(v) => { if (v) set("teacherId", v); }}>
              <SelectTrigger className="w-full">
                <SelectValue>{() => activeTeachers.find((t) => t.id === form.teacherId)?.fullName ?? "Seçilmedi"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {activeTeachers.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              İleride bu öğretmenin kendi seans/takvim verilerini görebilmesi için kullanılacak.
            </p>
          </div>
        )}

        {selectedRole?.key === "guardian" && (
          <div className="space-y-1.5">
            <Label>Bağlı Veli Kaydı</Label>
            <Select value={form.guardianId} onValueChange={(v) => { if (v) set("guardianId", v); }}>
              <SelectTrigger className="w-full">
                <SelectValue>{() => guardians.find((g) => g.id === form.guardianId)?.fullName ?? "Seçilmedi"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {guardians.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              İleride bu velinin yalnızca kendi çocuğunun verilerini görebilmesi için kullanılacak.
            </p>
          </div>
        )}
      </div>
    </FormDrawer>
  );
}

// ─── Main tab ───────────────────────────────────────────────────────────────

export function KullanicilarTab() {
  const store = useMockStore();
  const { user: currentUser } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string | "all">("all");
  const [statusFilter, setStatusFilter] = useState<AppUserStatus | "all">("all");

  const openInvite = () => {
    setEditingUser(null);
    setDrawerOpen(true);
  };
  const openEdit = (user: AppUser) => {
    setEditingUser(user);
    setDrawerOpen(true);
  };

  const roleById = (id: string) => store.roles.find((r) => r.id === id);
  const activeOwnerCount = store.appUsers.filter(
    (u) => roleById(u.roleId)?.isOwnerRole && u.status === "active"
  ).length;

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return store.appUsers.filter((u) => {
      if (roleFilter !== "all" && u.roleId !== roleFilter) return false;
      if (statusFilter !== "all" && u.status !== statusFilter) return false;
      if (q && !u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [store.appUsers, search, roleFilter, statusFilter]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Kullanıcılar</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Ekip üyeleri. Roller sekmesinde tanımlı izinler nav/rota erişimini doğrudan kontrol eder.
            </p>
          </div>
          <Button size="sm" onClick={openInvite} className="gap-1.5">
            <UserPlus className="h-3.5 w-3.5" />
            Kullanıcı Davet Et
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ad veya e-posta ara…" className="h-9 w-56 pl-8" />
        </div>
        <Select value={roleFilter} onValueChange={(v) => { if (v) setRoleFilter(v); }}>
          <SelectTrigger className="h-9 w-40">
            <SelectValue>{() => (roleFilter === "all" ? "Tüm Roller" : roleById(roleFilter)?.name ?? "")}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Roller</SelectItem>
            {store.roles.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => { if (v) setStatusFilter(v as AppUserStatus | "all"); }}>
          <SelectTrigger className="h-9 w-36">
            <SelectValue>{() => (statusFilter === "all" ? "Tüm Durumlar" : STATUS_CONFIG[statusFilter].label)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Durumlar</SelectItem>
            {(Object.keys(STATUS_CONFIG) as AppUserStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_CONFIG[s].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Filtrelere uyan kullanıcı bulunamadı.
                </td>
              </tr>
            ) : (
              filteredUsers.map((u) => {
                const role = roleById(u.roleId);
                const isSoleActiveOwner = !!role?.isOwnerRole && u.status === "active" && activeOwnerCount <= 1;
                return (
                  <tr key={u.id} className="border-b border-border/60 last:border-b-0 hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-medium text-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        {u.name}
                        {u.email === currentUser?.email && (
                          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                            Siz
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1 text-foreground">
                        {role?.isOwnerRole && <ShieldCheck className="h-3.5 w-3.5 text-primary" />}
                        {role?.name ?? "—"}
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
                        {u.status === "invited" && (
                          <Button variant="ghost" size="sm" onClick={() => store.resendInvitation(u.id)} className="gap-1">
                            <Send className="h-3.5 w-3.5" />
                            Daveti Yeniden Gönder
                          </Button>
                        )}
                        {u.status === "inactive" || u.status === "locked" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => store.activateAppUser(u.id)}
                            className="gap-1 text-emerald-600 hover:text-emerald-700"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            {u.status === "locked" ? "Kilidi Aç" : "Etkinleştir"}
                          </Button>
                        ) : u.status === "active" ? (
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
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <UserFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        initialData={editingUser ?? undefined}
        existingEmails={store.appUsers.map((u) => u.email.toLowerCase())}
        roles={store.roles}
      />
    </div>
  );
}
