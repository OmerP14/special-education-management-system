"use client";

import { usePathname } from "next/navigation";
import { Bell, Check, ChevronDown, PanelLeft } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSidebar } from "@/components/ui/sidebar";
import { useMockStore } from "@/lib/mock/store";
import { formatTime, formatDate } from "@/lib/helpers/finance";
import { resolveNavBreadcrumb } from "@/lib/nav";
import { cn } from "@/lib/utils";

const MOCK_USER = {
  name: "Yönetici",
  email: "admin@ornekokul.com",
  initials: "YN",
};

interface AppTopbarProps {
  sidebarVisible: boolean;
  onToggleSidebar: () => void;
}

export function AppTopbar({ sidebarVisible, onToggleSidebar }: AppTopbarProps) {
  const store = useMockStore();
  const { notifications, markAllNotificationsRead, students, teachers } = store;
  const pathname = usePathname();
  const breadcrumb = resolveNavBreadcrumb(pathname);
  // On mobile the sidebar is always a Sheet overlay with its own open/closed
  // state (openMobile) — our desktop visible/hidden state doesn't apply there,
  // so this same header button drives a DIFFERENT action on mobile: open/close
  // the drawer, via the primitive's own mobile-aware toggle.
  const { isMobile, toggleSidebar, openMobile } = useSidebar();

  const unreadCount = notifications.filter((n) => !n.readAt).length;
  const hasUnread = unreadCount > 0;

  const sorted = [...notifications].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // One consistent icon, regardless of state — only the accessible label
  // changes. Matches the reference apps (Notion, Linear, ChatGPT): a single,
  // unassuming toggle, not a different icon per state.
  const sidebarLabel = isMobile
    ? openMobile
      ? "Menüyü Kapat"
      : "Menüyü Aç"
    : sidebarVisible
      ? "Menüyü Gizle"
      : "Menüyü Göster";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-background px-3 lg:px-5">
      {/* Left – sidebar toggle + breadcrumb. This button is the ONLY way to
          restore a hidden sidebar — it lives here, outside the Sidebar
          itself, so it stays reachable while hidden. */}
      <div className="flex min-w-0 items-center gap-2">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={sidebarLabel}
                onClick={isMobile ? toggleSidebar : onToggleSidebar}
                className="text-muted-foreground hover:text-foreground"
              />
            }
          >
            <PanelLeft className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent side="bottom">{sidebarLabel}</TooltipContent>
        </Tooltip>
        {breadcrumb && (
          <>
            <Separator orientation="vertical" className="h-4" />
            <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
              {breadcrumb.groupLabel && (
                <>
                  <span className="truncate text-muted-foreground">{breadcrumb.groupLabel}</span>
                  <span className="text-muted-foreground/40">/</span>
                </>
              )}
              <span className="truncate font-medium text-foreground">{breadcrumb.pageLabel}</span>
            </nav>
          </>
        )}
      </div>

      {/* Right – actions */}
      <div className="flex items-center gap-2">

        {/* ── Notification bell ──────────────────────────────────────────────── */}
        <DropdownMenu onOpenChange={(open) => { if (open && hasUnread) markAllNotificationsRead(); }}>
          <DropdownMenuTrigger
            className="relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Bell className="h-4 w-4" />
            {hasUnread && (
              <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white leading-none">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
            {!hasUnread && notifications.length > 0 && (
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
            )}
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-80">
            {/* Header – must be inside DropdownMenuGroup so DropdownMenuLabel works */}
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex items-center justify-between font-semibold text-foreground text-sm">
                Bildirimler
                {hasUnread && (
                  <span className="text-[11px] font-normal text-muted-foreground">
                    {unreadCount} okunmadı
                  </span>
                )}
              </DropdownMenuLabel>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            {/* "Mark all read" action */}
            {hasUnread && (
              <DropdownMenuItem
                className="text-xs text-primary cursor-pointer gap-1.5"
                onClick={() => markAllNotificationsRead()}
              >
                <Check className="h-3 w-3" />
                Tümünü okundu işaretle
              </DropdownMenuItem>
            )}
            {hasUnread && <DropdownMenuSeparator />}

            {/* Empty state */}
            {notifications.length === 0 && (
              <DropdownMenuGroup>
                <DropdownMenuLabel className="py-6 text-center text-sm font-normal text-muted-foreground">
                  Bildirim bulunmuyor
                </DropdownMenuLabel>
              </DropdownMenuGroup>
            )}

            {/* Notification items – direct children of content, no extra <div> wrapper */}
            {sorted.map((n) => {
              const studentName =
                students.find((s) => s.id === n.studentId)?.fullName ?? "Bilinmeyen öğrenci";
              const teacherName =
                teachers.find((t) => t.id === n.teacherId)?.fullName ?? "Bilinmeyen öğretmen";
              const isRead = !!n.readAt;

              return (
                <DropdownMenuItem
                  key={n.id}
                  className={cn(
                    "flex items-start gap-2 px-3 py-2.5 cursor-default",
                    !isRead && "bg-primary/5 focus:bg-primary/8"
                  )}
                >
                  <div
                    className={cn(
                      "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                      isRead ? "bg-muted" : "bg-emerald-100"
                    )}
                  >
                    <Check
                      className={cn(
                        "h-3 w-3",
                        isRead ? "text-muted-foreground" : "text-emerald-600"
                      )}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        "text-xs leading-snug",
                        isRead ? "text-muted-foreground" : "text-foreground font-medium"
                      )}
                    >
                      Seans otomatik tamamlandı
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {studentName} · {teacherName}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatDate(n.sessionDate)} {formatTime(n.sessionDate)}
                    </p>
                  </div>
                  {!isRead && (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  )}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* ── User menu ──────────────────────────────────────────────────────── */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                {MOCK_USER.initials}
              </AvatarFallback>
            </Avatar>
            <span className="hidden text-sm font-medium sm:block">{MOCK_USER.name}</span>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {/* User header – wrapped in Group so GroupLabel context is satisfied */}
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{MOCK_USER.name}</span>
                  <span className="text-xs text-muted-foreground">{MOCK_USER.email}</span>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Profil</DropdownMenuItem>
            <DropdownMenuItem>Ayarlar</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive">Çıkış Yap</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

      </div>
    </header>
  );
}
