"use client";

import { useState } from "react";
import { X, ChevronDown, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TaskStatus } from "@/types";
import { COLUMNS } from "@/types";

interface BulkActionBarProps {
  selectedCount: number;
  onClear: () => void;
  onBulkStatusChange: (status: TaskStatus) => void;
  onBulkDelete: () => void;
}

export function BulkActionBar({
  selectedCount,
  onClear,
  onBulkStatusChange,
  onBulkDelete,
}: BulkActionBarProps) {
  const [showStatus, setShowStatus] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  if (selectedCount === 0) return null;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-[hsl(var(--accent-orange))]/30 bg-[hsl(var(--accent-orange))]/5 px-4 py-2">
      <span className="text-sm font-medium">
        {selectedCount} Task{selectedCount > 1 ? "s" : ""} ausgewählt
      </span>

      {/* Status Change */}
      <div className="relative">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => {
            setShowStatus(!showStatus);
            setShowConfirm(false);
          }}
        >
          Status ändern
          <ChevronDown className="ml-1 h-3 w-3" />
        </Button>
        {showStatus && (
          <div className="absolute left-0 top-full z-50 mt-1 w-40 rounded-lg border border-border bg-card py-1 shadow-lg">
            {COLUMNS.map((col) => (
              <button
                key={col.id}
                onClick={() => {
                  onBulkStatusChange(col.id);
                  setShowStatus(false);
                }}
                className="flex w-full items-center px-3 py-1.5 text-xs hover:bg-muted"
              >
                {col.title}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Delete */}
      {!showConfirm ? (
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs text-red-400 hover:text-red-300"
          onClick={() => {
            setShowConfirm(true);
            setShowStatus(false);
          }}
        >
          <Trash2 className="mr-1 h-3 w-3" />
          Löschen
        </Button>
      ) : (
        <div className="flex items-center gap-1">
          <span className="text-xs text-red-400">Sicher?</span>
          <Button
            variant="destructive"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              onBulkDelete();
              setShowConfirm(false);
            }}
          >
            Ja, löschen
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setShowConfirm(false)}
          >
            Nein
          </Button>
        </div>
      )}

      <div className="flex-1" />

      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs"
        onClick={onClear}
      >
        <X className="mr-1 h-3 w-3" />
        Auswahl aufheben
      </Button>
    </div>
  );
}
