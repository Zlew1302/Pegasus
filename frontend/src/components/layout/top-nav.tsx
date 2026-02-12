"use client";

import { usePathname, useRouter } from "next/navigation";
import { Bot, Plus, Search, LayoutDashboard, Briefcase, FolderKanban, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "./notification-bell";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/workspace", label: "Workspace", icon: Briefcase },
  { href: "/projects", label: "Projekte", icon: FolderKanban },
  { href: "/profile", label: "Profil", icon: User },
] as const;

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
      {/* Left: Logo + Nav */}
      <div className="flex items-center gap-6">
        {/* Logo */}
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-2"
        >
          <Bot className="h-6 w-6 text-[hsl(var(--accent-orange))]" />
          <span className="text-lg font-bold">CrewBoard</span>
        </button>

        {/* Nav Pills */}
        <div className="flex items-center gap-1 rounded-lg bg-secondary/50 p-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive =
              pathname === href || pathname.startsWith(href + "/");
            return (
              <button
                key={href}
                onClick={() => router.push(href)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Spotlight Trigger */}
        <button
          onClick={() => {
            // Dispatch Cmd+K to open Spotlight
            document.dispatchEvent(
              new KeyboardEvent("keydown", { key: "k", metaKey: true })
            );
          }}
          className="flex items-center gap-2 rounded-md border border-border bg-secondary/40 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Search className="h-3 w-3" />
          <span>Suchen...</span>
          <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium">
            ⌘K
          </kbd>
        </button>

        <Button
          onClick={() => router.push("/projects?new=true")}
          size="sm"
          className="bg-[hsl(var(--accent-orange))] text-white hover:bg-[hsl(var(--accent-orange))]/90"
        >
          <Plus className="mr-1 h-4 w-4" />
          Neues Projekt
        </Button>

        <NotificationBell />

        <button
          onClick={() => router.push("/profile")}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(var(--accent-orange))] text-sm font-bold text-white"
        >
          LW
        </button>
      </div>
    </nav>
  );
}
