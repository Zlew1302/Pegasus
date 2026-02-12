"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Plus, Pin, Trash2, Loader2 } from "lucide-react";
import { useDocuments } from "@/hooks/use-documents";

interface ProjectDocsTabProps {
  projectId: string;
}

export function ProjectDocsTab({ projectId }: ProjectDocsTabProps) {
  const router = useRouter();
  const { documents, isLoading, createDocument, deleteDocument } =
    useDocuments(projectId);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const doc = await createDocument(newTitle.trim());
      setNewTitle("");
      router.push(`/workspace/${doc.id}`);
    } finally {
      setCreating(false);
    }
  };

  const pinned = documents.filter((d) => d.is_pinned);
  const rest = documents.filter((d) => !d.is_pinned);

  return (
    <div className="p-4">
      {/* Create input */}
      <div className="mb-4 flex gap-2">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          placeholder="Neues Dokument..."
          className="flex-1 rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/50"
        />
        <button
          onClick={handleCreate}
          disabled={!newTitle.trim() || creating}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {creating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          Erstellen
        </button>
      </div>

      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-12">
          <FileText className="h-10 w-10 text-muted-foreground/20" />
          <p className="text-sm text-muted-foreground">
            Noch keine Dokumente in diesem Projekt
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {[...pinned, ...rest].map((doc) => (
            <div
              key={doc.id}
              className="group flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-secondary/50"
            >
              <button
                onClick={() => router.push(`/workspace/${doc.id}`)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                {doc.icon ? (
                  <span className="text-sm">{doc.icon}</span>
                ) : (
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <span className="truncate text-sm">{doc.title}</span>
                {doc.is_pinned && (
                  <Pin className="h-3 w-3 shrink-0 text-muted-foreground" />
                )}
              </button>
              <span className="text-[11px] text-muted-foreground">
                {doc.block_count} {doc.block_count === 1 ? "Block" : "Bloecke"}
              </span>
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  await deleteDocument(doc.id);
                }}
                className="rounded p-1 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground hover:!text-red-400"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
