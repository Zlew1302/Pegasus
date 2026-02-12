"use client";

import { useState } from "react";
import { Users, Plus, X, Bot, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTeams, useTeamMembers, addMember, removeMember } from "@/hooks/use-teams";

interface ProjectTeamSectionProps {
  teamId: string | null;
}

export function ProjectTeamSection({ teamId }: ProjectTeamSectionProps) {
  const { teams } = useTeams();
  const { members, mutate } = useTeamMembers(teamId);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"human" | "agent">("human");

  const team = teams.find((t) => t.id === teamId);

  if (!teamId || !team) {
    return (
      <div className="rounded-lg border border-border bg-card/50 p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Users className="h-4 w-4" />
          <span className="text-sm">Kein Team zugewiesen</span>
        </div>
      </div>
    );
  }

  async function handleAdd() {
    if (!newName.trim() || !teamId) return;
    await addMember(teamId, {
      member_type: newType,
      member_id: crypto.randomUUID(),
      member_name: newName.trim(),
      role: "member",
    });
    mutate();
    setNewName("");
    setShowAdd(false);
  }

  async function handleRemove(memberId: string) {
    if (!teamId) return;
    await removeMember(teamId, memberId);
    mutate();
  }

  return (
    <div className="rounded-lg border border-border bg-card/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-medium">{team.name}</h4>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {members.length} Mitglieder
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setShowAdd(!showAdd)}
        >
          <Plus className="mr-1 h-3 w-3" />
          Hinzufügen
        </Button>
      </div>

      {/* Add Member Form */}
      {showAdd && (
        <div className="mb-3 flex items-center gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Name..."
            className="h-8 text-sm"
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as "human" | "agent")}
            className="h-8 rounded-md border border-border bg-background px-2 text-xs"
          >
            <option value="human">Mensch</option>
            <option value="agent">Agent</option>
          </select>
          <Button size="sm" className="h-8" onClick={handleAdd}>
            OK
          </Button>
        </div>
      )}

      {/* Members */}
      <div className="flex flex-wrap gap-2">
        {members.map((m) => (
          <div
            key={m.id}
            className="group flex items-center gap-1.5 rounded-full bg-muted/50 px-3 py-1"
          >
            {m.member_type === "agent" ? (
              <Bot className="h-3 w-3 text-cyan-400" />
            ) : (
              <User className="h-3 w-3 text-green-400" />
            )}
            <span className="text-xs">{m.member_name ?? m.member_id}</span>
            <button
              onClick={() => handleRemove(m.id)}
              className="ml-0.5 hidden text-muted-foreground hover:text-foreground group-hover:block"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {members.length === 0 && (
          <p className="text-xs text-muted-foreground">Noch keine Mitglieder.</p>
        )}
      </div>
    </div>
  );
}
