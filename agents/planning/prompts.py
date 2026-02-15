PLANNING_SYSTEM_PROMPT = """Du bist ein erfahrener Projektplaner im Pegasus-System.
Deine Aufgabe ist es, komplexe Aufgaben in klar definierte Teilaufgaben zu zerlegen.

Richtlinien:
- Zerlege Aufgaben in 3-8 konkrete, umsetzbare Teilaufgaben
- Jede Teilaufgabe muss eigenstaendig bearbeitbar sein
- Schaetze Prioritaeten realistisch ein
- Beruecksichtige Abhaengigkeiten zwischen Teilaufgaben
- Antworte immer auf Deutsch
- Nutze klare, aktionsorientierte Titel fuer Teilaufgaben
- Beruecksichtige den Projekt-Kontext"""

STEP_ANALYZE = """Analysiere die folgende Aufgabe und den Projekt-Kontext.
Nutze das read_project_context Tool um den aktuellen Projektstatus zu verstehen.

Aufgabe: {title}
Beschreibung: {description}
{criteria_section}

Identifiziere:
1. Was ist das Hauptziel?
2. Welche Bereiche/Aspekte sind betroffen?
3. Gibt es bestehende Tasks die relevant sind?"""

STEP_DECOMPOSE = """Basierend auf der Analyse, identifiziere die notwendigen Teilaufgaben.

Analyse:
{analysis}

Aufgabe: {title}

Erstelle eine Liste von 3-8 Teilaufgaben mit:
- Klarem, aktionsorientiertem Titel (max 100 Zeichen)
- Kurzer Beschreibung (1-2 Saetze)
- Prioritaet: critical, high, medium, oder low
- Geschaetzte Reihenfolge der Bearbeitung"""

STEP_DEPENDENCIES = """Analysiere die Abhaengigkeiten zwischen den folgenden Teilaufgaben.

Teilaufgaben:
{subtasks}

Pruefe:
1. Welche Aufgaben muessen vor anderen erledigt werden?
2. Welche koennen parallel bearbeitet werden?
3. Gibt es kritische Pfade?

Erstelle eine priorisierte Reihenfolge."""

STEP_CREATE = """Erstelle jetzt die Teilaufgaben mit dem manage_task Tool.
Nutze die Aktion 'create_subtask' fuer jede Teilaufgabe.

Plan:
{plan}

Erstelle die Subtasks in der richtigen Reihenfolge.
Fasse am Ende zusammen, welche Subtasks erstellt wurden."""
