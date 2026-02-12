"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FileText } from "lucide-react";
import type { TaskOutput as TaskOutputType } from "@/types";

interface TaskOutputProps {
  output: TaskOutputType;
}

export function TaskOutput({ output }: TaskOutputProps) {
  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          Version {output.version}
        </span>
        <span className="ml-auto text-xs text-muted-foreground">
          {new Date(output.created_at).toLocaleString("de-DE")}
        </span>
      </div>

      {/* Content */}
      <div className="prose prose-invert prose-sm max-w-none p-3">
        {output.content_type === "markdown" && output.content ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {output.content}
          </ReactMarkdown>
        ) : (
          <pre className="whitespace-pre-wrap text-xs">
            {output.content ?? "Kein Inhalt"}
          </pre>
        )}
      </div>
    </div>
  );
}
