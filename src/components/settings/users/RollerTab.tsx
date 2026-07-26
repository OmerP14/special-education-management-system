"use client";

import { useState } from "react";
import { Plus, Copy, Ban, ShieldCheck, Lock } from "lucide-react";
import { useMockStore } from "@/lib/mock/store";
import { FormDrawer } from "@/components/shared/FormDrawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RolePermissionEditor } from "@/components/settings/users/RolePermissionEditor";
import { cn } from "@/lib/utils";
import type { Role } from "@/types/auth";

interface RoleFormState {
  name: string;
  description: string;
  permissions: string[];
}

function slugify(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9ğüşıöç\s-]/g, "")
      .replace(/[ğüşıöç]/g, (c) => ({ ğ: "g", ü: "u", ş: "s", ı: "i", ö: "o", ç: "c" })[c] ?? c)
      .replace(/\s+/g, "-") || "rol"
  );
}

function RoleFormDrawer({
  open,
  onOpenChange,
  initialData,
  cloneFrom,
  existingKeys,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Role;
  /** Pre-fills a NEW role's form from an existing role's permissions —
   *  distinct from `initialData`: this always goes through createRole, never
   *  updateRole, no matter which role it was copied from. */
  cloneFrom?: Role;
  existingKeys: string[];
}) {
  const store = useMockStore();
  const isEditing = !!initialData;
  const [form, setForm] = useState<RoleFormState>(
    initialData
      ? { name: initialData.name, description: initialData.description, permissions: initialData.permissions }
      : cloneFrom
        ? { name: `${cloneFrom.name} (Kopya)`, description: cloneFrom.description, permissions: [...cloneFrom.permissions] }
        : { name: "", description: "", permissions: [] }
  );
  const [error, setError] = useState<string | null>(null);

  const resetAndClose = () => {
    setForm({ name: "", description: "", permissions: [] });
    setError(null);
    onOpenChange(false);
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    const now = new Date().toISOString();

    if (isEditing) {
      store.updateRole({
        ...initialData,
        name: form.name.trim(),
        description: form.description.trim(),
        permissions: form.permissions,
        updatedAt: now,
      });
    } else {
      const baseKey = slugify(form.name);
      let key = baseKey;
      let n = 2;
      while (existingKeys.includes(key)) {
        key = `${baseKey}-${n++}`;
      }
      store.createRole({
        id: `role-${key}-${Date.now()}`,
        key,
        name: form.name.trim(),
        description: form.description.trim(),
        isSystemRole: false,
        isOwnerRole: false,
        isActive: true,
        permissions: form.permissions,
        createdAt: now,
        updatedAt: now,
      });
    }
    resetAndClose();
  };

  const isOwnerRole = initialData?.isOwnerRole;

  return (
    <FormDrawer
      open={open}
      onOpenChange={(o) => (o ? onOpenChange(o) : resetAndClose())}
      title={isEditing ? "Rolü Düzenle" : "Yeni Rol Oluştur"}
      description={
        isOwnerRole
          ? "Sahip rolü tüm izinlere sahiptir ve düzenlenemez — yalnızca ad/açıklama güncellenebilir."
          : "İzinleri modül bazında seçin."
      }
      onSave={handleSave}
      saveLabel={isEditing ? "Değişiklikleri Kaydet" : "Rolü Oluştur"}
      saveDisabled={!form.name.trim()}
    >
      <div className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="role-name">Rol Adı</Label>
          <Input id="role-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          {error && <p className="text-xs font-medium text-destructive">{error}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="role-description">Açıklama</Label>
          <Input
            id="role-description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>İzinler</Label>
          <RolePermissionEditor
            value={form.permissions}
            onChange={(next) => setForm((f) => ({ ...f, permissions: next }))}
            readOnly={isOwnerRole}
          />
        </div>
        {isEditing && initialData?.isSystemRole && !isOwnerRole && (
          <p className="text-xs text-muted-foreground">
            Bu bir sistem rolü — adı silinemez veya devre dışı bırakılamaz, ancak izinleri özelleştirilebilir.
          </p>
        )}
      </div>
    </FormDrawer>
  );
}

export function RollerTab() {
  const store = useMockStore();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [cloneSource, setCloneSource] = useState<Role | null>(null);

  const usageCount = (roleId: string) => store.appUsers.filter((u) => u.roleId === roleId).length;

  const openCreate = () => {
    setEditingRole(null);
    setCloneSource(null);
    setDrawerOpen(true);
  };
  const openEdit = (role: Role) => {
    setEditingRole(role);
    setCloneSource(null);
    setDrawerOpen(true);
  };
  const openClone = (role: Role) => {
    setEditingRole(null);
    setCloneSource(role);
    setDrawerOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Roller</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Sistem rolleri (7 adet) silinemez ama izinleri özelleştirilebilir. Özel roller oluşturup
              kullanıcılara atayabilirsiniz.
            </p>
          </div>
          <Button size="sm" onClick={openCreate} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Yeni Rol
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {store.roles.map((role) => {
          const usage = usageCount(role.id);
          const canDeactivate = !role.isSystemRole && usage === 0 && role.isActive;
          return (
            <div key={role.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    {role.isOwnerRole && <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" />}
                    <h3 className="truncate text-sm font-semibold text-foreground">{role.name}</h3>
                    {!role.isActive && (
                      <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                        Pasif
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{role.description}</p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                    role.isSystemRole
                      ? "border-border text-muted-foreground"
                      : "border-primary/30 bg-primary/5 text-primary"
                  )}
                >
                  {role.isSystemRole ? "Sistem" : "Özel"}
                </span>
              </div>

              <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                <span>{role.permissions.includes("*") ? "Tüm izinler" : `${role.permissions.length} izin`}</span>
                <span>·</span>
                <span>{usage} kullanıcı</span>
              </div>

              <div className="mt-3 flex items-center gap-1.5 border-t border-border/60 pt-3">
                <Button variant="ghost" size="sm" onClick={() => openEdit(role)}>
                  Düzenle
                </Button>
                <Button variant="ghost" size="sm" onClick={() => openClone(role)} className="gap-1">
                  <Copy className="h-3.5 w-3.5" />
                  Kopyala
                </Button>
                {!role.isSystemRole && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!canDeactivate}
                    title={
                      !role.isActive
                        ? "Zaten pasif"
                        : usage > 0
                          ? "Bu role atanmış kullanıcılar olduğu için devre dışı bırakılamaz"
                          : undefined
                    }
                    onClick={() => store.deactivateRole(role.id)}
                    className="gap-1 text-destructive hover:text-destructive/80"
                  >
                    {role.isActive ? <Ban className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                    Devre Dışı Bırak
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <RoleFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        initialData={editingRole ?? undefined}
        cloneFrom={cloneSource ?? undefined}
        existingKeys={store.roles.map((r) => r.key)}
      />
    </div>
  );
}
