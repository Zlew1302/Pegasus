"""System prompts for the OrchestratorAgent."""


def build_orchestrator_system_prompt(
    agent_types_info: str,
    mcp_tools_info: str,
    project_context: str,
) -> str:
    """Baut den vollständigen System-Prompt für den Orchestrator zusammen."""

    base_prompt = """Du bist der KI-Orchestrator im Pegasus-Projektmanagement-System.

Deine Aufgabe ist es, Benutzeranfragen zu analysieren und den besten Ansatz zu finden,
um sie zu erfüllen. Du hast Zugriff auf spezialisierte Sub-Agenten und externe Tools.

## Deine Fähigkeiten

### 1. Direkte Aktionen
- Projektkontext lesen und analysieren
- Wissensbasis durchsuchen
- Web-Recherche durchführen
- Tasks erstellen und verwalten

### 2. Sub-Agent-Delegation
Du kannst spezialisierte Agenten für Teilaufgaben beauftragen. Nutze `delegate_to_agent`
mit `wait_for_result: true` wenn du das Ergebnis brauchst, oder `false` für Hintergrund-Aufgaben.

### 3. Externe Integrationen (MCP)
Falls MCP-Server verbunden sind, kannst du deren Tools direkt nutzen (z.B. GitHub-Issues
erstellen, Figma-Designs abrufen, Slack-Nachrichten senden).

## Arbeitsweise

1. **Analysiere** die Anfrage des Benutzers gründlich
2. **Plane** welche Schritte nötig sind und welche Tools/Agenten am besten geeignet sind
3. **Führe aus** — entweder direkt via Tools oder durch Delegation an Sub-Agenten
4. **Fasse zusammen** — erstelle einen klaren Bericht über das Erreichte

## Wichtige Regeln

- Antworte IMMER auf Deutsch
- Wähle den passendsten Agent für jede Teilaufgabe
- Nutze MCP-Tools wenn sie für die Aufgabe hilfreich sind
- Bei komplexen Aufgaben: zerlege sie in Teilschritte
- Erstelle am Ende eine strukturierte Zusammenfassung in Markdown
- Wenn du Tasks erstellst, ordne sie dem passenden Agent-Typ zu"""

    sections = [base_prompt]

    if agent_types_info:
        sections.append(f"\n\n## Verfügbare Sub-Agenten\n\n{agent_types_info}")

    if mcp_tools_info:
        sections.append(f"\n\n## Verfügbare MCP-Integrationen\n\n{mcp_tools_info}")

    if project_context:
        sections.append(f"\n\n## Projektkontext\n\n{project_context}")

    return "\n".join(sections)


def format_agent_types_info(agent_types: list[dict]) -> str:
    """Formatiere die Agent-Typen-Übersicht für den System-Prompt."""
    if not agent_types:
        return "Keine Sub-Agenten verfügbar."

    lines = []
    for at in agent_types:
        name = at.get("name", "Unbekannt")
        agent_id = at.get("id", "")
        desc = at.get("description", "")
        capabilities = at.get("capabilities", "")

        lines.append(f"### {name} (`{agent_id}`)")
        if desc:
            lines.append(f"  {desc}")
        if capabilities:
            lines.append(f"  Fähigkeiten: {capabilities}")
        lines.append("")

    return "\n".join(lines)


def format_mcp_tools_info(mcp_tools: list[dict]) -> str:
    """Formatiere die MCP-Tool-Übersicht für den System-Prompt."""
    if not mcp_tools:
        return "Keine MCP-Integrationen verbunden."

    lines = []
    current_server = ""

    for tool in mcp_tools:
        server = tool.get("server_name", "Unbekannt")
        if server != current_server:
            if current_server:
                lines.append("")
            lines.append(f"### {server}")
            current_server = server

        name = tool.get("tool_name", "")
        desc = tool.get("description", "")
        lines.append(f"- `{name}`: {desc}")

    return "\n".join(lines)
