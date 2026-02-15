WRITING_SYSTEM_PROMPT = """Du bist ein erfahrener Writing Agent im Pegasus-System.
Deine Aufgabe ist es, hochwertige Texte, Dokumente und Berichte zu erstellen.

Richtlinien:
- Schreibe klar, praezise und gut strukturiert
- Verwende Markdown-Formatierung
- Passe den Schreibstil an den Kontext an (formell/informell)
- Antworte immer auf Deutsch
- Achte auf korrekte Rechtschreibung und Grammatik
- Strukturiere mit Ueberschriften, Listen und Absaetzen
- Wenn Kontext fehlt, kennzeichne dies und mache sinnvolle Annahmen"""

STEP_ANALYZE = """Analysiere die folgende Schreibaufgabe und identifiziere:
1. Was genau geschrieben werden soll (Texttyp, Umfang)
2. Zielgruppe und Tonalitaet
3. Kernaussagen und Struktur

Aufgabe: {title}
Beschreibung: {description}
{criteria_section}
{context_section}

Erstelle eine kurze Analyse mit Gliederungsvorschlag."""

STEP_CONTEXT = """Lies den Projekt-Kontext um die Schreibaufgabe besser einordnen zu koennen.
Nutze das read_project_context Tool um Informationen zum Projekt zu laden.
Nutze auch die Knowledge Base falls vorhanden."""

STEP_OUTLINE = """Basierend auf der Analyse, erstelle eine detaillierte Gliederung.

Analyse:
{analysis}

Erstelle:
1. Eine klare Gliederung mit Ueberschriften und Unterpunkten
2. Fuer jeden Abschnitt: Kernpunkte und ungefaehren Umfang
3. Ueberlegungen zu Stil und Ton"""

STEP_DRAFT = """Schreibe den Text basierend auf der folgenden Gliederung.

Aufgabe: {title}
Gliederung: {outline}
Kontext: {context}

Schreibe einen vollstaendigen, gut strukturierten Text in Markdown.
Achte auf:
- Klare Struktur mit Ueberschriften
- Praezise, verstaendliche Sprache
- Logischen Aufbau und roten Faden
- Angemessene Laenge fuer die Aufgabe"""

STEP_REVIEW = """Ueberarbeite den folgenden Entwurf kritisch.

Aufgabe: {title}
{criteria_section}

Entwurf:
{draft}

Pruefe:
1. Ist der Text vollstaendig und beantwortet alle Aspekte der Aufgabe?
2. Ist die Struktur logisch und klar?
3. Gibt es Wiederholungen oder Luecken?
4. Ist der Stil angemessen und konsistent?

Erstelle eine verbesserte Version des Textes."""
