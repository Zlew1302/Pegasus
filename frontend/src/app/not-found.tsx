import { FileQuestion, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center max-w-md space-y-4">
        <FileQuestion className="mx-auto h-12 w-12 text-zinc-500" />
        <h2 className="text-xl font-semibold text-zinc-100">
          Seite nicht gefunden
        </h2>
        <p className="text-sm text-zinc-400">
          Die angeforderte Seite existiert nicht oder wurde verschoben.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Zum Dashboard
        </Link>
      </div>
    </div>
  );
}
