"use client";

import {
  Search,
  FolderPlus,
  BarChart3,
  Bot,
  ListChecks,
  Navigation,
} from "lucide-react";

interface SpotlightSuggestionsProps {
  onSelect: (text: string) => void;
}

const SUGGESTIONS = [
  {
    icon: Search,
    label: "Offene Tasks anzeigen",
    query: "Zeig mir alle offenen Tasks",
  },
  {
    icon: FolderPlus,
    label: "Neues Projekt",
    query: "Erstelle ein neues Projekt",
  },
  {
    icon: BarChart3,
    label: "Statistiken",
    query: "Wie ist der aktuelle Projektstatus?",
  },
  {
    icon: Bot,
    label: "Recherche starten",
    query: "Recherchiere ",
  },
  {
    icon: ListChecks,
    label: "Task erstellen",
    query: "Erstelle einen Task ",
  },
  {
    icon: Navigation,
    label: "Navigation",
    query: "Öffne ",
  },
];

export function SpotlightSuggestions({ onSelect }: SpotlightSuggestionsProps) {
  return (
    <div className="px-4 py-3">
      <p className="mb-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
        Vorschläge
      </p>
      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map(({ icon: Icon, label, query }) => (
          <button
            key={label}
            onClick={() => onSelect(query)}
            className="flex items-center gap-1.5 rounded-full border border-border/60 bg-secondary/30 px-3 py-1.5 text-xs text-muted-foreground transition-all hover:border-[hsl(var(--accent-orange))]/40 hover:bg-secondary/60 hover:text-foreground"
          >
            <Icon className="h-3 w-3" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
