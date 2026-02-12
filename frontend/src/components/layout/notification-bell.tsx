"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, CheckCircle2, AlertTriangle, MessageSquare, Bot, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useNotifications,
  useUnreadCount,
  markRead,
  deleteNotification,
} from "@/hooks/use-notifications";
import type { Notification } from "@/types";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "gerade eben";
  if (mins < 60) return `vor ${mins} Min.`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  return `vor ${days} Tag${days > 1 ? "en" : ""}`;
}

const TYPE_ICONS: Record<string, typeof Bell> = {
  approval_needed: AlertTriangle,
  agent_completed: Bot,
  comment_added: MessageSquare,
  task_completed: CheckCircle2,
};

const TYPE_COLORS: Record<string, string> = {
  approval_needed: "text-orange-400",
  agent_completed: "text-cyan-400",
  comment_added: "text-blue-400",
  task_completed: "text-green-400",
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const { notifications, mutate: mutateList } = useNotifications();
  const { count, mutate: mutateCount } = useUnreadCount();

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function handleClickNotification(n: Notification) {
    if (!n.is_read) {
      await markRead([n.id]);
      mutateList();
      mutateCount();
    }
    if (n.link) {
      window.location.href = n.link;
    }
    setOpen(false);
  }

  async function handleMarkAllRead() {
    const unread = notifications.filter((n) => !n.is_read);
    if (unread.length === 0) return;
    await markRead(unread.map((n) => n.id));
    mutateList();
    mutateCount();
  }

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    await deleteNotification(id);
    mutateList();
    mutateCount();
  }

  return (
    <div className="relative" ref={panelRef}>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setOpen(!open)}
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[hsl(var(--accent-orange))] px-1 text-[10px] font-bold text-white">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-border bg-card shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold">Benachrichtigungen</h3>
            {count > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Alle gelesen
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8">
                <Bell className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  Keine Benachrichtigungen
                </p>
              </div>
            ) : (
              notifications.map((n) => {
                const Icon = TYPE_ICONS[n.type] ?? Bell;
                const color = TYPE_COLORS[n.type] ?? "text-muted-foreground";

                return (
                  <button
                    key={n.id}
                    onClick={() => handleClickNotification(n)}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 ${
                      !n.is_read ? "bg-muted/20" : ""
                    }`}
                  >
                    <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${color}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm ${!n.is_read ? "font-medium" : "text-muted-foreground"}`}>
                          {n.title}
                        </p>
                        <button
                          onClick={(e) => handleDelete(e, n.id)}
                          className="shrink-0 text-muted-foreground/50 hover:text-foreground"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                      {n.message && (
                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                          {n.message}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground/60">
                        {timeAgo(n.created_at)}
                      </p>
                    </div>
                    {!n.is_read && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[hsl(var(--accent-orange))]" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
