"use client";

import { Calendar, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchBar } from "@/components/ui/search-bar";

type ZoomLevel = "week" | "month" | "quarter";

interface GanttToolbarProps {
  zoom: ZoomLevel;
  onZoomChange: (zoom: ZoomLevel) => void;
  showCompleted: boolean;
  onToggleCompleted: () => void;
  onScrollToToday: () => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
}

export function GanttToolbar({
  zoom,
  onZoomChange,
  showCompleted,
  onToggleCompleted,
  onScrollToToday,
  searchQuery,
  onSearchChange,
}: GanttToolbarProps) {
  return (
    <div className="flex items-center gap-2 border-b border-border px-4 py-2">
      <SearchBar
        value={searchQuery}
        onChange={onSearchChange}
        placeholder="Tasks durchsuchen..."
      />
      <div className="flex gap-1">
        {(["week", "month", "quarter"] as ZoomLevel[]).map((level) => (
          <Button
            key={level}
            variant={zoom === level ? "default" : "outline"}
            size="sm"
            onClick={() => onZoomChange(level)}
            className={zoom === level ? "bg-[hsl(var(--accent-orange))] text-white" : ""}
          >
            {level === "week" ? "Woche" : level === "month" ? "Monat" : "Quartal"}
          </Button>
        ))}
      </div>
      <Button variant="outline" size="sm" onClick={onScrollToToday} className="gap-1.5">
        <Calendar className="h-3.5 w-3.5" />
        Heute
      </Button>
      <Button variant="outline" size="sm" onClick={onToggleCompleted} className="gap-1.5">
        {showCompleted ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        {showCompleted ? "Erledigte ausblenden" : "Erledigte einblenden"}
      </Button>
    </div>
  );
}
