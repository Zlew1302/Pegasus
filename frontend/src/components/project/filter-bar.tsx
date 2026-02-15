"use client";

import { useState, useRef, useEffect } from "react";
import { Search, ChevronDown, Filter, Plus } from "lucide-react";
import { STATUS_OPTIONS } from "./project-card";

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  statusFilter: string;
  onStatusFilterChange: (s: string) => void;
  onNewProject?: () => void;
}

export function FilterBar({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  onNewProject,
}: FilterBarProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const activeOption = STATUS_OPTIONS.find((s) => s.value === statusFilter);
  const label = activeOption ? activeOption.label : "Alle Status";

  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-2">
      {/* Search */}
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Projekte suchen..."
          className="w-full rounded-md border border-border bg-secondary/30 py-1.5 pl-9 pr-3 text-sm outline-none transition-colors focus:border-[hsl(var(--accent-orange))]"
        />
      </div>

      {/* Status filter dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setOpen(!open)}
          className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors ${
            statusFilter
              ? "border-[hsl(var(--accent-orange))]/50 bg-[hsl(var(--accent-orange))]/10 text-foreground"
              : "border-border bg-secondary/30 text-muted-foreground hover:text-foreground"
          }`}
        >
          <Filter className="h-3.5 w-3.5" />
          {statusFilter && activeOption && (
            <span className={`h-2 w-2 rounded-full ${activeOption.color}`} />
          )}
          <span>{label}</span>
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        {open && (
          <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border border-border bg-card py-1 shadow-xl">
            {/* "All" option */}
            <button
              onClick={() => {
                onStatusFilterChange("");
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
                !statusFilter
                  ? "bg-accent/50 text-accent-foreground"
                  : "text-foreground hover:bg-secondary/50"
              }`}
            >
              <span className="inline-block h-2 w-2 rounded-full bg-gradient-to-r from-green-500 via-blue-500 to-purple-500" />
              Alle Status
            </button>
            <div className="my-1 border-t border-border" />
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  onStatusFilterChange(opt.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
                  opt.value === statusFilter
                    ? "bg-accent/50 text-accent-foreground"
                    : "text-foreground hover:bg-secondary/50"
                }`}
              >
                <span className={`inline-block h-2 w-2 rounded-full ${opt.color}`} />
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* New Project button */}
      {onNewProject && (
        <button
          onClick={onNewProject}
          className="flex min-w-[10.5rem] items-center justify-center gap-1.5 rounded-md bg-[hsl(var(--accent-orange))] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[hsl(var(--accent-orange))]/90"
        >
          <Plus className="h-3.5 w-3.5" />
          Neues Projekt
        </button>
      )}
    </div>
  );
}
