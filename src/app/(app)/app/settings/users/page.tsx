"use client";

import { SettingsAccessGuard } from "@/components/settings/SettingsAccessGuard";
import { Tabs, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs";
import { KullanicilarTab } from "@/components/settings/users/KullanicilarTab";
import { RollerTab } from "@/components/settings/users/RollerTab";
import { YetkiMatrisiTab } from "@/components/settings/users/YetkiMatrisiTab";
import { DavetlerTab } from "@/components/settings/users/DavetlerTab";

function UsersSettingsContent() {
  return (
    <Tabs defaultValue="users">
      <TabsList>
        <TabsTab value="users">Kullanıcılar</TabsTab>
        <TabsTab value="roles">Roller</TabsTab>
        <TabsTab value="matrix">Yetki Matrisi</TabsTab>
        <TabsTab value="invites">Davetler</TabsTab>
      </TabsList>
      <TabsPanel value="users">
        <KullanicilarTab />
      </TabsPanel>
      <TabsPanel value="roles">
        <RollerTab />
      </TabsPanel>
      <TabsPanel value="matrix">
        <YetkiMatrisiTab />
      </TabsPanel>
      <TabsPanel value="invites">
        <DavetlerTab />
      </TabsPanel>
    </Tabs>
  );
}

export default function UsersSettingsPage() {
  return (
    <SettingsAccessGuard sectionKey="users">
      <UsersSettingsContent />
    </SettingsAccessGuard>
  );
}
