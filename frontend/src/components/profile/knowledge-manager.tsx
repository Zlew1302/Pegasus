"use client";

import { useCallback, useRef, useState } from "react";
import {
  FileText,
  Upload,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Database,
  FileType,
  X,
} from "lucide-react";
import { useKnowledge } from "@/hooks/use-knowledge";
import type { KnowledgeDocument } from "@/types";

const FILE_TYPE_LABELS: Record<string, string> = {
  pdf: "PDF",
  docx: "Word",
  xlsx: "Excel",
  pptx: "PowerPoint",
  html: "HTML",
  markdown: "Markdown",
  json: "JSON",
  text: "Text",
  csv: "CSV",
  image: "Bild",
};

const FILE_TYPE_COLORS: Record<string, string> = {
  pdf: "text-red-400",
  docx: "text-blue-400",
  xlsx: "text-green-400",
  pptx: "text-orange-400",
  html: "text-purple-400",
  markdown: "text-cyan-400",
  json: "text-yellow-400",
  text: "text-slate-400",
  csv: "text-teal-400",
  image: "text-emerald-400",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface KnowledgeManagerProps {
  projectId?: string;
}

export function KnowledgeManager({ projectId }: KnowledgeManagerProps) {
  const {
    documents,
    stats,
    isLoadingDocs,
    isUploading,
    upload,
    deleteDoc,
    updateDoc,
  } = useKnowledge(projectId);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // ── Upload handlers ──────────────────────────────────────

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      setError(null);
      const fileArray = Array.from(files);
      for (const file of fileArray) {
        try {
          await upload(file);
        } catch (e: any) {
          setError(e.message || "Upload fehlgeschlagen");
        }
      }
    },
    [upload]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  // ── Inline edit ──────────────────────────────────────────

  const startEdit = (doc: KnowledgeDocument) => {
    setEditingId(doc.id);
    setEditTitle(doc.title);
  };

  const saveEdit = async () => {
    if (editingId && editTitle.trim()) {
      await updateDoc(editingId, { title: editTitle.trim() });
    }
    setEditingId(null);
  };

  // ── Group documents ──────────────────────────────────────

  const globalDocs = documents.filter((d) => !d.project_id);
  const projectDocs = documents.filter((d) => d.project_id);

  // ── Render ───────────────────────────────────────────────

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Wissensbasis</h3>
          {stats && stats.total_documents > 0 && (
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
              {stats.total_documents} Dok. · {stats.total_chunks} Chunks ·{" "}
              {stats.total_words.toLocaleString("de-DE")} Wörter
            </span>
          )}
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="flex items-center gap-1 rounded-md bg-[hsl(var(--accent-orange))] px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-[hsl(var(--accent-orange))]/90 disabled:opacity-50"
        >
          {isUploading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Upload className="h-3 w-3" />
          )}
          Upload
        </button>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.html,.htm,.md,.markdown,.json,.txt,.csv,.py,.js,.ts,.png,.jpg,.jpeg,.gif,.webp"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`mb-4 cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-all ${
          isDragging
            ? "border-[hsl(var(--accent-orange))] bg-[hsl(var(--accent-orange))]/5"
            : "border-border hover:border-muted-foreground/30"
        }`}
      >
        <Upload
          className={`mx-auto mb-2 h-6 w-6 ${
            isDragging ? "text-[hsl(var(--accent-orange))]" : "text-muted-foreground/40"
          }`}
        />
        <p className="text-xs text-muted-foreground">
          {isDragging
            ? "Dateien hier ablegen..."
            : "Dateien hierher ziehen oder klicken"}
        </p>
        <p className="mt-1 text-[10px] text-muted-foreground/60">
          PDF, DOCX, XLSX, PPTX, CSV, MD, TXT, JSON, PNG, JPG
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-3 flex items-center gap-2 rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Document list */}
      {isLoadingDocs ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : documents.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">
          Noch keine Dokumente hochgeladen.
        </p>
      ) : (
        <div className="space-y-3">
          {/* Global documents */}
          {globalDocs.length > 0 && (
            <DocumentGroup
              label="Globale Dokumente"
              documents={globalDocs}
              editingId={editingId}
              editTitle={editTitle}
              setEditTitle={setEditTitle}
              onStartEdit={startEdit}
              onSaveEdit={saveEdit}
              confirmDeleteId={confirmDeleteId}
              onConfirmDelete={setConfirmDeleteId}
              onDelete={deleteDoc}
            />
          )}

          {/* Project documents */}
          {projectDocs.length > 0 && (
            <DocumentGroup
              label="Projekt-Dokumente"
              documents={projectDocs}
              editingId={editingId}
              editTitle={editTitle}
              setEditTitle={setEditTitle}
              onStartEdit={startEdit}
              onSaveEdit={saveEdit}
              confirmDeleteId={confirmDeleteId}
              onConfirmDelete={setConfirmDeleteId}
              onDelete={deleteDoc}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── Document Group ──────────────────────────────────────────

interface DocumentGroupProps {
  label: string;
  documents: KnowledgeDocument[];
  editingId: string | null;
  editTitle: string;
  setEditTitle: (v: string) => void;
  onStartEdit: (doc: KnowledgeDocument) => void;
  onSaveEdit: () => void;
  confirmDeleteId: string | null;
  onConfirmDelete: (id: string | null) => void;
  onDelete: (id: string) => void;
}

function DocumentGroup({
  label,
  documents,
  editingId,
  editTitle,
  setEditTitle,
  onStartEdit,
  onSaveEdit,
  confirmDeleteId,
  onConfirmDelete,
  onDelete,
}: DocumentGroupProps) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
        {label}
      </p>
      <div className="space-y-1">
        {documents.map((doc) => (
          <DocumentRow
            key={doc.id}
            doc={doc}
            isEditing={editingId === doc.id}
            editTitle={editTitle}
            setEditTitle={setEditTitle}
            onStartEdit={() => onStartEdit(doc)}
            onSaveEdit={onSaveEdit}
            isConfirmDelete={confirmDeleteId === doc.id}
            onConfirmDelete={() => onConfirmDelete(doc.id)}
            onCancelDelete={() => onConfirmDelete(null)}
            onDelete={() => {
              onDelete(doc.id);
              onConfirmDelete(null);
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Document Row ────────────────────────────────────────────

interface DocumentRowProps {
  doc: KnowledgeDocument;
  isEditing: boolean;
  editTitle: string;
  setEditTitle: (v: string) => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  isConfirmDelete: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
}

function DocumentRow({
  doc,
  isEditing,
  editTitle,
  setEditTitle,
  onStartEdit,
  onSaveEdit,
  isConfirmDelete,
  onConfirmDelete,
  onCancelDelete,
  onDelete,
}: DocumentRowProps) {
  const typeColor = FILE_TYPE_COLORS[doc.file_type] || "text-slate-400";
  const typeLabel = FILE_TYPE_LABELS[doc.file_type] || doc.file_type.toUpperCase();

  return (
    <div className="group flex items-center gap-2 rounded-md bg-secondary/30 px-3 py-2 transition-colors hover:bg-secondary/50">
      {/* Type icon */}
      <FileType className={`h-4 w-4 shrink-0 ${typeColor}`} />

      {/* Title */}
      <div className="min-w-0 flex-1">
        {isEditing ? (
          <input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={onSaveEdit}
            onKeyDown={(e) => e.key === "Enter" && onSaveEdit()}
            autoFocus
            className="w-full rounded border border-border bg-transparent px-1 py-0 text-xs outline-none focus:border-[hsl(var(--accent-orange))]"
          />
        ) : (
          <button
            onClick={onStartEdit}
            className="block w-full truncate text-left text-xs hover:text-[hsl(var(--accent-orange))]"
            title={`${doc.title} — Klicken zum Bearbeiten`}
          >
            {doc.title}
          </button>
        )}
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60">
          <span>{typeLabel}</span>
          <span>·</span>
          <span>{formatBytes(doc.file_size_bytes)}</span>
          {doc.status === "ready" && (
            <>
              <span>·</span>
              <span>{doc.total_chunks} Chunks</span>
            </>
          )}
        </div>
      </div>

      {/* Status */}
      <div className="shrink-0">
        {doc.status === "processing" && (
          <span title="Wird verarbeitet...">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" />
          </span>
        )}
        {doc.status === "ready" && (
          <span title="Bereit">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
          </span>
        )}
        {doc.status === "error" && (
          <span title={doc.error_message || "Fehler"}>
            <AlertCircle className="h-3.5 w-3.5 text-red-400" />
          </span>
        )}
      </div>

      {/* Delete */}
      {isConfirmDelete ? (
        <div className="flex items-center gap-1">
          <button
            onClick={onDelete}
            className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] text-red-400 transition-colors hover:bg-red-500/30"
          >
            Löschen
          </button>
          <button
            onClick={onCancelDelete}
            className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-secondary/80"
          >
            Nein
          </button>
        </div>
      ) : (
        <button
          onClick={onConfirmDelete}
          className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
          title="Löschen"
        >
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-red-400" />
        </button>
      )}
    </div>
  );
}
