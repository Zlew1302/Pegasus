QA_SYSTEM_PROMPT = """Du bist ein erfahrener QA Agent im CrewBoard-System.
Deine Aufgabe ist es, Qualitaetssicherung durchzufuehren: Testfaelle generieren, Ergebnisse analysieren und QA-Reports erstellen.

Richtlinien:
- Arbeite systematisch und gruendlich
- Denke an Edge-Cases und Grenzfaelle
- Strukturiere Testfaelle klar mit ID, Beschreibung, Erwartung
- Bewerte Risiken und priorisiere Tests
- Antworte immer auf Deutsch
- Nutze klare Tabellen und Checklisten
- Kennzeichne kritische Befunde deutlich"""

STEP_CONTEXT = """Lies den Projekt-Kontext um den QA-Scope besser einordnen zu koennen.
Nutze das read_project_context Tool um Informationen zum Projekt und zur Aufgabe zu laden.
Nutze auch die Knowledge Base falls vorhanden."""

STEP_SCOPE = """Analysiere den QA-Scope fuer die folgende Aufgabe.

Aufgabe: {title}
Beschreibung: {description}
{criteria_section}
Projekt-Kontext: {context}

Bestimme:
1. Was genau getestet werden soll
2. Welche Bereiche abgedeckt werden muessen
3. Welche Qualitaetskriterien gelten
4. Welche Risiken bestehen"""

STEP_TESTCASES = """Generiere strukturierte Testfaelle basierend auf der Scope-Analyse.

Scope-Analyse:
{scope}

Aufgabe: {title}
{criteria_section}

Erstelle Testfaelle im Format:
| TC-ID | Beschreibung | Schritte | Erwartetes Ergebnis | Prioritaet |

Beruecksichtige:
- Positive Tests (Normalfall)
- Negative Tests (Fehlerfaelle)
- Edge-Cases (Grenzwerte)
- Integrations-Tests (Zusammenspiel)"""

STEP_EVALUATE = """Bewerte die generierten Testfaelle und erstelle eine Risiko-Analyse.

Testfaelle:
{testcases}

Aufgabe: {title}

Bewerte:
1. Abdeckung: Werden alle Akzeptanzkriterien getestet?
2. Risiken: Welche Bereiche haben das hoechste Ausfallrisiko?
3. Empfehlungen: Wo sollte besonders gruendlich getestet werden?
4. Fehlende Tests: Gibt es Luecken in der Abdeckung?"""

STEP_REPORT = """Erstelle einen QA-Report in Markdown.

Aufgabe: {title}
Beschreibung: {description}
Testfaelle: {testcases}
Bewertung: {evaluation}

Der Report MUSS folgende Abschnitte enthalten:

## QA-Zusammenfassung
(2-3 Saetze zum Gesamt-QA-Status)

## Test-Scope
(Was wurde getestet/analysiert)

## Testfaelle
(Tabelle mit allen Testfaellen)

## Risiko-Analyse
(Identifizierte Risiken und Prioritaeten)

## Empfehlungen
(Konkrete Massnahmen zur Qualitaetssicherung)

## Fazit
(Gesamtbewertung und naechste Schritte)"""
