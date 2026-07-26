import type { useMockStore } from "@/lib/mock/store";
import type { SettingsSectionKey, SettingsSectionStatus } from "@/types/settings";

type Store = ReturnType<typeof useMockStore>;

/**
 * Drives both the nav's status dot and the overview page's completeness
 * cards. Most sections start fully configured (every field has a sensible
 * default from day one), so "incomplete"/"attention" are reserved for the
 * handful of sections where an empty/default value is a real gap an owner
 * should fill in — everything else defaults to "complete".
 */
export function getSettingsSectionStatus(key: SettingsSectionKey, store: Store): SettingsSectionStatus {
  switch (key) {
    case "institution": {
      const inst = store.institutionSettings.institution;
      if (!inst.name.trim()) return "incomplete";
      if (!inst.phone.trim() || !inst.email.trim() || !inst.address.trim()) return "attention";
      return "complete";
    }
    case "educationTypes": {
      const activeCount = store.educationTypes.filter((et) => et.status === "active").length;
      return activeCount === 0 ? "attention" : "complete";
    }
    case "users": {
      const hasActiveOwner = store.appUsers.some(
        (u) => store.roles.find((r) => r.id === u.roleId)?.isOwnerRole && u.status === "active"
      );
      return hasActiveOwner ? "complete" : "attention";
    }
    case "data": {
      return store.institutionSettings.dataManagement.lastBackupAt ? "complete" : "attention";
    }
    default:
      return "complete";
  }
}

export const SETTINGS_STATUS_LABELS: Record<SettingsSectionStatus, string> = {
  complete: "Tamamlandı",
  incomplete: "Eksik",
  attention: "Dikkat gerekli",
};

export const SETTINGS_STATUS_DOT_CLASSES: Record<SettingsSectionStatus, string> = {
  complete: "bg-emerald-500",
  incomplete: "bg-destructive",
  attention: "bg-amber-500",
};
