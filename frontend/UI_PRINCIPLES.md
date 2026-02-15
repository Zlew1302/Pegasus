# Pegasus UI Principles

> Verbindliche Gestaltungsrichtlinien. Alle Komponenten MUESSEN sich daran halten.

## 1. Farbsystem

### Basis (Dark Mode only)
| Token | HSL | Verwendung |
|-------|-----|------------|
| `--background` | 224 71% 4% | Seiten-Hintergrund |
| `--card` | 224 71% 4% | Karten, Panels |
| `--secondary` | 217.2 32.6% 17.5% | Sekundaere Flaechen, Hover-States |
| `--muted` | 223 47% 11% | Gedaempfte Hintergruende |
| `--border` | 216 34% 17% | Rahmen, Trennlinien |
| `--foreground` | 213 31% 91% | Primaertext |
| `--muted-foreground` | 215.4 16.3% 56.9% | Sekundaertext, Labels |

### Akzentfarben
| Token | HSL | Verwendung |
|-------|-----|------------|
| `--accent-orange` | 24 95% 53% | Primaer-Akzent, CTAs, aktive Elemente |
| `--agent-glow` | 199 89% 48% | Agent-Aktivitaet, KI-bezogene Elemente |

### Statusfarben
| Farbe | Tailwind | Verwendung |
|-------|----------|------------|
| Gruen | `green-500` | Erfolg, abgeschlossen, aktiv |
| Gelb | `yellow-500` | Warnung, wartend, Genehmigung noetig |
| Rot | `red-400` / `red-500` | Fehler, kritisch, destruktive Aktionen |
| Blau | `blue-500` | Planung, informativ |
| Lila | `purple-500` | Abgeschlossen (Projekt-Status) |
| Grau | `gray-500` | Archiviert, inaktiv |

## 2. Typografie

| Element | Klasse | Beispiel |
|---------|--------|----------|
| Seitentitel | `text-lg font-bold` | "Guten Tag, Lukas" |
| Karten-Label | `text-xs font-medium uppercase text-muted-foreground` | "AKTIVE AGENTEN" |
| KPI-Wert (kompakt) | `text-lg font-bold` | "3" |
| KPI-Wert (gross) | `text-2xl font-bold` | Nur in Chart-Widgets |
| Meta-Text | `text-[10px] text-muted-foreground/60` | Timestamps, sekundaere Infos |
| Body-Text | `text-sm` | Beschreibungen |
| Button-Text | `text-xs font-medium` | Alle Buttons |

## 3. Abstande (Spacing)

| Kontext | Wert | Tailwind |
|---------|------|----------|
| Karten-Padding | 12px | `p-3` |
| Karten-Padding (kompakt) | 10px | `p-2.5` |
| Widget-Margin (Grid) | 12px | via GridLayout margin |
| Abstand zwischen Elementen in Karten | 8px | `gap-2` |
| Abstand Label zu Wert | 4px | `mt-1` |
| Abstand zwischen Sections | 16px | `gap-4` |
| Page-Padding | 16px | `p-4` |

## 4. Rundungen

| Element | Wert | Tailwind |
|---------|------|----------|
| Karten, Widgets | 8px | `rounded-lg` |
| Buttons, Badges | 6px | `rounded-md` |
| Inputs, Selects | 6px | `rounded-md` |
| Status-Dots | voll | `rounded-full` |
| Avatare | voll | `rounded-full` |
| Modals, Dialoge | 12px | `rounded-xl` |

## 5. Karten & Widgets

### KPI-Karten (Dashboard-Kacheln)
- Hoehe: **kompakt** — max 2 Grid-Rows (160px bei rowHeight=80)
- Layout: Label oben-links, Icon oben-rechts, Wert + Subtext unten
- Wert-Format: Kurz und praegnant
  - Kosten im Cent-Bereich: `"0,10 €"` (NIEMALS `"0 €"` bei Wert > 0)
  - Kosten ab 1 Euro: `"1,50 €"` (2 Dezimalstellen)
  - Kosten ab 100 Euro: `"150 €"` (keine Dezimalstellen)
  - Zahlen: direkt, keine fuehrenden Nullen
- Subtext: Kurzer Kontext unter dem Wert, `text-[11px] text-muted-foreground`
- Klickbar: Hover-Border `border-[hsl(var(--accent-orange))]/30`

### Widget-Karten
- Header: Drag-Handle + Titel + Close-Button
- Content: Scrollbar innerhalb, nie Overflow
- Rahmen: `border border-border`
- Hintergrund: `bg-card`

## 6. Overlay-Panels & Modals

### SidePanel (Task-Details, Agent-Details)
- Position: `fixed inset-y-0 right-0`
- Breite: `w-[520px] max-w-[calc(100vw-4rem)]`
- Z-Index: Backdrop `z-40`, Panel `z-50`
- Backdrop: `bg-black/30`
- Schliessung: Klick auf Backdrop ODER Escape-Taste
- REGEL: Task-Detail-Panels muessen IMMER als Overlay rendern, NIEMALS inline

### Popup-Dialoge (Info-Popups, Quick-Views)
- Position: `fixed`, zentriert oder neben Trigger
- Z-Index: `z-50`
- Backdrop: `bg-black/50`
- Breite: `max-w-md` (448px)
- Rundung: `rounded-xl`
- Shadow: `shadow-2xl`
- Animation: Fade-in + Scale (150ms ease-out)

### Dropdown-Menus
- VERBOT: Keine nativen `<select>` Elemente verwenden
- STANDARD: Custom-Dropdown im Stil der Projekt-Status-Auswahl:
  - Trigger: Inline-Element mit ChevronDown Icon
  - Panel: `absolute z-50`, `rounded-lg border border-border bg-card shadow-xl`
  - Items: `px-2.5 py-1.5 text-xs`, Hover `bg-secondary/50`
  - Aktives Item: `bg-accent/50 text-accent-foreground`
  - Optional: Farbiger Dot vor dem Label (Status-Dots)
  - Header im Panel: `text-[10px] font-medium uppercase text-muted-foreground`
- Schliessung: Click-Outside, Escape, Item-Auswahl

## 7. Interaktive Elemente

### Buttons
| Variante | Klasse |
|----------|--------|
| Primaer | `bg-[hsl(var(--accent-orange))] text-white hover:bg-[hsl(var(--accent-orange))]/90` |
| Sekundaer | `bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground` |
| Ghost | `text-muted-foreground hover:text-foreground hover:bg-secondary/50` |
| Destruktiv | `bg-red-500/10 text-red-400 hover:bg-red-500/20` |

### Status-Badges
- Rundung: `rounded-md`
- Padding: `px-2 py-0.5`
- Font: `text-[10px] font-medium`
- Hintergrund: Statusfarbe mit 10-20% Opacity

## 8. Konsistenz-Regeln

1. **Einheitliche Task-Ansicht**: Alle Task-Detail-Panels (Board, Timeline, Suche, etc.) verwenden dasselbe `<TaskDetail>` in einem `<SidePanel>` Overlay
2. **Einheitliches Dropdown-Design**: Alle Auswahlelemente nutzen Custom-Dropdowns, NIE native `<select>`
3. **Einheitliche Farben**: Status-Farben sind global definiert und werden NICHT pro Komponente neu festgelegt
4. **Einheitliche Abstande**: Karten-Padding ist immer `p-3`, nie `p-4` bei KPI-Karten
5. **Einheitliche Schrift**: Labels sind IMMER `text-xs font-medium uppercase text-muted-foreground`
6. **Waehrungsformatierung**: IMMER `toLocaleString("de-DE", { style: "currency", currency: "EUR" })` oder manuelles Komma-Format mit korrekter Praezision
7. **Hover-States**: Immer subtil — Border-Highlight oder Background-Shift, nie volle Farbwechsel

## 9. Responsive Verhalten

- Dashboard: 12-Spalten-Grid, Widgets umbrechen automatisch
- Minimum Viewport: 1024px (Desktop-first, kein Mobile-Support)
- SidePanel: `max-w-[calc(100vw-4rem)]` verhindert Overflow auf kleinen Screens

## 10. Animationen

| Typ | Dauer | Easing |
|-----|-------|--------|
| Hover-Transitions | 150ms | `ease` (default) |
| Panel/Modal Open | 200ms | `ease-out` |
| Layout-Aenderungen | 200ms | `ease` |
| Loading-Spinner | continuous | `animate-spin` |
