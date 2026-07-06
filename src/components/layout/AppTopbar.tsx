"use client";

import { Bell, Check, ChevronDown, Menu } from "lucide-react";
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
import { useMockStore } from "@/lib/mock/store";
import { formatTime, formatDate } from "@/lib/helpers/finance";
import { cn } from "@/lib/utils";

interface AppTopbarProps {
  onMenuToggle?: () => void;
}

const MOCK_USER = {
  name: "Yönetici",
  email: "admin@ornekokul.com",
  initials: "YN",
};

export function AppTopbar({ onMenuToggle }: AppTopbarProps) {
  const store = useMockStore();
  const { notifications, markAllNotificationsRead, students, teachers } = store;

  const unreadCount = notifications.filter((n) => !n.readAt).length;
  const hasUnread = unreadCount > 0;

  const sorted = [...notifications].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-background px-4 lg:px-6">
      {/* Left – mobile menu toggle */}
      <button
        className="lg:hidden flex h-10 w-10 items-center justify-center rounded-md hover:bg-accent transition-colors"
        onClick={onMenuToggle}
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Spacer on desktop */}
      <div className="hidden lg:block" />

      {/* Right – actions */}
      <div className="flex items-center gap-2">

        {/* ── Notification bell ──────────────────────────────────────────────── */}
        <DropdownMenu onOpenChange={(open) => { if (open && hasUnread) markAllNotificationsRead(); }}>
          <DropdownMenuTrigger
            className="relative flex h-10 w-10 items-center justify-center rounded-md hover:bg-accent transition-colors focus-visible:outline-none"
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
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none"
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
