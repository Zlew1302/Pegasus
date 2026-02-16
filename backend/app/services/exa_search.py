"""Exa.ai search service for planning workflow context enrichment."""

import logging

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.budget import ApiKey

logger = logging.getLogger(__name__)


async def get_exa_api_key(session: AsyncSession) -> str | None:
    """Load Exa API key from the ApiKey model."""
    result = await session.execute(
        select(ApiKey).where(
            ApiKey.provider == "exa",
            ApiKey.is_active == True,  # noqa: E712
        )
    )
    api_key_record = result.scalar_one_or_none()
    if api_key_record:
        return api_key_record.key_encrypted
    return None


async def search_exa(
    topics: list[str],
    api_key: str,
    num_results_per_topic: int = 3,
) -> list[dict]:
    """Search Exa.ai for the given topics and return aggregated results.

    Returns list of dicts with keys: title, url, snippet, score
    """
    if not api_key:
        logger.warning("Kein Exa API-Key konfiguriert")
        return []

    all_results: list[dict] = []
    seen_urls: set[str] = set()

    async with httpx.AsyncClient(timeout=15.0) as client:
        for topic in topics:
            try:
                resp = await client.post(
                    "https://api.exa.ai/search",
                    json={
                        "query": topic,
                        "numResults": num_results_per_topic,
                        "type": "auto",
                        "useAutoprompt": True,
                        "contents": {
                            "text": {"maxCharacters": 1000},
                        },
                    },
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                )
                resp.raise_for_status()
                data = resp.json()

                for result in data.get("results", []):
                    url = result.get("url", "")
                    if url in seen_urls:
                        continue
                    seen_urls.add(url)

                    all_results.append({
                        "title": result.get("title", "Kein Titel"),
                        "url": url,
                        "snippet": result.get("text", "")[:500],
                        "score": result.get("score", 0.0),
                    })

            except httpx.HTTPError as e:
                logger.error("Exa-Suche fehlgeschlagen fuer '%s': %s", topic, str(e))
            except Exception as e:
                logger.error("Unerwarteter Fehler bei Exa-Suche: %s", str(e))

    return all_results


async def auto_generate_search_topics(
    project_title: str,
    project_description: str | None,
    project_goal: str | None,
) -> list[str]:
    """Generate relevant search topics from project context using a simple extraction.

    Falls back to basic keyword extraction if LLM is unavailable.
    """
    topics: list[str] = []

    # Simple keyword-based topic generation
    # Use project title as primary topic
    if project_title:
        topics.append(project_title)

    # Extract key phrases from description
    if project_description:
        # Take first meaningful sentence
        sentences = [s.strip() for s in project_description.split(".") if len(s.strip()) > 10]
        if sentences:
            topics.append(sentences[0][:100])

    # Use goal if available
    if project_goal:
        goals = [g.strip() for g in project_goal.split(".") if len(g.strip()) > 10]
        if goals:
            topics.append(goals[0][:100])

    # Try LLM-based topic generation for better results
    try:
        import anthropic
        from app.config import settings

        if settings.ANTHROPIC_API_KEY:
            client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
            context_parts = [f"Projekt: {project_title}"]
            if project_description:
                context_parts.append(f"Beschreibung: {project_description[:500]}")
            if project_goal:
                context_parts.append(f"Ziel: {project_goal[:300]}")

            message = await client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=200,
                messages=[{
                    "role": "user",
                    "content": (
                        "Generiere genau 3-5 praezise Suchbegriffe (je max 5 Woerter) "
                        "fuer eine Web-Recherche zu diesem Projekt. "
                        "Antworte NUR mit den Suchbegriffen, einer pro Zeile, "
                        "ohne Nummerierung oder Aufzaehlungszeichen.\n\n"
                        + "\n".join(context_parts)
                    ),
                }],
            )
            llm_topics = [
                line.strip()
                for line in message.content[0].text.strip().split("\n")
                if line.strip() and len(line.strip()) > 3
            ]
            if llm_topics:
                topics = llm_topics[:5]

    except Exception as e:
        logger.warning("LLM-basierte Topic-Generierung fehlgeschlagen: %s", str(e))

    return topics[:5]
