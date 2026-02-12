"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SidePanelProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function SidePanel({ open, onClose, children }: SidePanelProps) {
  if (!open) return null;

  return (
    <div className="flex h-full w-[420px] shrink-0 flex-col border-l border-border bg-card">
      <div className="flex items-center justify-end border-b border-border px-3 py-2">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4">{children}</div>
      </ScrollArea>
    </div>
  );
}
