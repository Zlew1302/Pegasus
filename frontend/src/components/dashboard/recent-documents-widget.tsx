"use client";

import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { useRecentDocuments } from "@/hooks/use-documents";

export function RecentDocumentsWidget() {
  const router = useRouter();
  const { documents } = useRecentDocuments();

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-2 overflow-y-auto">
        {!documents || documents.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            Keine Dokumente vorhanden
          </p>
        ) : (
          documents.slice(0, 10).map((doc) => (
            <div
              key={doc.id}
              onClick={() => router.push(`/workspace/${doc.id}`)}
              className="flex cursor-pointer items-center gap-3 rounded-md bg-secondary/30 px-3 py-2 transition-colors hover:bg-secondary/50"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-secondary/50 text-sm">
                {doc.icon || <FileText className="h-3.5 w-3.5 text-muted-foreground" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{doc.title}</p>
                <p className="text-[10px] text-muted-foreground">
                  {doc.block_count} {doc.block_count === 1 ? "Block" : "Blöcke"}
                </p>
              </div>
              <span className="shrink-0 text-[10px] text-muted-foreground/60">
                {formatDistanceToNow(new Date(doc.updated_at), {
                  locale: de,
                  addSuffix: true,
                })}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
