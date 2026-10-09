"use client";

import { useMemo, useState } from "react";
import { UserPlus, ShieldCheck, Ban, RotateCcw, Send, Search, AlertTriangle, Copy, Check, X } from "lucide-react";
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
import type { Teacher } from "@/types";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { buildInviteLink } from "@/lib/auth/tokens";
import { getRoleRecordScope } from "@/lib/auth/roles";
import { getLinkedRecord } from "@/lib/auth/linked-account";
import { canAssignRole, canDeactivateUser, canEditUser } from "@/lib/auth/user-management-rules";

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

// Select sentinels — the Select primitive ignores an empty-string value.
const NO_LINK = "__none__";
const NEW_TEACHER = "__new__";

function UserFormDrawer({
  open,
  onOpenChange,
  initialData,
  existingEmails,
  roles,
  onInvited,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: AppUser;
  existingEmails: string[];
  roles: Role[];
  onInvited: (invite: { name: string; token: string }) => void;
}) {
  const store = useMockStore();
  const { user: me, role: myRole } = useAuth();
  const actor = { userId: me?.id ?? "", role: myRole };
  const isEditing = !!initialData;
  const roleRuleFor = (role: Role | undefined) =>
    canAssignRole(actor, initialData ?? null, role, store.appUsers, roles);
  // Only roles this account may hand out (plus the user's current one).
  const assignableRoles = roles.filter((r) => r.isActive && (r.id === initialData?.roleId || !roleRuleFor(r)));
  const defaultRoleId = roles.find((r) => r.key === "teacher")?.id ?? roles[0]?.id ?? "";
  const buildForm = (): UserFormState =>
    initialData
      ? {
          name: initialData.name,
          email: initialData.email,
          roleId: initialData.roleId,
          teacherId: initialData.teacherId ?? "",
          guardianId: initialData.guardianId ?? "",
        }
      : emptyForm(defaultRoleId);
  const [form, setForm] = useState<UserFormState>(buildForm);
  const [error, setError] = useState<string | null>(null);

  // Reset when the drawer opens (or targets another user). Done during
  // render rather than in an effect so stale values never paint.
  const resetKey = open ? initialData?.id ?? "" : null;
  const [prevResetKey, setPrevResetKey] = useState<string | null>(resetKey);
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    if (open) {
      setForm(buildForm());
      setError(null);
    }
  }

  const selectedRole = roles.find((r) => r.id === form.roleId);
  const selectedScope = getRoleRecordScope(selectedRole);
  const roleError = roleRuleFor(selectedRole);
  // A linked teacher/guardian record owns the name and e-mail (see
  // lib/auth/linked-account.ts): shown read-only, edited on the record.
  const linked = getLinkedRecord(
    {
      roleId: form.roleId,
      teacherId: form.teacherId && form.teacherId !== NEW_TEACHER ? form.teacherId : undefined,
      guardianId: form.guardianId || undefined,
    },
    roles,
    store.teachers,
    store.guardians
  );
  const effectiveName = (linked ? linked.fullName : form.name).trim();
  const effectiveEmail = (linked?.email ?? form.email).trim();
  const activeTeachers = store.teachers.filter((t) => t.status === "active");
  const guardians = store.guardians;

  const set = <K extends keyof UserFormState>(key: K, value: UserFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
  };

  // Records already given to another account — shown as "hesabı var" so the
  // same teacher/guardian doesn't end up with two logins by accident.
  const linkedElsewhere = (field: "teacherId" | "guardianId", id: string) =>
    store.appUsers.some((u) => u.id !== initialData?.id && u[field] === id && u.status !== "inactive");

  /** Links a teacher/guardian record and copies its name and e-mail into the
   *  form — only into fields that are empty or still hold what an earlier
   *  pick filled in, never over something typed by hand. */
  const linkRecord = (field: "teacherId" | "guardianId", id: string) => {
    const record =
      field === "teacherId" ? activeTeachers.find((t) => t.id === id) : guardians.find((g) => g.id === id);
    setForm((prev) => {
      const next = { ...prev, [field]: id };
      if (!record) return next;
      const prevRecord =
        field === "teacherId"
          ? activeTeachers.find((t) => t.id === prev.teacherId)
          : guardians.find((g) => g.id === prev.guardianId);
      const replaceable = (current: string, previousAuto: string | undefined) =>
        !current.trim() || current === (previousAuto ?? "");
      if (replaceable(prev.name, prevRecord?.fullName)) next.name = record.fullName;
      if (record.email && replaceable(prev.email, prevRecord?.email)) next.email = record.email;
      return next;
    });
    setError(null);
  };

  const resetAndClose = () => {
    setForm(emptyForm(defaultRoleId));
    setError(null);
    onOpenChange(false);
  };

  const handleSave = () => {
    if (!effectiveName || !effectiveEmail || roleError) return;
    const normalizedEmail = effectiveEmail.toLowerCase();
    const isDuplicate = existingEmails
      .filter((e) => e !== initialData?.email.toLowerCase())
      .includes(normalizedEmail);
    if (isDuplicate) {
      setError("Bu e-posta adresiyle zaten bir kullanıcı veya davet var.");
      return;
    }

    // Linked record without an e-mail: the one typed here is written to the
    // record too, so the person still has a single address.
    if (linked && !linked.email) {
      if (linked.kind === "guardian") {
        const g = store.guardians.find((x) => x.id === linked.id);
        if (g) store.updateGuardian({ ...g, email: effectiveEmail });
      } else {
        const t = store.teachers.find((x) => x.id === linked.id);
        if (t) store.updateTeacher({ ...t, email: effectiveEmail });
      }
    }

    let teacherId = selectedScope === "teacher" && form.teacherId ? form.teacherId : undefined;
    if (teacherId === NEW_TEACHER) {
      // No teacher record yet — open a minimal one from the invite itself;
      // phone, pay and education types are completed on the Öğretmenler page.
      const policy = store.institutionSettings.teacherEarnings;
      const isSalary = policy.defaultEarningType === "monthly_salary" || policy.defaultEarningType === "salary_plus_quota";
      const teacher: Teacher = {
        id: `teacher-${Date.now()}`,
        tenantId: initialData?.tenantId ?? "tenant-1",
        fullName: form.name.trim(),
        phone: "",
        email: form.email.trim(),
        status: "active",
        earningType: policy.defaultEarningType,
        monthlySalary: isSalary ? 0 : undefined,
        includedSessionQuota: policy.defaultEarningType === "salary_plus_quota" ? policy.defaultQuota : undefined,
        extraSessionEarning: policy.defaultEarningType === "salary_plus_quota" ? 0 : undefined,
        earningPercentage: policy.defaultEarningType === "percentage" ? 0 : undefined,
        notes: "Kullanıcı davetiyle oluşturuldu — telefon, ücret ve eğitim türü bilgilerini tamamlayın.",
        createdAt: new Date().toISOString(),
      };
      store.addTeacher(teacher);
      teacherId = teacher.id;
    }
    const guardianId = selectedScope === "guardian" && form.guardianId ? form.guardianId : undefined;

    if (isEditing) {
      store.updateAppUser({
        ...initialData,
        name: effectiveName,
        email: effectiveEmail,
        roleId: form.roleId,
        teacherId,
        guardianId,
      });
    } else {
      const token = store.inviteAppUser({
        id: `user-${Date.now()}`,
        tenantId: "tenant-1",
        name: effectiveName,
        email: effectiveEmail,
        roleId: form.roleId,
        teacherId,
        guardianId,
        status: "invited",
        invitedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
      if (token) onInvited({ name: effectiveName, token });
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
      saveDisabled={!effectiveName || !effectiveEmail || !!roleError}
    >
      <div className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="user-name">Ad Soyad</Label>
          <Input
            id="user-name"
            value={linked ? linked.fullName : form.name}
            readOnly={!!linked}
            className={linked ? "bg-muted/40" : undefined}
            onChange={(e) => set("name", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="user-email">E-posta</Label>
          <Input
            id="user-email"
            type="email"
            value={linked?.email ?? form.email}
            readOnly={!!linked?.email}
            className={linked?.email ? "bg-muted/40" : undefined}
            onChange={(e) => set("email", e.target.value)}
            aria-invalid={!!error}
          />
          {error && <p className="text-xs font-medium text-destructive">{error}</p>}
          {linked && (
            <p className="text-xs text-muted-foreground">
              {linked.email
                ? `Ad ve e-posta ${linked.kind === "guardian" ? "veli" : "öğretmen"} kaydından gelir; kullanıcı bu e-postayla giriş yapar. Değiştirmek için ${linked.kind === "guardian" ? "Veliler" : "Öğretmenler"} sayfasından kaydı düzenleyin.`
                : `Ad ${linked.kind === "guardian" ? "veli" : "öğretmen"} kaydından gelir. Kayıtta e-posta yok — yazdığınız e-posta kayda da eklenir ve giriş için kullanılır.`}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label>Rol</Label>
          <Select value={form.roleId} onValueChange={(v) => { if (v) set("roleId", v); }}>
            <SelectTrigger className="w-full">
              <SelectValue>{() => roles.find((r) => r.id === form.roleId)?.name ?? ""}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {assignableRoles.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {roleError ? (
            <p className="text-xs font-medium text-destructive">{roleError}</p>
          ) : initialData && initialData.id === me?.id ? (
            <p className="text-xs text-muted-foreground">Kendi rolünüzü değiştiremezsiniz.</p>
          ) : null}
        </div>

        {selectedScope === "teacher" && (
          <div className="space-y-1.5">
            <Label>Bağlı Öğretmen Kaydı</Label>
            <Select
              value={form.teacherId || NO_LINK}
              onValueChange={(v) => {
                if (!v) return;
                if (v === NO_LINK || v === NEW_TEACHER) set("teacherId", v === NO_LINK ? "" : v);
                else linkRecord("teacherId", v);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {() =>
                    form.teacherId === NEW_TEACHER
                      ? "Yeni öğretmen kaydı oluşturulacak"
                      : activeTeachers.find((t) => t.id === form.teacherId)?.fullName ?? "Seçilmedi"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_LINK}>Seçilmedi</SelectItem>
                <SelectItem value={NEW_TEACHER}>+ Yeni öğretmen kaydı oluştur</SelectItem>
                {activeTeachers.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.fullName}
                    {linkedElsewhere("teacherId", t.id) ? " · hesabı var" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.teacherId === NEW_TEACHER ? (
              <p className="text-xs text-muted-foreground">
                &quot;{form.name.trim() || "Ad Soyad"}&quot; adıyla bir öğretmen kaydı açılır. Telefon, ücret ve eğitim
                türlerini daha sonra Öğretmenler sayfasından tamamlayın.
              </p>
            ) : !form.teacherId ? (
              <UnlinkedWarning text="Öğretmen kaydına bağlanmayan kullanıcı giriş yapabilir ama hiçbir öğrenci veya seans göremez." />
            ) : (
              <p className="text-xs text-muted-foreground">Bu kullanıcı yalnızca bu öğretmenin öğrenci ve seanslarını görür.</p>
            )}
          </div>
        )}

        {selectedScope === "guardian" && (
          <div className="space-y-1.5">
            <Label>Bağlı Veli Kaydı</Label>
            <Select
              value={form.guardianId || NO_LINK}
              onValueChange={(v) => {
                if (!v) return;
                if (v === NO_LINK) set("guardianId", "");
                else linkRecord("guardianId", v);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue>{() => guardians.find((g) => g.id === form.guardianId)?.fullName ?? "Seçilmedi"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_LINK}>Seçilmedi</SelectItem>
                {guardians.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.fullName}
                    {linkedElsewhere("guardianId", g.id) ? " · hesabı var" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!form.guardianId ? (
              <UnlinkedWarning text="Veli kaydına bağlanmayan kullanıcı giriş yapabilir ama hiçbir öğrenci bilgisi göremez. Veli kaydı yoksa önce Veliler sayfasından ekleyin." />
            ) : (
              <p className="text-xs text-muted-foreground">Bu kullanıcı yalnızca bu velinin çocuklarının bilgilerini görür.</p>
            )}
          </div>
        )}
      </div>
    </FormDrawer>
  );
}

function UnlinkedWarning({ text }: { text: string }) {
  return (
    <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
      <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
      {text}
    </p>
  );
}

/** Shown right after an invite — there is no email delivery yet, so the
 *  admin needs the link in hand rather than having to find the Davetler tab. */
function InviteLinkBanner({ invite, onClose }: { invite: { name: string; token: string }; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const link = buildInviteLink(invite.token);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — the link is selectable in the box below.
    }
  };
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-foreground">{invite.name} davet edildi</p>
          <p className="text-xs text-muted-foreground">
            E-posta gönderimi henüz bağlı değil. Aşağıdaki bağlantıyı kopyalayıp kişiye kendiniz iletin (WhatsApp,
            e-posta vb.). Bağlantı 7 gün geçerlidir; Davetler sekmesinden tekrar ulaşabilirsiniz.
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Kapat" className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="h-9 min-w-0 flex-1 font-mono text-xs" />
        <Button size="sm" variant="outline" onClick={copy} className="gap-1.5">
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Kopyalandı" : "Bağlantıyı Kopyala"}
        </Button>
      </div>
    </div>
  );
}

// ─── Main tab ───────────────────────────────────────────────────────────────

export function KullanicilarTab() {
  const store = useMockStore();
  const confirm = useConfirm();
  const { user: currentUser, role: currentRole } = useAuth();
  const actor = { userId: currentUser?.id ?? "", role: currentRole };
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [lastInvite, setLastInvite] = useState<{ name: string; token: string } | null>(null);
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

      {lastInvite && <InviteLinkBanner invite={lastInvite} onClose={() => setLastInvite(null)} />}

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
                const editError = canEditUser(actor, u, store.roles);
                const deactivateError = canDeactivateUser(actor, u, store.appUsers, store.roles);
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(u)}
                          disabled={!!editError}
                          title={editError ?? undefined}
                        >
                          Düzenle
                        </Button>
                        {u.status === "invited" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => store.resendInvitation(u.id)}
                            disabled={!!editError}
                            title={editError ?? undefined}
                            className="gap-1"
                          >
                            <Send className="h-3.5 w-3.5" />
                            Daveti Yeniden Gönder
                          </Button>
                        )}
                        {u.status === "inactive" || u.status === "locked" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => store.activateAppUser(u.id)}
                            disabled={!!editError}
                            title={editError ?? undefined}
                            className="gap-1 text-emerald-600 hover:text-emerald-700"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            {u.status === "locked" ? "Kilidi Aç" : "Etkinleştir"}
                          </Button>
                        ) : u.status === "active" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              const ok = await confirm({
                                kind: "sensitive",
                                title: `${u.name} devre dışı bırakılsın mı?`,
                                description: "Kullanıcı artık giriş yapamaz.",
                                confirmLabel: "Devre Dışı Bırak",
                                destructive: true,
                              });
                              if (ok) store.deactivateAppUser(u.id);
                            }}
                            disabled={!!deactivateError}
                            title={deactivateError ?? undefined}
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
        onInvited={setLastInvite}
      />
    </div>
  );
}
