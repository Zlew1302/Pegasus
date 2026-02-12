// Widget Registry — all available dashboard widgets
// Pure data module, no React imports

export interface WidgetDefinition {
  id: string;
  name: string;
  description: string;
  icon: string; // lucide icon name
  category: "kpi" | "chart" | "feed" | "action" | "info";
  defaultLayout: {
    w: number;
    h: number;
    minW?: number;
    minH?: number;
    maxW?: number;
    maxH?: number;
  };
  defaultVisible: boolean;
}

export const WIDGET_REGISTRY: WidgetDefinition[] = [
  // ── KPI Widgets ─────────────────────────────
  {
    id: "kpi-agents",
    name: "Aktive Agenten",
    description: "Anzahl aktuell laufender KI-Agenten",
    icon: "Bot",
    category: "kpi",
    defaultLayout: { w: 3, h: 2, minW: 2, minH: 2, maxW: 4, maxH: 2 },
    defaultVisible: true,
  },
  {
    id: "kpi-tasks",
    name: "Tasks diese Woche",
    description: "Erledigte Tasks der aktuellen Woche",
    icon: "CheckCircle2",
    category: "kpi",
    defaultLayout: { w: 3, h: 2, minW: 2, minH: 2, maxW: 4, maxH: 2 },
    defaultVisible: true,
  },
  {
    id: "kpi-cost",
    name: "Token-Kosten 7T",
    description: "Token-Ausgaben der letzten 7 Tage",
    icon: "Wallet",
    category: "kpi",
    defaultLayout: { w: 3, h: 2, minW: 2, minH: 2, maxW: 4, maxH: 2 },
    defaultVisible: true,
  },
  {
    id: "kpi-pending",
    name: "Offene Eingaben",
    description: "Genehmigungen die auf Eingabe warten",
    icon: "MessageSquareWarning",
    category: "kpi",
    defaultLayout: { w: 3, h: 2, minW: 2, minH: 2, maxW: 4, maxH: 2 },
    defaultVisible: true,
  },

  // ── Chart Widgets ───────────────────────────
  {
    id: "chart-costs",
    name: "Token-Kosten Chart",
    description: "Kostenverlauf als Diagramm",
    icon: "TrendingUp",
    category: "chart",
    defaultLayout: { w: 6, h: 3, minW: 4, minH: 3, maxW: 12, maxH: 5 },
    defaultVisible: true,
  },
  {
    id: "chart-productivity",
    name: "Produktivität Chart",
    description: "Erledigte Tasks pro Tag als Diagramm",
    icon: "BarChart3",
    category: "chart",
    defaultLayout: { w: 6, h: 3, minW: 4, minH: 3, maxW: 12, maxH: 5 },
    defaultVisible: true,
  },

  // ── Feed Widgets ────────────────────────────
  {
    id: "activity",
    name: "Agent-Aktivität",
    description: "Echtzeit-Feed laufender Agenten",
    icon: "Activity",
    category: "feed",
    defaultLayout: { w: 4, h: 3, minW: 3, minH: 2, maxW: 8, maxH: 6 },
    defaultVisible: true,
  },
  {
    id: "notifications",
    name: "Benachrichtigungen",
    description: "Aktuelle Benachrichtigungen und Hinweise",
    icon: "Bell",
    category: "feed",
    defaultLayout: { w: 4, h: 3, minW: 3, minH: 2, maxW: 8, maxH: 6 },
    defaultVisible: false,
  },

  // ── Action Widgets ──────────────────────────
  {
    id: "todos",
    name: "Nächste Schritte",
    description: "Persönliche To-Do-Liste",
    icon: "ListTodo",
    category: "action",
    defaultLayout: { w: 4, h: 3, minW: 3, minH: 2, maxW: 8, maxH: 6 },
    defaultVisible: true,
  },
  {
    id: "agents",
    name: "Agent-Schnellstart",
    description: "Verfügbare Agent-Typen starten",
    icon: "Zap",
    category: "action",
    defaultLayout: { w: 4, h: 3, minW: 3, minH: 2, maxW: 8, maxH: 6 },
    defaultVisible: true,
  },
  {
    id: "approvals",
    name: "Genehmigungen",
    description: "Offene Genehmigungsanfragen bearbeiten",
    icon: "ShieldCheck",
    category: "action",
    defaultLayout: { w: 6, h: 3, minW: 4, minH: 2, maxW: 12, maxH: 5 },
    defaultVisible: true,
  },
  {
    id: "quick-actions",
    name: "Schnellaktionen",
    description: "Häufige Aktionen als Buttons",
    icon: "Rocket",
    category: "action",
    defaultLayout: { w: 3, h: 2, minW: 3, minH: 2, maxW: 6, maxH: 3 },
    defaultVisible: false,
  },

  // ── Info Widgets ────────────────────────────
  {
    id: "projects",
    name: "Projekte",
    description: "Übersicht aller Projekte mit Status",
    icon: "FolderKanban",
    category: "info",
    defaultLayout: { w: 6, h: 3, minW: 4, minH: 2, maxW: 12, maxH: 6 },
    defaultVisible: true,
  },
  {
    id: "documents",
    name: "Letzte Dokumente",
    description: "Zuletzt bearbeitete Dokumente",
    icon: "FileText",
    category: "info",
    defaultLayout: { w: 4, h: 3, minW: 3, minH: 2, maxW: 8, maxH: 6 },
    defaultVisible: false,
  },
  {
    id: "teams",
    name: "Teams",
    description: "Team-Übersicht mit Mitgliedern",
    icon: "Users",
    category: "info",
    defaultLayout: { w: 4, h: 3, minW: 3, minH: 2, maxW: 8, maxH: 6 },
    defaultVisible: false,
  },
  {
    id: "decision-tracks",
    name: "Organisations-Map",
    description: "Gelernte Organisationsstruktur und Arbeitsabläufe",
    icon: "Network",
    category: "info",
    defaultLayout: { w: 6, h: 4, minW: 4, minH: 3, maxW: 12, maxH: 8 },
    defaultVisible: false,
  },
];

export const WIDGET_MAP = Object.fromEntries(
  WIDGET_REGISTRY.map((w) => [w.id, w])
);

export const CATEGORY_LABELS: Record<WidgetDefinition["category"], string> = {
  kpi: "Kennzahlen",
  chart: "Diagramme",
  feed: "Feeds",
  action: "Aktionen",
  info: "Informationen",
};
