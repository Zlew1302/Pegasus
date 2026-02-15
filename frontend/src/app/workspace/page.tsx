"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Plus,
  Pin,
  Clock,
  Loader2,
  ChevronDown,
  Trash2,
} from "lucide-react";
import { useRecentDocuments, useDocuments } from "@/hooks/use-documents";
import { useProjects } from "@/hooks/use-projects";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { Document } from "@/types";

export default function WorkspacePage() {
  const router = useRouter();
  const { documents: recent, isLoading, deleteDocument } = useRecentDocuments();
  const { projects } = useProjects();
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null);

  const pinned = recent.filter((d) => d.is_pinned);
  const unpinned = recent.filter((d) => !d.is_pinned);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteDocument(deleteTarget.id);
    } catch {
      // silent
    }
    setDeleteTarget(null);
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Workspace</h1>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Neues Dokument
          </button>
        </div>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : recent.length === 0 ? (
          <EmptyState onCreateClick={() => setShowCreate(true)} />
        ) : (
          <>
            {/* Pinned */}
            {pinned.length > 0 && (
              <section className="mb-8">
                <div className="mb-3 flex items-center gap-2">
                  <Pin className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-medium text-muted-foreground">
                    Angepinnt
                  </h2>
                </div>
                <DocGrid
                  docs={pinned}
                  projects={projectMap(projects)}
                  onClick={(id) => router.push(`/workspace/${id}`)}
                  onDelete={setDeleteTarget}
                />
              </section>
            )}

            {/* Recent */}
            <section>
              <div className="mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-medium text-muted-foreground">
                  Zuletzt bearbeitet
                </h2>
              </div>
              <DocGrid
                docs={unpinned}
                projects={projectMap(projects)}
                onClick={(id) => router.push(`/workspace/${id}`)}
                onDelete={setDeleteTarget}
              />
            </section>
          </>
        )}

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
    </div>
  );
}

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <FileText className="h-16 w-16 text-muted-foreground/20" />
      <div className="text-center">
        <h2 className="text-lg font-semibold">Keine Dokumente</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Erstelle dein erstes Dokument um loszulegen.
        </p>
      </div>
      <button
        onClick={onCreateClick}
        className="mt-2 flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        <Plus className="h-4 w-4" />
        Dokument erstellen
      </button>
    </div>
  );
}

function DocGrid({
  docs,
  projects,
  onClick,
  onDelete,
}: {
  docs: Document[];
  projects: Map<string, string>;
  onClick: (id: string) => void;
  onDelete: (doc: Document) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {docs.map((doc) => (
        <div
          key={doc.id}
          className="group relative rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-primary/30 hover:bg-card/80"
        >
          <button
            onClick={() => onClick(doc.id)}
            className="w-full text-left"
          >
            <div className="mb-2 flex items-center gap-2">
              {doc.icon ? (
                <span className="text-lg">{doc.icon}</span>
              ) : (
                <FileText className="h-4 w-4 text-muted-foreground" />
              )}
              <h3 className="truncate text-sm font-medium group-hover:text-primary">
                {doc.title}
              </h3>
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{projects.get(doc.project_id) ?? "Unbekannt"}</span>
              <span>
                {doc.block_count} {doc.block_count === 1 ? "Block" : "Blöcke"}
              </span>
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground/60">
              {new Date(doc.updated_at).toLocaleString("de-DE")}
            </p>
          </button>

          {/* Delete button (visible on hover) */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(doc);
            }}
            className="absolute right-2 top-2 rounded-md p-1.5 text-muted-foreground/0 transition-all hover:bg-red-500/10 hover:text-red-400 group-hover:text-muted-foreground"
            title="Löschen"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

function projectMap(projects: { id: string; title: string }[]): Map<string, string> {
  return new Map(projects.map((p) => [p.id, p.title]));
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
