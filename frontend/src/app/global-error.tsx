"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="de" className="dark">
      <body className="bg-zinc-950 text-zinc-100 font-sans antialiased">
        <div className="flex h-screen items-center justify-center p-8">
          <div className="text-center max-w-md space-y-4">
            <h2 className="text-xl font-semibold">
              Kritischer Fehler
            </h2>
            <p className="text-sm text-zinc-400">
              Die Anwendung konnte nicht geladen werden.
            </p>
            <button
              onClick={reset}
              className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium hover:bg-zinc-700 transition-colors"
            >
              Seite neu laden
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
