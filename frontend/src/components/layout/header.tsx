"use client";

import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  projectTitle: string;
  onOpenCommandPalette: () => void;
}

export function Header({ projectTitle, onOpenCommandPalette }: HeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-border px-6 py-3">
      <h2 className="text-lg font-semibold">{projectTitle}</h2>
      <Button
        variant="outline"
        size="sm"
        className="gap-2 text-muted-foreground"
        onClick={onOpenCommandPalette}
      >
        <Search className="h-3 w-3" />
        <span className="text-xs">Suchen...</span>
        <kbd className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">
          ⌘K
        </kbd>
      </Button>
    </div>
  );
}
