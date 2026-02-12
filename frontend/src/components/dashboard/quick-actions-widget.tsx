"use client";

import { useRouter } from "next/navigation";
import {
  FolderPlus,
  FileText,
  Bot,
  Kanban,
} from "lucide-react";

const ACTIONS = [
  {
    label: "Neues Projekt",
    icon: FolderPlus,
    href: "/projects?new=true",
    color: "text-[hsl(var(--accent-orange))]",
  },
  {
    label: "Neues Dokument",
    icon: FileText,
    href: "/workspace",
    color: "text-blue-400",
  },
  {
    label: "Agent starten",
    icon: Bot,
    href: "/workspace",
    color: "text-[var(--agent-glow-color)]",
  },
  {
    label: "Board öffnen",
    icon: Kanban,
    href: "/board",
    color: "text-green-400",
  },
];

export function QuickActionsWidget() {
  const router = useRouter();

  return (
    <div className="grid h-full grid-cols-2 gap-2">
      {ACTIONS.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.label}
            onClick={() => router.push(action.href)}
            className="flex flex-col items-center justify-center gap-1.5 rounded-lg bg-secondary/30 p-3 transition-colors hover:bg-secondary/60"
          >
            <Icon className={`h-5 w-5 ${action.color}`} />
            <span className="text-xs font-medium">{action.label}</span>
          </button>
        );
      })}
    </div>
  );
}
