"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center max-w-md space-y-4">
        <AlertTriangle className="mx-auto h-12 w-12 text-red-400" />
        <h2 className="text-xl font-semibold text-zinc-100">
          Etwas ist schiefgelaufen
        </h2>
        <p className="text-sm text-zinc-400">
          Ein unerwarteter Fehler ist aufgetreten. Versuche es erneut oder lade
          die Seite neu.
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Erneut versuchen
        </button>
      </div>
    </div>
  );
}
