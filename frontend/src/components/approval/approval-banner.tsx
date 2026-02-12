"use client";

import { useState } from "react";
import { CheckCircle, XCircle, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Approval } from "@/types";

interface ApprovalBannerProps {
  approval: Approval;
  onResolve: (approvalId: string, status: string, comment?: string) => void;
}

export function ApprovalBanner({ approval, onResolve }: ApprovalBannerProps) {
  const [comment, setComment] = useState("");
  const [showComment, setShowComment] = useState(false);

  return (
    <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3">
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
        <p className="text-sm font-medium text-yellow-200">
          Genehmigung erforderlich
        </p>
      </div>

      {approval.description && (
        <p className="mt-1 text-xs text-muted-foreground">
          {approval.description}
        </p>
      )}

      {showComment && (
        <Textarea
          placeholder="Kommentar (optional)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="mt-2"
          rows={2}
        />
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          className="gap-1 bg-green-600 hover:bg-green-700"
          onClick={() => onResolve(approval.id, "approved", comment || undefined)}
        >
          <CheckCircle className="h-3.5 w-3.5" />
          Genehmigen
        </Button>
        <Button
          size="sm"
          variant="destructive"
          className="gap-1"
          onClick={() => onResolve(approval.id, "rejected", comment || undefined)}
        >
          <XCircle className="h-3.5 w-3.5" />
          Ablehnen
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1"
          onClick={() => {
            if (showComment && comment.trim()) {
              onResolve(approval.id, "changes_requested", comment);
            } else {
              setShowComment(true);
            }
          }}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Änderungen
        </Button>
      </div>
    </div>
  );
}
