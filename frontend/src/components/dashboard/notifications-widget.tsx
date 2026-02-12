"use client";

import {
  Bot,
  ShieldAlert,
  ClipboardList,
  AtSign,
  Info,
  CheckCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { useNotifications, markRead } from "@/hooks/use-notifications";

const TYPE_ICONS: Record<string, LucideIcon> = {
  agent_completed: Bot,
  approval_needed: ShieldAlert,
  task_assigned: ClipboardList,
  mention: AtSign,
  system: Info,
};

const PRIORITY_DOTS: Record<string, string> = {
  high: "bg-red-500",
  normal: "bg-blue-500",
  low: "bg-gray-400",
};

export function NotificationsWidget() {
  const { notifications, mutate } = useNotifications();

  const handleMarkRead = async (id: string) => {
    await markRead([id]);
    mutate();
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="flex h-full flex-col">
      {unreadCount > 0 && (
        <div className="mb-2 flex items-center gap-2">
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[hsl(var(--accent-orange))] px-1.5 text-[10px] font-bold text-white">
            {unreadCount}
          </span>
          <span className="text-xs text-muted-foreground">ungelesen</span>
        </div>
      )}
      <div className="flex-1 space-y-1.5 overflow-y-auto">
        {notifications.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            Keine Benachrichtigungen
          </p>
        ) : (
          notifications.slice(0, 15).map((notification) => {
            const Icon = TYPE_ICONS[notification.type] || Info;
            const dotColor = PRIORITY_DOTS[notification.priority] || "bg-gray-400";

            return (
              <div
                key={notification.id}
                className={`group flex items-start gap-2.5 rounded-md px-2.5 py-2 transition-colors ${
                  notification.is_read
                    ? "opacity-60"
                    : "bg-secondary/30"
                }`}
              >
                <div className="relative mt-0.5 shrink-0">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  {!notification.is_read && (
                    <span
                      className={`absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ${dotColor}`}
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium leading-tight">
                    {notification.title}
                  </p>
                  {notification.message && (
                    <p className="mt-0.5 text-[10px] text-muted-foreground line-clamp-1">
                      {notification.message}
                    </p>
                  )}
                  <p className="mt-0.5 text-[10px] text-muted-foreground/60">
                    {formatDistanceToNow(new Date(notification.created_at), {
                      locale: de,
                      addSuffix: true,
                    })}
                  </p>
                </div>
                {!notification.is_read && (
                  <button
                    onClick={() => handleMarkRead(notification.id)}
                    className="invisible shrink-0 text-muted-foreground transition-colors hover:text-green-500 group-hover:visible"
                    title="Als gelesen markieren"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
