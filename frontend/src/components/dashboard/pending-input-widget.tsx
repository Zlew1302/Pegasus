"use client";

import { useState } from "react";
import { MessageSquareWarning, CheckCircle2 } from "lucide-react";
import useSWR from "swr";
import { apiFetch, fetcher } from "@/lib/api";
import { mutateAfterApprovalAction } from "@/lib/swr-helpers";
import { InfoPopup } from "./info-popup";
import { ApprovalDetail } from "@/components/approval/approval-detail";
import type { ApprovalWithContext } from "@/types";

interface PendingInputWidgetProps {
  count: number;
}

export function PendingInputWidget({ count }: PendingInputWidgetProps) {
  const [popupOpen, setPopupOpen] = useState(false);

  return (
    <>
      <div
        className="flex h-full cursor-pointer items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 transition-colors hover:border-yellow-500/50"
        onClick={() => setPopupOpen(true)}
      >
        <MessageSquareWarning className="h-4 w-4 shrink-0 text-yellow-500" />
        <div className="min-w-0 flex-1">
          <span className={`text-base font-bold leading-none ${count > 0 ? "text-yellow-500" : "text-foreground"}`}>
            {count}
          </span>
          <p className="text-[10px] leading-tight text-muted-foreground">
            {count === 0
              ? "Keine offenen Genehmigungen"
              : count === 1
                ? "Offene Eingaben · Genehmigung wartet"
                : `Offene Eingaben · ${count} warten`}
          </p>
        </div>
      </div>

      <PendingInputPopup open={popupOpen} onClose={() => setPopupOpen(false)} />
    </>
  );
}

function PendingInputPopup({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: approvals, mutate } = useSWR<ApprovalWithContext[]>(
    open ? "/approvals/with-context?status=pending" : null,
    fetcher
  );

  const handleResolve = async (approvalId: string, status: string, comment?: string) => {
    try {
      await apiFetch(`/approvals/${approvalId}/resolve`, {
        method: "POST",
        body: JSON.stringify({ status, comment }),
      });
      await mutate();
      mutateAfterApprovalAction();
    } catch {
      // silent
    }
  };

  return (
    <InfoPopup open={open} onClose={onClose} title="Offene Genehmigungen" wide>
      {!approvals || approvals.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <CheckCircle2 className="h-8 w-8 text-green-500/30" />
          <p className="text-xs text-muted-foreground">
            Keine offenen Genehmigungen.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {approvals.map((a) => (
            <ApprovalDetail
              key={a.id}
              approval={a}
              onResolve={handleResolve}
            />
          ))}
        </div>
      )}
    </InfoPopup>
  );
}
