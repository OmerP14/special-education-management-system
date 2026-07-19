"use client";

import { memo, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_TOP_ITEMS, NAV_GROUPS, NAV_SETTINGS_ITEM, isNavItemActive, type NavGroup } from "@/lib/nav";
import { useCollapsedNavGroups } from "@/hooks/use-collapsed-nav-groups";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
} from "@/components/ui/sidebar";

// ─── One collapsible group ──────────────────────────────────────────────────
// A standalone, memoized component so that toggling one group's open/closed
// state only re-renders THAT group — sibling groups receive the same stable
// `onToggle` reference (from useCollapsedNavGroups) and their own unchanged
// `collapsed`/`pathname` props, so React.memo's shallow comparison bails out
// for them entirely.
interface NavGroupSectionProps {
  group: NavGroup;
  collapsed: boolean;
  pathname: string;
  onToggle: (groupId: string) => void;
}

const NavGroupSection = memo(function NavGroupSection({
  group,
  collapsed,
  pathname,
  onToggle,
}: NavGroupSectionProps) {
  const showItems = !collapsed;

  return (
    <SidebarGroup>
      <SidebarGroupLabel
        render={<button type="button" aria-expanded={showItems} />}
        onClick={() => onToggle(group.id)}
        className="justify-between gap-2 pr-1.5 hover:bg-foreground/[0.06]"
      >
        <span className="flex items-center gap-2">
          <group.icon className="h-3.5 w-3.5 shrink-0" />
          {group.label}
        </span>
        <ChevronRight className={cn("h-3.5 w-3.5 shrink-0", !collapsed && "rotate-90")} />
      </SidebarGroupLabel>

      {/* Grid-rows trick animates height without measuring the DOM and
          without a new animation dependency — kept short/snappy (150ms,
          ease-out) to match the rest of the sidebar's interactions. */}
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-150 ease-[cubic-bezier(0.2,0,0,1)]",
          showItems ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => {
                const active = isNavItemActive(pathname, item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton isActive={active} render={<Link href={item.href} />}>
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </div>
      </div>
    </SidebarGroup>
  );
});

// Takes no props, so the only reason it would ever re-render from a PARENT
// update is AppLayout re-rendering for an unrelated reason (e.g. the sidebar
// visibility toggle itself, which the Sidebar primitive already reacts to via
// its own context subscription, not through any prop here). memo() makes that
// re-render a no-op; it still re-renders normally for its own reasons
// (route change via usePathname, group toggle via useCollapsedNavGroups).
export const AppSidebar = memo(function AppSidebar() {
  const pathname = usePathname();
  const { isCollapsed, toggle, ensureOpen, hydrated } = useCollapsedNavGroups();

  const activeGroupId =
    NAV_GROUPS.find((group) => group.items.some((item) => isNavItemActive(pathname, item.href)))
      ?.id ?? null;

  // Auto-open the group containing the active route — but only the moment it
  // BECOMES active (first load, or navigating in from a different group).
  // Re-collapsing the group you're currently on stays respected: this effect
  // only re-fires when `activeGroupId` itself changes, never on every render
  // while you stay within the same group's pages.
  const lastAutoOpenedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!hydrated || !activeGroupId) return;
    if (lastAutoOpenedRef.current === activeGroupId) return;
    lastAutoOpenedRef.current = activeGroupId;
    ensureOpen(activeGroupId);
  }, [hydrated, activeGroupId, ensureOpen]);

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="px-1">
        <div className="flex h-12 items-center gap-2.5 px-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
            <GraduationCap className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="truncate text-sm font-semibold leading-none text-sidebar-foreground">
              ÖzelEğitim
            </span>
            <span className="truncate text-[10px] leading-tight text-sidebar-foreground/70">
              Yönetim Sistemi
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Ungrouped top-level items */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_TOP_ITEMS.map((item) => {
                const active = isNavItemActive(pathname, item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton isActive={active} render={<Link href={item.href} />}>
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        {/* Grouped, collapsible sections — each its own memoized component */}
        {NAV_GROUPS.map((group, i) => (
          <div key={group.id}>
            {i > 0 && <SidebarSeparator />}
            <NavGroupSection
              group={group}
              collapsed={isCollapsed(group.id)}
              pathname={pathname}
              onToggle={toggle}
            />
          </div>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarSeparator className="mb-1" />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={isNavItemActive(pathname, NAV_SETTINGS_ITEM.href)}
              render={<Link href={NAV_SETTINGS_ITEM.href} />}
            >
              <NAV_SETTINGS_ITEM.icon />
              <span>{NAV_SETTINGS_ITEM.label}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <p className="truncate px-2 pb-1 text-[10px] text-sidebar-foreground/60">
          Demo Kurum · v1.0.0
        </p>
      </SidebarFooter>
    </Sidebar>
  );
});
