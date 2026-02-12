"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { FolderKanban, Calendar, Wallet, ChevronDown, MoreHorizontal, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { Project } from "@/types";

const STATUS_OPTIONS = [
  { value: "active", label: "Aktiv", color: "bg-green-500" },
  { value: "planning", label: "Planung", color: "bg-blue-500" },
  { value: "paused", label: "Pausiert", color: "bg-yellow-500" },
  { value: "completed", label: "Abgeschlossen", color: "bg-purple-500" },
  { value: "archived", label: "Archiviert", color: "bg-gray-500" },
] as const;

function getStatusInfo(status: string) {
  return STATUS_OPTIONS.find((s) => s.value === status) ?? STATUS_OPTIONS[0];
}

interface ProjectCardProps {
  project: Project;
  onClick: () => void;
  onStatusChange?: (projectId: string, newStatus: string) => void;
  onDelete?: (projectId: string) => void;
}

export function ProjectCard({ project, onClick, onStatusChange, onDelete }: ProjectCardProps) {
  const [statusOpen, setStatusOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(project.status);
  const statusRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const statusInfo = getStatusInfo(currentStatus);

  // Close status dropdown on outside click
  useEffect(() => {
    if (!statusOpen) return;
    const handler = (e: MouseEvent) => {
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) {
        setStatusOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [statusOpen]);

  // Close context menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const handleStatusClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setStatusOpen((prev) => !prev);
    setMenuOpen(false);
  }, []);

  const handleStatusSelect = useCallback(
    async (e: React.MouseEvent, newStatus: string) => {
      e.stopPropagation();
      setCurrentStatus(newStatus);
      setStatusOpen(false);
      try {
        await apiFetch(`/projects/${project.id}`, {
          method: "PATCH",
          body: JSON.stringify({ status: newStatus }),
        });
        onStatusChange?.(project.id, newStatus);
      } catch {
        setCurrentStatus(project.status);
      }
    },
    [project.id, project.status, onStatusChange]
  );

  const handleMenuClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen((prev) => !prev);
    setStatusOpen(false);
  }, []);

  const handleDeleteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    setConfirmDelete(true);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    setConfirmDelete(false);
    onDelete?.(project.id);
  }, [project.id, onDelete]);

  return (
    <>
      <button
        onClick={onClick}
        className="group/card flex flex-col gap-3 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-[hsl(var(--accent-orange))]/50"
      >
        {/* Title row */}
        <div className="flex items-start gap-3">
          <FolderKanban className="mt-0.5 h-5 w-5 shrink-0 text-[hsl(var(--accent-orange))]" />
          <h3 className="flex-1 font-semibold leading-tight">{project.title}</h3>
          {project.phase && (
            <span className="shrink-0 rounded-full bg-secondary px-2.5 py-0.5 text-[11px] text-muted-foreground">
              {project.phase}
            </span>
          )}
          {/* Context menu ··· */}
          <div className="relative" ref={menuRef}>
            <div
              onClick={handleMenuClick}
              className="shrink-0 rounded p-0.5 text-muted-foreground/0 transition-colors group-hover/card:text-muted-foreground/50 hover:!bg-secondary hover:!text-foreground"
            >
              <MoreHorizontal className="h-4 w-4" />
            </div>
            {menuOpen && (
              <div className="absolute right-0 top-full z-50 mt-1 w-40 rounded-lg border border-border bg-card py-1 shadow-xl">
                <button
                  onClick={handleDeleteClick}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-400 transition-colors hover:bg-red-500/10"
                >
                  <Trash2 className="h-3 w-3" />
                  Projekt löschen
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        {project.description && (
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {project.description}
          </p>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <FolderKanban className="h-3 w-3" />
            {project.task_count ?? 0} Tasks
          </span>
          {project.start_date && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(project.start_date).toLocaleDateString("de-DE")}
            </span>
          )}
          {project.budget_cents > 0 && (
            <span className="flex items-center gap-1">
              <Wallet className="h-3 w-3" />
              {(project.budget_cents / 100).toFixed(0)} €
            </span>
          )}
        </div>

        {/* Status — clickable dropdown */}
        <div className="relative" ref={statusRef}>
          <div
            onClick={handleStatusClick}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors hover:bg-secondary"
          >
            <span className={`inline-block h-2 w-2 rounded-full ${statusInfo.color}`} />
            <span className="text-muted-foreground">{statusInfo.label}</span>
            <ChevronDown className="h-3 w-3 text-muted-foreground/50" />
          </div>

          {statusOpen && (
            <div className="absolute bottom-full left-0 z-50 mb-1 w-44 rounded-lg border border-border bg-card py-1 shadow-xl">
              <p className="px-2.5 py-1 text-[10px] font-medium uppercase text-muted-foreground">
                Status ändern
              </p>
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={(e) => handleStatusSelect(e, opt.value)}
                  className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-xs transition-colors ${
                    opt.value === currentStatus
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
      </button>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={confirmDelete}
        title="Projekt löschen?"
        message={`"${project.title}" wird unwiderruflich gelöscht, inklusive aller Tasks, Dokumente und Daten.`}
        confirmLabel="Endgültig löschen"
        destructive
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}

export { STATUS_OPTIONS };
