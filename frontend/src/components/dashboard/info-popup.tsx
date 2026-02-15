"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface InfoPopupProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Anchor to position near (optional). Falls back to center screen. */
  anchorRef?: React.RefObject<HTMLElement | null>;
  /** Use wider panel (for rich content like approval details). */
  wide?: boolean;
}

export function InfoPopup({ open, onClose, title, children, anchorRef, wide }: InfoPopupProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay to avoid closing immediately on open click
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handler);
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handler);
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const popup = (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[9998] bg-black/30" />
      {/* Panel — rendered via portal to guarantee viewport-relative centering */}
      <div
        ref={panelRef}
        className={`fixed left-1/2 top-1/2 z-[9999] w-full max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-4 shadow-2xl ${wide ? "sm:max-w-2xl" : "sm:max-w-md"}`}
        style={{ animation: "popup-in 150ms ease-out forwards" }}
      >
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto">{children}</div>
      </div>
    </>
  );

  return createPortal(popup, document.body);
}
