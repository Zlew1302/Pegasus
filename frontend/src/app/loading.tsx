import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center space-y-3">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-zinc-500" />
        <p className="text-sm text-zinc-500">Laden...</p>
      </div>
    </div>
  );
}
