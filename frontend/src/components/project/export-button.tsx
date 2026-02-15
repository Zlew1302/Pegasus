"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, FileText, File } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ExportButtonProps {
  projectId: string;
}

export function ExportButton({ projectId }: ExportButtonProps) {
  const [open, setOpen] = useState(false);

  const formats = [
    { key: "csv", label: "CSV", icon: FileText, description: "Kommagetrennte Werte" },
    { key: "excel", label: "Excel", icon: FileSpreadsheet, description: "Excel-Arbeitsmappe" },
    { key: "pdf", label: "PDF", icon: File, description: "PDF-Report" },
  ];

  const handleExport = (format: string) => {
    setOpen(false);
    // Direct download via browser
    window.open(`/api/projects/${projectId}/export?format=${format}`, "_blank");
  };

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => setOpen(!open)}
      >
        <Download className="h-3.5 w-3.5" />
        Export
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border border-border bg-card p-1 shadow-lg">
            {formats.map(({ key, label, icon: Icon, description }) => (
              <button
                key={key}
                onClick={() => handleExport(key)}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-secondary"
              >
                <Icon className="h-4 w-4 text-muted-foreground" />
                <div className="text-left">
                  <p>{label}</p>
                  <p className="text-[10px] text-muted-foreground">{description}</p>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
