"use client";

import { MessageSquareWarning } from "lucide-react";
import { useRouter } from "next/navigation";

interface PendingInputWidgetProps {
  count: number;
}

export function PendingInputWidget({ count }: PendingInputWidgetProps) {
  const router = useRouter();

  return (
    <div
      className="flex h-full cursor-pointer flex-col justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:border-yellow-500/50"
      onClick={() => router.push("/projects")}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase text-muted-foreground">
          Offene Eingaben
        </span>
        <MessageSquareWarning className="h-4 w-4 text-yellow-500" />
      </div>
      <div className="mt-2">
        <span className={`text-2xl font-bold ${count > 0 ? "text-yellow-500" : "text-foreground"}`}>
          {count}
        </span>
        <p className="mt-1 text-xs text-muted-foreground">
          {count === 0
            ? "Keine offenen Genehmigungen"
            : count === 1
              ? "Genehmigung wartet"
              : `Genehmigungen warten`}
        </p>
      </div>
    </div>
  );
}
