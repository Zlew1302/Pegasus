"use client";

import { useState, useEffect, useRef } from "react";
import {
  User,
  Pencil,
  Check,
  Save,
  Terminal,
} from "lucide-react";
import { useProfile } from "@/hooks/use-profile";
import { ApiKeyManager } from "@/components/profile/api-key-manager";
import { AuditTrail } from "@/components/profile/audit-trail";
import { TokenUsageChart } from "@/components/profile/token-usage-chart";
import { KnowledgeManager } from "@/components/profile/knowledge-manager";
import { IntegrationManager } from "@/components/profile/integration-manager";
import { Button } from "@/components/ui/button";

// ── Main page ───────────────────────────────────────────────────
export default function ProfilePage() {
  const { profile, updateProfile } = useProfile();

  const [displayName, setDisplayName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name);
      setSystemPrompt(profile.global_system_prompt ?? "");
    }
  }, [profile]);

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      await updateProfile({
        display_name: displayName,
        global_system_prompt: systemPrompt || null,
      });
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 2000);
    } finally {
      setIsSaving(false);
      setIsEditingName(false);
    }
  };

  const handleNameBlur = () => {
    setIsEditingName(false);
    if (!displayName.trim() && profile) {
      setDisplayName(profile.display_name);
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveProfile();
    }
    if (e.key === "Escape") {
      setIsEditingName(false);
      if (profile) setDisplayName(profile.display_name);
    }
  };

  const initial = displayName?.charAt(0)?.toUpperCase() || "?";
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("de-DE", {
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl p-6">
        {/* ── Profile Header ──────────────────────────────────── */}
        <div className="relative mb-8 overflow-hidden rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm">
          {/* Gradient background decoration */}
          <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--accent-orange))]/8 via-transparent to-[hsl(var(--accent-orange))]/3" />
          <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-[hsl(var(--accent-orange))]/5 blur-3xl" />
          <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-[hsl(var(--accent-orange))]/5 blur-3xl" />

          <div className="relative flex items-center gap-6 p-8">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[hsl(var(--accent-orange))] to-[hsl(var(--accent-orange))]/60 text-3xl font-bold text-white shadow-lg shadow-[hsl(var(--accent-orange))]/20 ring-4 ring-background/50">
                {initial}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full border-2 border-background bg-green-500" />
            </div>

            {/* Name & meta */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                {isEditingName ? (
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    onBlur={handleNameBlur}
                    onKeyDown={handleNameKeyDown}
                    className="max-w-xs rounded-lg border border-[hsl(var(--accent-orange))]/50 bg-secondary/40 px-3 py-1.5 text-2xl font-bold outline-none transition-colors focus:border-[hsl(var(--accent-orange))]"
                  />
                ) : (
                  <>
                    <h1 className="truncate text-2xl font-bold tracking-tight">
                      {displayName || "Unbenannt"}
                    </h1>
                    <button
                      onClick={() => setIsEditingName(true)}
                      className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
                      title="Name bearbeiten"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-3">
                {memberSince && (
                  <span className="text-sm text-muted-foreground">
                    Mitglied seit {memberSince}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--accent-orange))]/10 px-2.5 py-0.5 text-xs font-medium text-[hsl(var(--accent-orange))]">
                  <User className="h-3 w-3" />
                  Admin
                </span>
              </div>
            </div>

            {/* Save indicator */}
            {showSaved && (
              <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-green-500/10 px-3 py-1.5 text-xs font-medium text-green-400">
                <Check className="h-3.5 w-3.5" />
                Gespeichert
              </div>
            )}
          </div>
        </div>

        {/* ── Two-column grid ─────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* ── Left column ─────────────────────────────────── */}
          <div className="space-y-6 lg:col-span-5">
            {/* Personal section */}
            <div className="rounded-xl border border-border/50 bg-card/80 p-5 backdrop-blur-sm transition-all duration-200 hover:border-border hover:shadow-lg hover:shadow-black/10">
              <div className="mb-4 flex items-center gap-2.5 border-b border-border/40 pb-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary/60">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <h3 className="text-sm font-semibold tracking-tight">
                  Persoenliches
                </h3>
              </div>

              <div className="space-y-4">
                {/* Display name */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    Anzeigename
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full rounded-lg border border-border/60 bg-secondary/20 px-3.5 py-2 text-sm outline-none transition-all duration-200 placeholder:text-muted-foreground/40 focus:border-[hsl(var(--accent-orange))]/60 focus:bg-secondary/30 focus:ring-1 focus:ring-[hsl(var(--accent-orange))]/20"
                    placeholder="Dein Name..."
                  />
                </div>

                {/* System prompt */}
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Terminal className="h-3 w-3" />
                    Globaler System-Prompt
                  </label>
                  <p className="mb-2 text-[11px] leading-relaxed text-muted-foreground/60">
                    Dieser Prompt wird an alle Agenten angehaengt. Pro Projekt
                    ueberschreibbar.
                  </p>
                  <textarea
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    rows={8}
                    placeholder="z.B. Antworte immer auf Deutsch. Sei praezise und faktenbasiert."
                    className="w-full rounded-lg border border-border/60 bg-secondary/20 px-3.5 py-2.5 font-mono text-xs leading-relaxed outline-none transition-all duration-200 placeholder:text-muted-foreground/40 focus:border-[hsl(var(--accent-orange))]/60 focus:bg-secondary/30 focus:ring-1 focus:ring-[hsl(var(--accent-orange))]/20"
                  />
                </div>

                {/* Save button */}
                <div className="flex items-center gap-3">
                  <Button
                    size="sm"
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                    className="bg-[hsl(var(--accent-orange))] px-5 text-white shadow-md shadow-[hsl(var(--accent-orange))]/20 transition-all duration-200 hover:bg-[hsl(var(--accent-orange))]/90 hover:shadow-lg hover:shadow-[hsl(var(--accent-orange))]/30"
                  >
                    {isSaving ? (
                      "Speichert..."
                    ) : (
                      <>
                        <Save className="mr-1.5 h-3.5 w-3.5" />
                        Speichern
                      </>
                    )}
                  </Button>
                  {showSaved && (
                    <span className="text-xs text-green-400">
                      Aenderungen gespeichert
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* API Keys — enhanced card wrapper */}
            <div className="profile-card-enhanced">
              <ApiKeyManager />
            </div>

            {/* Integrations — enhanced card wrapper */}
            <div className="profile-card-enhanced">
              <IntegrationManager />
            </div>
          </div>

          {/* ── Right column ────────────────────────────────── */}
          <div className="space-y-6 lg:col-span-7">
            {/* Token Usage */}
            <div className="profile-card-enhanced">
              <TokenUsageChart />
            </div>

            {/* Knowledge Base */}
            <div className="profile-card-enhanced">
              <KnowledgeManager />
            </div>

            {/* Audit Trail */}
            <div className="profile-card-enhanced">
              <AuditTrail />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
