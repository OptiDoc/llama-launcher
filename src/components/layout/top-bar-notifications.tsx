/**
 * Top bar notifications dropdown.
 */

import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { NOTIF_ICON, NOTIF_COLOR } from "./top-bar-types";
import type { AppNotification as Notification } from "@/lib/llama-store";

interface TopBarNotificationsProps {
  notifications: Notification[];
  unreadCount: number;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  clearNotifications: () => void;
}

export function TopBarNotifications({
  notifications,
  unreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  clearNotifications,
}: TopBarNotificationsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="relative grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        >
          <Bell className="size-3.5" />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 grid min-w-[14px] place-items-center rounded-full bg-primary px-1 text-[8px] font-bold text-primary-foreground leading-none">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-0">
        <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
          <span className="text-[11px] font-semibold">Notifications</span>
          <div className="flex items-center gap-0.5">
            <button
              onClick={markAllNotificationsRead}
              className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              title="Mark all read"
            >
              <CheckCheck className="size-3" />
            </button>
            <button
              onClick={clearNotifications}
              className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-destructive"
              title="Clear all"
            >
              <Trash2 className="size-3" />
            </button>
          </div>
        </div>
        <div className="max-h-[320px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1.5 py-8 text-center">
              <Bell className="size-5 text-muted-foreground/25" />
              <p className="text-[11px] text-muted-foreground">No notifications</p>
            </div>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => markNotificationRead(n.id)}
                className={cn(
                  "flex w-full items-start gap-2.5 border-b border-border/40 px-3 py-2.5 text-left transition-colors hover:bg-accent/40",
                  !n.read && "bg-primary/5",
                )}
              >
                <span className={cn("mt-0.5 shrink-0", NOTIF_COLOR[n.kind])}>{NOTIF_ICON[n.kind]}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[11px] font-semibold">{n.title}</span>
                    {!n.read && <span className="size-1 shrink-0 rounded-full bg-primary" />}
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">{n.body}</p>
                  <span className="mt-0.5 block text-[9px] text-muted-foreground/40">
                    {new Date(n.ts ?? 0).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
