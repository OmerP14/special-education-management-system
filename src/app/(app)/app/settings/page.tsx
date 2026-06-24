"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Settings } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Ayarlar"
        description="Kurum ve hesap ayarları"
      />
      <EmptyState
        title="Ayarlar yakında geliyor"
        description="Bu modül gelecek sürümde aktif hale gelecektir."
        icon={Settings}
      />
    </div>
  );
}
