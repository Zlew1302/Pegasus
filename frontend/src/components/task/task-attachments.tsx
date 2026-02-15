"use client";

import { useCallback, useState } from "react";
import {
  Download,
  File,
  FileImage,
  FileText,
  FileCode,
  FileSpreadsheet,
  Music,
  Paperclip,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAttachments } from "@/hooks/use-attachments";

const ICON_MAP: Record<string, typeof File> = {
  "image/": FileImage,
  "text/": FileText,
  "application/pdf": FileText,
  "application/vnd.openxmlformats-officedocument.spreadsheetml": FileSpreadsheet,
  "application/vnd.ms-excel": FileSpreadsheet,
  "text/csv": FileSpreadsheet,
  "audio/": Music,
  "application/javascript": FileCode,
  "text/typescript": FileCode,
  "text/x-python": FileCode,
};

function getIcon(mimeType: string) {
  for (const [prefix, Icon] of Object.entries(ICON_MAP)) {
    if (mimeType.startsWith(prefix)) return Icon;
  }
  return File;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface TaskAttachmentsProps {
  taskId: string;
}

export function TaskAttachments({ taskId }: TaskAttachmentsProps) {
  const { attachments, isLoading, upload, remove, downloadUrl } =
    useAttachments(taskId);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;
      setUploading(true);
      try {
        for (const file of files) {
          await upload(file);
        }
      } catch {
        // Error handled in hook
      } finally {
        setUploading(false);
      }
    },
    [upload]
  );

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length === 0) return;
      setUploading(true);
      try {
        for (const file of files) {
          await upload(file);
        }
      } catch {
        // Error handled in hook
      } finally {
        setUploading(false);
      }
      e.target.value = "";
    },
    [upload]
  );

  return (
    <div>
      <h3 className="mb-2 text-xs font-medium uppercase text-muted-foreground flex items-center gap-1.5">
        <Paperclip className="h-3 w-3" />
        Anhänge
        {attachments.length > 0 && (
          <span className="text-[10px] font-normal">({attachments.length})</span>
        )}
      </h3>

      {/* Drop Zone */}
      <div
        className={`relative rounded-lg border-2 border-dashed transition-colors ${
          isDragging
            ? "border-[hsl(var(--accent-orange))] bg-[hsl(var(--accent-orange))]/5"
            : "border-border hover:border-muted-foreground/30"
        } ${uploading ? "pointer-events-none opacity-50" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        {attachments.length === 0 && !isLoading ? (
          <label className="flex cursor-pointer flex-col items-center gap-1.5 p-4">
            <Upload className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {uploading ? "Wird hochgeladen..." : "Dateien hierher ziehen oder klicken"}
            </span>
            <input
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
          </label>
        ) : (
          <div className="p-2 space-y-1">
            {attachments.map((att) => {
              const Icon = getIcon(att.mime_type);
              return (
                <div
                  key={att.id}
                  className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-secondary/50"
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{att.original_filename}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatSize(att.file_size_bytes)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a
                      href={downloadUrl(att.id)}
                      download
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md hover:bg-secondary"
                    >
                      <Download className="h-3 w-3 text-muted-foreground" />
                    </a>
                    <button
                      onClick={() => remove(att.id)}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </button>
                  </div>
                </div>
              );
            })}
            {/* Add more button */}
            <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-secondary/50">
              <Upload className="h-3 w-3" />
              {uploading ? "Wird hochgeladen..." : "Weitere Datei hinzufügen"}
              <input
                type="file"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
