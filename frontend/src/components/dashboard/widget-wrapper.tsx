"use client";

import { X, GripHorizontal } from "lucide-react";

interface WidgetWrapperProps {
  id: string;
  title?: string;
  children: React.ReactNode;
  onRemove: (id: string) => void;
  /** If true, the entire widget is the drag handle (for KPI cards) */
  noDragHeader?: boolean;
}

export function WidgetWrapper({
  id,
  title,
  children,
  onRemove,
  noDragHeader = false,
}: WidgetWrapperProps) {
  if (noDragHeader) {
    // For KPI cards: entire widget is draggable, just add close button
    return (
      <div className="group relative h-full">
        <div className="drag-handle h-full">{children}</div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(id);
          }}
          className="widget-close-btn absolute -right-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-card border border-border text-muted-foreground shadow-sm transition-colors hover:bg-destructive hover:text-destructive-foreground hover:border-destructive"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  // For regular widgets: drag handle in the header area
  return (
    <div className="group relative flex h-full flex-col rounded-lg border border-border bg-card transition-all duration-200 hover:shadow-lg hover:shadow-black/10">
      {/* Drag handle header */}
      <div className="drag-handle flex shrink-0 cursor-grab items-center justify-between border-b border-border/50 px-4 py-2 active:cursor-grabbing">
        <div className="flex items-center gap-2">
          <GripHorizontal className="h-3.5 w-3.5 text-muted-foreground/50" />
          {title && (
            <h3 className="text-sm font-medium">{title}</h3>
          )}
        </div>
      </div>

      {/* Widget content */}
      <div className="flex-1 overflow-hidden p-4">{children}</div>

      {/* Close button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove(id);
        }}
        className="widget-close-btn absolute -right-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-card border border-border text-muted-foreground shadow-sm transition-colors hover:bg-destructive hover:text-destructive-foreground hover:border-destructive"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
