"""Spotlight AI chat service — lightweight Claude + tools for the command palette."""

import json
import time
from datetime import datetime, UTC
from typing import Any, AsyncGenerator

from anthropic import AsyncAnthropic, RateLimitError, APIStatusError

from app.config import settings
from app.database import async_session
from app.sse.manager import SSEEvent
from agents.tools.spotlight import SPOTLIGHT_TOOLS, SpotlightToolContext


SYSTEM_PROMPT_TEMPLATE = """Du bist der Pegasus AI-Assistent — ein intelligenter Helfer, der in einem Projektmanagement-Tool integriert ist.

## Deine Faehigkeiten
- **Navigation**: Oeffne Seiten, Projekte, Tasks, Dokumente
- **Suche**: Finde Tasks, Projekte und Agenten nach verschiedenen Kriterien
- **Statistiken**: Beantworte Fragen zu Task-Status, Projektfortschritt, Agent-Aktivitaet
- **Erstellen**: Lege neue Projekte und Tasks an
- **Aktualisieren**: Aendere Task-Status, Prioritaet oder Beschreibung
- **Agent starten**: Starte Research- oder Planning-Agenten fuer komplexe Aufgaben
- **Wissensbasis**: Durchsuche hochgeladene Dokumente nach relevanten Informationen

## Aktueller Kontext
- **Seite**: {current_path}
- **Seitentyp**: {page_type}
{entity_context}

## Regeln
1. Antworte immer auf Deutsch
2. Sei kurz und praezise — du bist ein Spotlight-Assistent, kein Chatbot
3. Nutze die verfuegbaren Tools aktiv um Fragen zu beantworten
4. Bei Navigations-Anfragen: Nutze das navigate-Tool
5. Bei Daten-Fragen: Nutze search_data oder query_stats
6. Bei Erstellungs-Anfragen: Nutze create_project oder create_task
7. Bei Agent-Anfragen (Recherche, Analyse, Planung): Nutze spawn_agent
8. Bei Wissens-Fragen oder Dokumenten-Referenzen: Nutze search_knowledge
9. Wenn ein Tool ein Ergebnis mit "ACTION:" zurueckgibt, erklaere die durchgefuehrte Aktion dem User
10. Gib bei Antworten aus der Wissensbasis immer die Quelle (Dokumenttitel) an
11. Formatiere Antworten kompakt mit Markdown
"""


def _build_system_prompt(context: dict) -> str:
    """Build system prompt with page context."""
    current_path = context.get("current_path", "/")
    page_type = context.get("current_page_type", "unbekannt")
    entity_id = context.get("current_entity_id")
    entity_title = context.get("current_entity_title")

    entity_context = ""
    if entity_id:
        entity_context = f"- **Aktuelle Entitaet**: {entity_title or entity_id} (ID: {entity_id})"

    return SYSTEM_PROMPT_TEMPLATE.format(
        current_path=current_path,
        page_type=page_type,
        entity_context=entity_context,
    )


def _build_messages(history: list[dict], user_message: str) -> list[dict]:
    """Build Claude messages array from conversation history."""
    messages = []
    for msg in history[-18:]:  # Keep last 18 messages (9 turns) from history
        messages.append({
            "role": msg["role"],
            "content": msg["content"],
        })
    messages.append({"role": "user", "content": user_message})
    return messages


async def chat_stream(
    message: str,
    context: dict,
    history: list[dict],
    session_id: str,
) -> AsyncGenerator[SSEEvent, None]:
    """Stream a Spotlight chat response with tool use support.

    Yields SSEEvent objects that the router converts to SSE format.
    """
    client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

    # Build tool context
    tool_context = SpotlightToolContext(
        session_factory=async_session,
        session_id=session_id,
        current_path=context.get("current_path", "/"),
        current_entity_id=context.get("current_entity_id"),
    )

    # Build tool definitions
    tool_defs = [t.to_anthropic_format() for t in SPOTLIGHT_TOOLS]
    tool_map = {t.name: t for t in SPOTLIGHT_TOOLS}

    # Build messages and system prompt
    system_prompt = _build_system_prompt(context)
    messages = _build_messages(history, message)

    # Agentic tool-use loop
    max_iterations = 6
    full_response = ""

    for iteration in range(max_iterations):
        try:
            response = await client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=2048,
                system=system_prompt,
                messages=messages,
                tools=tool_defs,
            )
        except RateLimitError:
            yield SSEEvent(event="error", data={"message": "Rate-Limit erreicht. Bitte warte kurz."})
            return
        except APIStatusError as e:
            if "credit balance" in str(e.message).lower():
                yield SSEEvent(event="error", data={"message": "Kein API-Guthaben. Bitte lade Credits auf: https://console.anthropic.com/settings/billing"})
            else:
                yield SSEEvent(event="error", data={"message": f"API-Fehler ({e.status_code}): {e.message}"})
            return
        except Exception as e:
            yield SSEEvent(event="error", data={"message": f"Fehler: {str(e)}"})
            return

        # Process response blocks
        tool_uses = [b for b in response.content if b.type == "tool_use"]
        text_blocks = [b for b in response.content if b.type == "text"]

        # Stream text blocks
        for block in text_blocks:
            if block.text:
                full_response += block.text
                yield SSEEvent(event="token", data={"text": block.text})

        if not tool_uses:
            # No tool calls — we're done
            break

        # Process tool calls
        messages.append({"role": "assistant", "content": response.content})
        tool_results = []

        for tool_use in tool_uses:
            tool = tool_map.get(tool_use.name)
            if not tool:
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": tool_use.id,
                    "content": f"Tool '{tool_use.name}' nicht gefunden.",
                    "is_error": True,
                })
                continue

            # Emit tool_call event
            yield SSEEvent(event="tool_call", data={
                "tool_name": tool_use.name,
                "parameters": _safe_serialize(tool_use.input),
            })

            # Execute tool
            try:
                result = await tool.execute(tool_use.input, tool_context)
            except Exception as e:
                result = f"Fehler bei Tool-Ausfuehrung: {str(e)}"

            # Check for action in result
            if "ACTION:" in result:
                action = _parse_action(result)
                if action:
                    yield SSEEvent(event="action", data=action)

            tool_results.append({
                "type": "tool_result",
                "tool_use_id": tool_use.id,
                "content": result[:8000],
            })

        # Add tool results for next iteration
        messages.append({"role": "user", "content": tool_results})

    # Final done event
    yield SSEEvent(event="done", data={
        "content": full_response,
    })


def _parse_action(result: str) -> dict | None:
    """Parse ACTION:type:id|label from tool results."""
    for line in result.split("\n"):
        line = line.strip()
        if line.startswith("ACTION:"):
            try:
                rest = line[7:]  # Remove "ACTION:"
                parts = rest.split("|", 1)
                type_and_id = parts[0]
                label = parts[1] if len(parts) > 1 else ""

                type_parts = type_and_id.split(":", 1)
                action_type = type_parts[0]
                entity_or_path = type_parts[1] if len(type_parts) > 1 else ""

                action: dict[str, Any] = {
                    "type": action_type,
                    "label": label,
                }

                if action_type == "navigate":
                    action["path"] = entity_or_path
                else:
                    action["entityId"] = entity_or_path

                return action
            except (IndexError, ValueError):
                continue
    return None


def _safe_serialize(obj: Any) -> Any:
    """Safely serialize tool parameters for SSE events."""
    try:
        json.dumps(obj)
        return obj
    except (TypeError, ValueError):
        return str(obj)
