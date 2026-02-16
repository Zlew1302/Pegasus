"use client";

import { useState, useCallback } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Globe,
  FileText,
  Plus,
  X,
  Search,
  Loader2,
  Upload,
  CheckSquare,
  Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useKnowledge } from "@/hooks/use-knowledge";
import {
  updatePlanningInput,
  searchExa,
} from "@/hooks/use-planning-workflow";
import type { PlanningSession, ExaSearchResult, KnowledgeDocument } from "@/types";

interface PlanningInputStepProps {
  session: PlanningSession;
  projectId: string;
  onSessionUpdate: (session: PlanningSession) => void;
  onGenerate: () => void;
  onBack: () => void;
}

export function PlanningInputStep({
  session,
  projectId,
  onSessionUpdate,
  onGenerate,
  onBack,
}: PlanningInputStepProps) {
  const { documents, upload, isUploading } = useKnowledge(projectId);

  // User notes
  const [userNotes, setUserNotes] = useState(session.user_notes || "");

  // Knowledge docs selection
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(() => {
    try {
      const ids = session.knowledge_doc_ids ? JSON.parse(session.knowledge_doc_ids) : [];
      return new Set(ids);
    } catch {
      return new Set();
    }
  });

  // Web search
  const [searchMode, setSearchMode] = useState<"topics" | "auto">(
    session.auto_context ? "auto" : "topics"
  );
  const [topicInput, setTopicInput] = useState("");
  const [topics, setTopics] = useState<string[]>(() => {
    try {
      return session.web_search_topics ? JSON.parse(session.web_search_topics) : [];
    } catch {
      return [];
    }
  });
  const [searchResults, setSearchResults] = useState<ExaSearchResult[]>(() => {
    try {
      return session.web_search_results ? JSON.parse(session.web_search_results) : [];
    } catch {
      return [];
    }
  });
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const toggleDoc = useCallback((docId: string) => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  }, []);

  const addTopic = useCallback(() => {
    const trimmed = topicInput.trim();
    if (trimmed && !topics.includes(trimmed)) {
      setTopics((prev) => [...prev, trimmed]);
      setTopicInput("");
    }
  }, [topicInput, topics]);

  const removeTopic = useCallback((topic: string) => {
    setTopics((prev) => prev.filter((t) => t !== topic));
  }, []);

  const handleSearch = useCallback(async () => {
    setIsSearching(true);
    setSearchError(null);
    try {
      const results = await searchExa(
        session.id,
        searchMode === "auto" ? [] : topics,
      );
      setSearchResults(results);
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : "Fehler bei der Suche");
    } finally {
      setIsSearching(false);
    }
  }, [session.id, searchMode, topics]);

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;
      for (const file of Array.from(files)) {
        await upload(file, projectId);
      }
      e.target.value = "";
    },
    [upload, projectId],
  );

  const handleGenerate = useCallback(async () => {
    setIsSaving(true);
    try {
      // Save input to session first
      const updated = await updatePlanningInput(session.id, {
        user_notes: userNotes || null,
        knowledge_doc_ids: Array.from(selectedDocIds),
        web_search_topics: topics,
        auto_context: searchMode === "auto",
      });
      onSessionUpdate(updated);
      onGenerate();
    } catch {
      // Errors handled by parent
    } finally {
      setIsSaving(false);
    }
  }, [session.id, userNotes, selectedDocIds, topics, searchMode, onSessionUpdate, onGenerate]);

  return (
    <div className="flex flex-col gap-6 py-4">
      {/* Section 1: Notes */}
      <section>
        <h3 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
          <FileText className="h-4 w-4 text-[hsl(var(--accent-orange))]" />
          Notizen & Wünsche
        </h3>
        <textarea
          value={userNotes}
          onChange={(e) => setUserNotes(e.target.value)}
          placeholder="Beschreibe deine Vorstellungen, Anforderungen oder Hinweise..."
          className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-[hsl(var(--accent-orange))] focus:outline-none resize-y"
        />
      </section>

      {/* Section 2: Knowledge Sources */}
      <section>
        <h3 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
          <FileText className="h-4 w-4 text-[hsl(var(--accent-orange))]" />
          Kontext-Quellen
        </h3>
        <div className="space-y-2">
          {documents.length > 0 ? (
            <div className="max-h-[160px] overflow-y-auto space-y-1 rounded-md border border-border/50 p-2">
              {documents.map((doc: KnowledgeDocument) => (
                <button
                  key={doc.id}
                  onClick={() => toggleDoc(doc.id)}
                  className="flex items-center gap-2 w-full rounded px-2 py-1.5 text-sm hover:bg-accent/10 transition-colors text-left"
                >
                  {selectedDocIds.has(doc.id) ? (
                    <CheckSquare className="h-4 w-4 text-[hsl(var(--accent-orange))] shrink-0" />
                  ) : (
                    <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <span className="truncate">{doc.title || doc.filename}</span>
                  <span className="ml-auto text-xs text-muted-foreground shrink-0">
                    {doc.file_type}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Keine Dokumente vorhanden.</p>
          )}

          <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
            <Upload className="h-4 w-4" />
            {isUploading ? "Wird hochgeladen..." : "Datei hochladen"}
            <input
              type="file"
              className="hidden"
              multiple
              onChange={handleFileUpload}
              disabled={isUploading}
            />
          </label>
        </div>
      </section>

      {/* Section 3: Web Search */}
      <section>
        <h3 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
          <Globe className="h-4 w-4 text-[hsl(var(--accent-orange))]" />
          Web-Recherche (Exa.ai)
        </h3>

        {/* Mode toggle */}
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setSearchMode("topics")}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
              searchMode === "topics"
                ? "bg-[hsl(var(--accent-orange))]/10 text-[hsl(var(--accent-orange))] border border-[hsl(var(--accent-orange))]/30"
                : "bg-card border border-border/50 text-muted-foreground hover:text-foreground"
            }`}
          >
            Eigene Themen
          </button>
          <button
            onClick={() => setSearchMode("auto")}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
              searchMode === "auto"
                ? "bg-[hsl(var(--accent-orange))]/10 text-[hsl(var(--accent-orange))] border border-[hsl(var(--accent-orange))]/30"
                : "bg-card border border-border/50 text-muted-foreground hover:text-foreground"
            }`}
          >
            Auto Kontext
          </button>
        </div>

        {searchMode === "topics" ? (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTopic();
                  }
                }}
                placeholder="Suchthema eingeben..."
                className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:border-[hsl(var(--accent-orange))] focus:outline-none"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={addTopic}
                disabled={!topicInput.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {topics.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {topics.map((topic) => (
                  <span
                    key={topic}
                    className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--accent-orange))]/10 border border-[hsl(var(--accent-orange))]/20 px-3 py-1 text-sm text-[hsl(var(--accent-orange))]"
                  >
                    {topic}
                    <button
                      onClick={() => removeTopic(topic)}
                      className="ml-1 hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Das System sucht automatisch nach relevanten Informationen basierend auf der Projektbeschreibung.
          </p>
        )}

        <Button
          size="sm"
          variant="outline"
          className="mt-3 gap-2"
          onClick={handleSearch}
          disabled={isSearching || (searchMode === "topics" && topics.length === 0)}
        >
          {isSearching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          Recherche starten
        </Button>

        {searchError && (
          <p className="mt-2 text-sm text-destructive">{searchError}</p>
        )}

        {/* Search results */}
        {searchResults.length > 0 && (
          <div className="mt-3 space-y-2 max-h-[200px] overflow-y-auto">
            <p className="text-xs text-muted-foreground">
              {searchResults.length} Ergebnis(se) gefunden
            </p>
            {searchResults.map((result, i) => (
              <div
                key={i}
                className="rounded-md border border-border/50 p-3 text-sm"
              >
                <a
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-[hsl(var(--accent-orange))] hover:underline"
                >
                  {result.title}
                </a>
                <p className="mt-1 text-muted-foreground text-xs line-clamp-2">
                  {result.snippet}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Footer */}
      <div className="flex justify-between pt-4 border-t border-border/50">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Zurück
        </Button>
        <Button
          onClick={handleGenerate}
          disabled={isSaving}
          className="gap-2 bg-[hsl(var(--accent-orange))] text-white hover:bg-[hsl(var(--accent-orange))]/90"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowRight className="h-4 w-4" />
          )}
          Plan generieren
        </Button>
      </div>
    </div>
  );
}
