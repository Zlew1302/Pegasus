"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pin, PinOff, Trash2, Loader2 } from "lucide-react";
import { useDocument } from "@/hooks/use-documents";
import { DocumentEditor } from "@/components/workspace/document-editor";

export default function WorkspaceDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { document: doc, updateDocument, isLoading } = useDocument(id);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Dokument nicht gefunden</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-2">
        <button
          onClick={() => router.push("/workspace")}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div className="flex-1 truncate text-sm font-medium">
          {doc.icon && <span className="mr-1">{doc.icon}</span>}
          {doc.title}
        </div>

        <button
          onClick={() => updateDocument({ is_pinned: !doc.is_pinned })}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          title={doc.is_pinned ? "Loesung aufheben" : "Anpinnen"}
        >
          {doc.is_pinned ? (
            <PinOff className="h-4 w-4" />
          ) : (
            <Pin className="h-4 w-4" />
          )}
        </button>

        <button
          onClick={async () => {
            const { apiFetch } = await import("@/lib/api");
            await apiFetch(`/documents/${id}`, { method: "DELETE" });
            router.push("/workspace");
          }}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-400"
          title="Löschen"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-y-auto py-6">
        <DocumentEditor documentId={id} />
      </div>
    </div>
  );
}
