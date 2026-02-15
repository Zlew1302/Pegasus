RESEARCH_SYSTEM_PROMPT = """Du bist ein erfahrener Research Agent im Pegasus-System.
Deine Aufgabe ist es, gruendliche Recherchen durchzufuehren und strukturierte Berichte zu erstellen.

Richtlinien:
- Arbeite systematisch und gruendlich
- Bewerte Quellen kritisch
- Strukturiere Ergebnisse klar in Markdown
- Antworte immer auf Deutsch
- Sei praezise und faktenbasiert
- Nutze klare Ueberschriften und Aufzaehlungen
- Belege Behauptungen mit Quellen wenn moeglich
- Wenn du unsicher bist, kennzeichne dies explizit"""

STEP_ANALYZE = """Analysiere die folgende Aufgabe und identifiziere die Kernfragen, die beantwortet werden muessen.

Aufgabe: {title}
Beschreibung: {description}
{criteria_section}
{context_section}

Erstelle eine strukturierte Liste der Kernfragen und Teilaspekte die recherchiert werden muessen.
Priorisiere die Fragen nach Wichtigkeit."""

STEP_PLAN = """Basierend auf der folgenden Analyse, entwickle eine Suchstrategie.

Analyse:
{analysis}

Erstelle:
1. 3-5 konkrete Suchbegriffe/Themen die recherchiert werden sollen
2. Fuer jeden Suchbegriff: Was genau suchen wir? Welche Art von Quellen?
3. Eine sinnvolle Reihenfolge der Recherche"""

STEP_CONTEXT = """Lies den Projekt-Kontext um die Aufgabe besser einordnen zu koennen.
Nutze das read_project_context Tool um Informationen zum Projekt zu laden."""

STEP_RESEARCH = """Fuehre eine gruendliche Recherche zu den folgenden Themen durch.
Nutze das web_search Tool um aktuelle Informationen aus dem Internet zu finden.
Fuehre mehrere Suchen zu verschiedenen Aspekten durch.

Suchstrategie:
{search_plan}

Aufgabe: {title}

Fuer jedes Thema:
- Nutze web_search um relevante Informationen zu finden
- Sammle relevante Fakten, Daten und Erkenntnisse
- Notiere die URLs der gefundenen Quellen
- Bewerte die Zuverlaessigkeit der Informationen
- Markiere Unsicherheiten oder Wissenluecken"""

STEP_SYNTHESIZE = """Bewerte und fasse die folgenden Recherche-Ergebnisse zusammen.

Recherche-Ergebnisse:
{research_results}

Aufgabe: {title}
{criteria_section}

Erstelle eine Synthese die:
1. Die wichtigsten Erkenntnisse hervorhebt
2. Widersprueche oder Unsicherheiten benennt
3. Zusammenhaenge zwischen den Themen aufzeigt
4. Eine klare Bewertung abgibt"""

STEP_REPORT = """Erstelle einen strukturierten Forschungsbericht in Markdown.

Aufgabe: {title}
Beschreibung: {description}
Synthese: {synthesis}

Der Bericht MUSS folgende Abschnitte enthalten:

## Zusammenfassung
(2-3 Saetze die das Kernergebnis zusammenfassen)

## Kernerkenntnisse
(Die 3-5 wichtigsten Findings als Bullet Points)

## Detaillierte Ergebnisse
(Ausfuehrliche Darstellung, strukturiert nach Themen)

## Bewertung & Einordnung
(Kritische Bewertung, Staerken/Schwaechen der Ergebnisse)

## Empfehlungen
(Konkrete, umsetzbare Empfehlungen basierend auf den Ergebnissen)

## Quellen & Methodik
(Transparenz ueber die genutzten Quellen und die Recherche-Methodik)"""
