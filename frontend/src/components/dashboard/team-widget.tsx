"use client";

import { Users, User } from "lucide-react";
import { useTeams } from "@/hooks/use-teams";

interface TeamWidgetProps {
  embedded?: boolean;
}

export function TeamWidget({ embedded = false }: TeamWidgetProps) {
  const { teams, isLoading } = useTeams();

  if (isLoading) {
    const skeleton = (
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded-lg bg-muted/50" />
        ))}
      </div>
    );

    if (embedded) return skeleton;

    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Teams</h3>
        </div>
        {skeleton}
      </div>
    );
  }

  const content =
    teams.length === 0 ? (
      <p className="text-xs text-muted-foreground">
        Noch keine Teams erstellt.
      </p>
    ) : (
      <div className="space-y-2 overflow-y-auto">
        {teams.slice(0, 5).map((team) => (
          <div
            key={team.id}
            className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[hsl(var(--accent-orange))]/10 text-xs font-bold text-[hsl(var(--accent-orange))]">
                {team.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium">{team.name}</p>
                {team.description && (
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {team.description}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              <span>{team.member_count ?? 0}</span>
            </div>
          </div>
        ))}
      </div>
    );

  if (embedded) {
    return <div className="flex h-full flex-col">{content}</div>;
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">Teams</h3>
      </div>
      {content}
    </div>
  );
}
