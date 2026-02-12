"use client";

import { useState, useEffect } from "react";
import { User, MessageSquare, FileText } from "lucide-react";
import { useProfile } from "@/hooks/use-profile";
import { ApiKeyManager } from "@/components/profile/api-key-manager";
import { AuditTrail } from "@/components/profile/audit-trail";
import { TokenUsageChart } from "@/components/profile/token-usage-chart";
import { Button } from "@/components/ui/button";

export default function ProfilePage() {
  const { profile, updateProfile } = useProfile();

  const [displayName, setDisplayName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name);
      setSystemPrompt(profile.global_system_prompt ?? "");
    }
  }, [profile]);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      await updateProfile({
        display_name: displayName,
        global_system_prompt: systemPrompt || null,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl space-y-6 p-6">
        {/* User Info */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">Benutzer-Informationen</h3>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">
                Anzeigename
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-secondary/30 px-3 py-1.5 text-sm outline-none focus:border-[hsl(var(--accent-orange))]"
              />
            </div>
            <Button
              size="sm"
              onClick={handleSaveProfile}
              disabled={isSaving}
              className="bg-[hsl(var(--accent-orange))] text-white hover:bg-[hsl(var(--accent-orange))]/90"
            >
              {isSaving ? "Speichert..." : "Profil speichern"}
            </Button>
          </div>
        </div>

        {/* System Prompt */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">Globaler System-Prompt</h3>
          </div>
          <p className="mb-2 text-xs text-muted-foreground">
            Dieser Prompt wird an alle Agenten angehängt. Pro Projekt überschreibbar.
          </p>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={6}
            placeholder="z.B. Antworte immer auf Deutsch. Sei präzise und faktenbasiert."
            className="w-full rounded-md border border-border bg-secondary/30 px-3 py-2 text-sm outline-none focus:border-[hsl(var(--accent-orange))]"
          />
          <Button
            size="sm"
            onClick={handleSaveProfile}
            disabled={isSaving}
            className="mt-2 bg-[hsl(var(--accent-orange))] text-white hover:bg-[hsl(var(--accent-orange))]/90"
          >
            Speichern
          </Button>
        </div>

        {/* API Keys */}
        <ApiKeyManager />

        {/* Sources Placeholder */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">Quellen & Dateien</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Lokale Dateiquellen für Agenten — kommt in einer zukünftigen Version.
          </p>
        </div>

        {/* Token Usage */}
        <TokenUsageChart />

        {/* Audit Trail */}
        <AuditTrail />
      </div>
    </div>
  );
}
