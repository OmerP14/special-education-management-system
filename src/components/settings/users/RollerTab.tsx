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
import type { Role, RoleRecordScope } from "@/types/auth";
import { RECORD_SCOPE_LABELS, getRoleRecordScope } from "@/lib/auth/roles";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { useAuth } from "@/lib/auth/AuthProvider";
import { canSaveRole } from "@/lib/auth/user-management-rules";

interface RoleFormState {
  name: string;
  description: string;
  permissions: string[];
  recordScope: RoleRecordScope;
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
  const { user: me, role: myRole } = useAuth();
  const isEditing = !!initialData;
  const buildForm = (): RoleFormState =>
    initialData
      ? {
          name: initialData.name,
          description: initialData.description,
          permissions: initialData.permissions,
          recordScope: getRoleRecordScope(initialData),
        }
      : cloneFrom
        ? {
            name: `${cloneFrom.name} (Kopya)`,
            description: cloneFrom.description,
            permissions: [...cloneFrom.permissions],
            // A copy of Öğretmen/Veli stays per-person — otherwise its users
            // could never be linked to a teacher/guardian record.
            recordScope: getRoleRecordScope(cloneFrom),
          }
        : { name: "", description: "", permissions: [], recordScope: "institution" };
  const [form, setForm] = useState<RoleFormState>(buildForm);
  const [error, setError] = useState<string | null>(null);

  // Reset when the drawer opens (or targets another role). Done during
  // render rather than in an effect so stale values never paint.
  const resetKey = open ? `${initialData?.id ?? ""}|${cloneFrom?.id ?? ""}` : null;
  const [prevResetKey, setPrevResetKey] = useState<string | null>(resetKey);
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    if (open) {
      setForm(buildForm());
      setError(null);
    }
  }

  const resetAndClose = () => {
    setForm({ name: "", description: "", permissions: [], recordScope: "institution" });
    setError(null);
    onOpenChange(false);
  };

  const saveError = canSaveRole({ userId: me?.id ?? "", role: myRole }, initialData ?? null, form.permissions);

  const handleSave = () => {
    if (!form.name.trim() || saveError) return;
    const now = new Date().toISOString();

    if (isEditing) {
      store.updateRole({
        ...initialData,
        name: form.name.trim(),
        description: form.description.trim(),
        permissions: form.permissions,
        recordScope: form.recordScope,
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
        recordScope: form.recordScope,
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
      saveDisabled={!form.name.trim() || !!saveError}
    >
      <div className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="role-name">Rol Adı</Label>
          <Input id="role-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          {error && <p className="text-xs font-medium text-destructive">{error}</p>}
          {saveError && <p className="text-xs font-medium text-destructive">{saveError}</p>}
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
          <Label>Kayıt Kapsamı</Label>
          <Select
            value={form.recordScope}
            disabled={initialData?.isSystemRole}
            onValueChange={(v) => { if (v) setForm((f) => ({ ...f, recordScope: v as RoleRecordScope })); }}
          >
            <SelectTrigger className="w-full">
              <SelectValue>{() => RECORD_SCOPE_LABELS[form.recordScope]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(RECORD_SCOPE_LABELS) as RoleRecordScope[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {RECORD_SCOPE_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {initialData?.isSystemRole
              ? "Sistem rollerinin kapsamı değiştirilemez."
              : form.recordScope === "institution"
                ? "Bu roldeki kullanıcılar, izinlerin verdiği tüm kurum kayıtlarını görür."
                : "Bu roldeki her kullanıcı bir " + (form.recordScope === "teacher" ? "öğretmen" : "veli") +
                  " kaydına bağlanır ve yalnızca o kaydın verilerini görür; bağlanmamış kullanıcı hiçbir kayıt göremez."}
          </p>
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
  const { user: me, role: myRole } = useAuth();
  const actor = { userId: me?.id ?? "", role: myRole };
  const confirm = useConfirm();
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
              Sistem rolleri (4 adet) silinemez ama izinleri özelleştirilebilir. Kendi rolünüzü düzenleyemez, sahip olmadığınız bir yetkiyi bir role veremezsiniz. Özel roller oluşturup
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
          const editError = canSaveRole(actor, role, role.permissions);
          const cloneError = canSaveRole(actor, null, role.permissions);
          const canDeactivate = !role.isSystemRole && usage === 0 && role.isActive && !editError;
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEdit(role)}
                  disabled={!!editError}
                  title={editError ?? undefined}
                >
                  Düzenle
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openClone(role)}
                  disabled={!!cloneError}
                  title={cloneError ?? undefined}
                  className="gap-1"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Kopyala
                </Button>
                {!role.isSystemRole && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!canDeactivate}
                    title={
                      editError
                        ? editError
                        : !role.isActive
                        ? "Zaten pasif"
                        : usage > 0
                          ? "Bu role atanmış kullanıcılar olduğu için devre dışı bırakılamaz"
                          : undefined
                    }
                    onClick={async () => {
                      const ok = await confirm({
                        kind: "sensitive",
                        title: `"${role.name}" rolü devre dışı bırakılsın mı?`,
                        confirmLabel: "Devre Dışı Bırak",
                        destructive: true,
                      });
                      if (ok) store.deactivateRole(role.id);
                    }}
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
