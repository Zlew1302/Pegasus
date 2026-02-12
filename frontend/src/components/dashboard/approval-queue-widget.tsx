"use client";

import { CheckCircle, XCircle, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import useSWR from "swr";
import { fetcher, apiFetch } from "@/lib/api";
import type { Approval } from "@/types";

export function ApprovalQueueWidget() {
  const { data: approvals, mutate } = useSWR<Approval[]>(
    "/approvals?status=pending",
    fetcher,
    { refreshInterval: 10000 }
  );

  const handleResolve = async (
    approvalId: string,
    status: "approved" | "rejected"
  ) => {
    try {
      await apiFetch(`/approvals/${approvalId}/resolve`, {
        method: "POST",
        body: JSON.stringify({ status, comment: null }),
      });
      mutate();
    } catch {
      // Silently fail
    }
  };

  const items = approvals ?? [];

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-2 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-4">
            <CheckCircle className="h-8 w-8 text-green-500/30" />
            <p className="text-xs text-muted-foreground">
              Keine offenen Genehmigungen
            </p>
          </div>
        ) : (
          items.map((approval) => (
            <div
              key={approval.id}
              className="flex items-center gap-3 rounded-md bg-secondary/30 px-3 py-2"
            >
              <Clock className="h-4 w-4 shrink-0 text-yellow-500" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">
                  {approval.description || approval.type}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(approval.requested_at), {
                    locale: de,
                    addSuffix: true,
                  })}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => handleResolve(approval.id, "approved")}
                  className="flex h-7 items-center gap-1 rounded-md bg-green-500/10 px-2 text-xs font-medium text-green-400 transition-colors hover:bg-green-500/20"
                >
                  <CheckCircle className="h-3 w-3" />
                  OK
                </button>
                <button
                  onClick={() => handleResolve(approval.id, "rejected")}
                  className="flex h-7 items-center gap-1 rounded-md bg-red-500/10 px-2 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20"
                >
                  <XCircle className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
