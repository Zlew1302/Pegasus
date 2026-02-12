"use client";

import {
  Bot,
  CheckCircle2,
  Wallet,
  MessageSquareWarning,
  TrendingUp,
  BarChart3,
  Activity,
  Bell,
  ListTodo,
  Zap,
  ShieldCheck,
  Rocket,
  FolderKanban,
  FileText,
  Users,
  Check,
  Plus,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  WIDGET_REGISTRY,
  CATEGORY_LABELS,
  type WidgetDefinition,
} from "./widget-registry";

const ICON_MAP: Record<string, LucideIcon> = {
  Bot,
  CheckCircle2,
  Wallet,
  MessageSquareWarning,
  TrendingUp,
  BarChart3,
  Activity,
  Bell,
  ListTodo,
  Zap,
  ShieldCheck,
  Rocket,
  FolderKanban,
  FileText,
  Users,
};

interface WidgetPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visibleWidgets: string[];
  onToggleWidget: (widgetId: string) => void;
}

export function WidgetPicker({
  open,
  onOpenChange,
  visibleWidgets,
  onToggleWidget,
}: WidgetPickerProps) {
  // Group widgets by category
  const grouped = WIDGET_REGISTRY.reduce(
    (acc, widget) => {
      if (!acc[widget.category]) acc[widget.category] = [];
      acc[widget.category].push(widget);
      return acc;
    },
    {} as Record<string, WidgetDefinition[]>
  );

  const categories: WidgetDefinition["category"][] = [
    "kpi",
    "chart",
    "feed",
    "action",
    "info",
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Widgets verwalten</DialogTitle>
          <DialogDescription>
            Wähle aus, welche Widgets auf deinem Dashboard angezeigt werden
            sollen.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-5 overflow-y-auto pr-1">
          {categories.map((cat) => {
            const widgets = grouped[cat];
            if (!widgets?.length) return null;

            return (
              <div key={cat}>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {CATEGORY_LABELS[cat]}
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {widgets.map((widget) => {
                    const isVisible = visibleWidgets.includes(widget.id);
                    const Icon = ICON_MAP[widget.icon] || Activity;

                    return (
                      <button
                        key={widget.id}
                        onClick={() => onToggleWidget(widget.id)}
                        className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-all ${
                          isVisible
                            ? "border-[hsl(var(--accent-orange))]/50 bg-[hsl(var(--accent-orange))]/5"
                            : "border-border bg-secondary/20 hover:bg-secondary/40"
                        }`}
                      >
                        <div
                          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                            isVisible
                              ? "bg-[hsl(var(--accent-orange))]/10 text-[hsl(var(--accent-orange))]"
                              : "bg-secondary/50 text-muted-foreground"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{widget.name}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                            {widget.description}
                          </p>
                        </div>
                        <div
                          className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors ${
                            isVisible
                              ? "bg-[hsl(var(--accent-orange))] text-white"
                              : "border border-border text-transparent"
                          }`}
                        >
                          {isVisible ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <Plus className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
