"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Plus,
  Pin,
  Loader2,
  ChevronDown,
  Trash2,
  MoreHorizontal,
  Search,
  Filter,
  Calendar,
  Layers,
} from "lucide-react";
import { useRecentDocuments, useDocuments } from "@/hooks/use-documents";
import { useProjects } from "@/hooks/use-projects";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import type { Document } from "@/types";

// ── Main Page ────────────────────────────────────────────────

export default function WorkspacePage() {
  const router = useRouter();
  const { documents: recent, isLoading, deleteDocument } = useRecentDocuments();
  const { projects } = useProjects();
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState("");

  const filteredDocs = useMemo(() => {
    let filtered = recent;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((d) => d.title.toLowerCase().includes(q));
    }
    if (projectFilter) {
      filtered = filtered.filter((d) => d.project_id === projectFilter);
    }
    return filtered;
  }, [recent, searchQuery, projectFilter]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await deleteDocument(deleteTarget.id);
    } catch {
      // silent
    }
    setDeleteTarget(null);
  }, [deleteTarget, deleteDocument]);

  const pMap = useMemo(
    () => new Map(projects.map((p) => [p.id, p.title])),
    [projects],
  );

  return (
    <div className="flex h-full flex-col">
      {/* Filter Bar — identical layout to projects/filter-bar.tsx */}
      <WorkspaceFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        projectFilter={projectFilter}
        onProjectFilterChange={setProjectFilter}
        projects={projects}
        onCreateClick={() => setShowCreate(true)}
      />

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <FileText className="h-16 w-16 text-muted-foreground/20" />
            <p className="text-muted-foreground">
              {recent.length === 0
                ? "Noch keine Dokumente. Erstelle dein erstes Dokument!"
                : "Keine Dokumente gefunden."}
            </p>
            {recent.length === 0 && (
              <Button
                onClick={() => setShowCreate(true)}
                className="bg-[hsl(var(--accent-orange))] text-white hover:bg-[hsl(var(--accent-orange))]/90"
              >
                <Plus className="mr-1 h-4 w-4" />
                Neues Dokument
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredDocs.map((doc) => (
              <DocCard
                key={doc.id}
                doc={doc}
                projectName={pMap.get(doc.project_id) ?? "Unbekannt"}
                onClick={() => router.push(`/workspace/${doc.id}`)}
                onDelete={() => setDeleteTarget(doc)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Dialog */}
      {showCreate && (
        <CreateDocDialog
          projects={projects}
          onClose={() => setShowCreate(false)}
          onCreated={(id) => {
            setShowCreate(false);
            router.push(`/workspace/${id}`);
          }}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Dokument löschen?"
        message={`"${deleteTarget?.title}" wird unwiderruflich gelöscht, inklusive aller Blöcke.`}
        confirmLabel="Endgültig löschen"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

// ── Filter Bar ───────────────────────────────────────────────

function WorkspaceFilterBar({
  searchQuery,
  onSearchChange,
  projectFilter,
  onProjectFilterChange,
  projects,
  onCreateClick,
}: {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  projectFilter: string;
  onProjectFilterChange: (id: string) => void;
  projects: { id: string; title: string }[];
  onCreateClick: () => void;
}) {
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

  const activeProject = projects.find((p) => p.id === projectFilter);
  const label = activeProject ? activeProject.title : "Alle Projekte";

  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-2">
      {/* Search */}
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Dokumente suchen..."
          className="w-full rounded-md border border-border bg-secondary/30 py-1.5 pl-9 pr-3 text-sm outline-none transition-colors focus:border-[hsl(var(--accent-orange))]"
        />
      </div>

      {/* Project filter dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setOpen(!open)}
          className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors ${
            projectFilter
              ? "border-[hsl(var(--accent-orange))]/50 bg-[hsl(var(--accent-orange))]/10 text-foreground"
              : "border-border bg-secondary/30 text-muted-foreground hover:text-foreground"
          }`}
        >
          <Filter className="h-3.5 w-3.5" />
          <span className="max-w-[140px] truncate">{label}</span>
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        {open && (
          <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border border-border bg-card py-1 shadow-xl">
            {/* "All" option */}
            <button
              onClick={() => {
                onProjectFilterChange("");
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
                !projectFilter
                  ? "bg-accent/50 text-accent-foreground"
                  : "text-foreground hover:bg-secondary/50"
              }`}
            >
              <span className="inline-block h-2 w-2 rounded-full bg-gradient-to-r from-green-500 via-blue-500 to-purple-500" />
              Alle Projekte
            </button>
            <div className="my-1 border-t border-border" />
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  onProjectFilterChange(p.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
                  p.id === projectFilter
                    ? "bg-accent/50 text-accent-foreground"
                    : "text-foreground hover:bg-secondary/50"
                }`}
              >
                <span className="inline-block h-2 w-2 rounded-full bg-[hsl(var(--accent-orange))]" />
                {p.title}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* New Document button */}
      <button
        onClick={onCreateClick}
        className="flex min-w-[10.5rem] items-center justify-center gap-1.5 rounded-md bg-[hsl(var(--accent-orange))] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[hsl(var(--accent-orange))]/90"
      >
        <Plus className="h-3.5 w-3.5" />
        Neues Dokument
      </button>
    </div>
  );
}

// ── Doc Card — matching ProjectCard design ───────────────────

function DocCard({
  doc,
  projectName,
  onClick,
  onDelete,
}: {
  doc: Document;
  projectName: string;
  onClick: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  const handleMenuClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen((prev) => !prev);
  }, []);

  const handleDeleteClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setMenuOpen(false);
      onDelete();
    },
    [onDelete],
  );

  return (
    <button
      onClick={onClick}
      className="group/card flex flex-col gap-3 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-[hsl(var(--accent-orange))]/50"
    >
      {/* Title row */}
      <div className="flex items-start gap-3">
        {doc.icon ? (
          <span className="mt-0.5 text-lg">{doc.icon}</span>
        ) : (
          <FileText className="mt-0.5 h-5 w-5 shrink-0 text-[hsl(var(--accent-orange))]" />
        )}
        <h3 className="flex-1 font-semibold leading-tight">{doc.title}</h3>
        {doc.is_pinned && (
          <Pin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
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
            <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-lg border border-border bg-card py-1 shadow-xl">
              <button
                onClick={handleDeleteClick}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-400 transition-colors hover:bg-red-500/10"
              >
                <Trash2 className="h-3 w-3" />
                Dokument löschen
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Layers className="h-3 w-3" />
          {doc.block_count} {doc.block_count === 1 ? "Block" : "Blöcke"}
        </span>
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {new Date(doc.updated_at).toLocaleDateString("de-DE")}
        </span>
      </div>

      {/* Project name (like status row in ProjectCard) */}
      <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="inline-block h-2 w-2 rounded-full bg-[hsl(var(--accent-orange))]" />
        {projectName}
      </div>
    </button>
  );
}

// ── Create Document Dialog ────────────────────────────────────

function CreateDocDialog({
  projects,
  onClose,
  onCreated,
}: {
  projects: { id: string; title: string }[];
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [creating, setCreating] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { createDocument } = useDocuments(projectId || null);

  const handleCreate = async () => {
    if (!title.trim() || !projectId) return;
    setCreating(true);
    try {
      const doc = await createDocument(title.trim());
      onCreated(doc.id);
    } catch {
      setCreating(false);
    }
  };

  const selectedProject = projects.find((p) => p.id === projectId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
        <h2 className="mb-4 text-lg font-semibold">Neues Dokument</h2>

        {/* Custom project dropdown */}
        <div className="relative mb-4">
          <label className="mb-1 block text-xs text-muted-foreground">
            Projekt
          </label>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex w-full items-center justify-between rounded-md border border-border bg-secondary/50 px-3 py-2 text-left text-sm transition-colors hover:bg-secondary/70"
          >
            <span>{selectedProject?.title ?? "Projekt wählen..."}</span>
            <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
          </button>
          {dropdownOpen && (
            <div className="absolute left-0 top-full z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border bg-card py-1 shadow-xl">
              <p className="px-2.5 py-1 text-[10px] font-medium uppercase text-muted-foreground">
                Projekt wählen
              </p>
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setProjectId(p.id);
                    setDropdownOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-xs transition-colors ${
                    p.id === projectId
                      ? "bg-accent/50 text-accent-foreground"
                      : "text-foreground hover:bg-secondary/50"
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-[hsl(var(--accent-orange))]" />
                  {p.title}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mb-6">
          <label className="mb-1 block text-xs text-muted-foreground">
            Titel
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="z.B. Projektnotizen"
            className="w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/50"
            autoFocus
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            Abbrechen
          </button>
          <button
            onClick={handleCreate}
            disabled={!title.trim() || !projectId || creating}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {creating && <Loader2 className="h-3 w-3 animate-spin" />}
            Erstellen
          </button>
        </div>
      </div>
    </div>
  );
}
