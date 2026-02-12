"""GitHub integration tool — search repos, list issues/PRs, read files."""

import logging
from typing import Any

import httpx

from agents.tools.base import BaseTool, ToolContext
from app.config import settings

logger = logging.getLogger(__name__)

API_BASE = "https://api.github.com"


class GitHubTool(BaseTool):
    name = "github"
    description = (
        "Interagiert mit GitHub: Repositories suchen, Issues/PRs auflisten, "
        "Dateien lesen, Repo-Infos abrufen. Benoetigt einen GITHUB_TOKEN in der Konfiguration."
    )

    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": [
                        "search_repos",
                        "list_issues",
                        "list_prs",
                        "get_issue",
                        "get_file",
                        "get_repo_info",
                    ],
                    "description": "Die auszufuehrende GitHub-Aktion",
                },
                "query": {
                    "type": "string",
                    "description": "Suchbegriff (fuer search_repos)",
                },
                "owner": {
                    "type": "string",
                    "description": "Repository-Besitzer (z.B. 'facebook')",
                },
                "repo": {
                    "type": "string",
                    "description": "Repository-Name (z.B. 'react')",
                },
                "number": {
                    "type": "integer",
                    "description": "Issue- oder PR-Nummer",
                },
                "path": {
                    "type": "string",
                    "description": "Dateipfad im Repository (fuer get_file)",
                },
                "state": {
                    "type": "string",
                    "enum": ["open", "closed", "all"],
                    "description": "Filter nach Status (default: open)",
                    "default": "open",
                },
                "count": {
                    "type": "integer",
                    "description": "Anzahl der Ergebnisse (1-10, default: 5)",
                    "default": 5,
                },
            },
            "required": ["action"],
        }

    async def execute(self, parameters: dict[str, Any], context: ToolContext) -> str:
        action = parameters.get("action", "")
        token = settings.GITHUB_TOKEN

        if not token:
            return (
                "Kein GitHub-Token konfiguriert. "
                "Bitte GITHUB_TOKEN in der .env-Datei setzen. "
                "Nutze dein internes Wissen um die Frage zu beantworten."
            )

        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }

        try:
            async with httpx.AsyncClient(
                base_url=API_BASE, headers=headers, timeout=15.0
            ) as client:
                if action == "search_repos":
                    return await self._search_repos(client, parameters)
                elif action == "list_issues":
                    return await self._list_issues(client, parameters)
                elif action == "list_prs":
                    return await self._list_prs(client, parameters)
                elif action == "get_issue":
                    return await self._get_issue(client, parameters)
                elif action == "get_file":
                    return await self._get_file(client, parameters)
                elif action == "get_repo_info":
                    return await self._get_repo_info(client, parameters)
                else:
                    return f"Unbekannte Aktion: {action}"
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return "Nicht gefunden (404). Pruefe Owner/Repo/Pfad."
            if e.response.status_code == 403:
                return "Zugriff verweigert (403). Pruefe den GitHub-Token und Rate-Limits."
            return f"GitHub API Fehler: {e.response.status_code} — {e.response.text[:500]}"
        except httpx.HTTPError as e:
            return f"Netzwerkfehler bei GitHub-Anfrage: {str(e)}"

    # ── Actions ──────────────────────────────────────────────────

    async def _search_repos(
        self, client: httpx.AsyncClient, params: dict[str, Any]
    ) -> str:
        query = params.get("query", "")
        count = min(params.get("count", 5), 10)
        if not query:
            return "Fehler: Kein Suchbegriff angegeben."

        resp = await client.get(
            "/search/repositories",
            params={"q": query, "per_page": count, "sort": "stars"},
        )
        resp.raise_for_status()
        items = resp.json().get("items", [])

        if not items:
            return f"Keine Repositories fuer '{query}' gefunden."

        lines = [f"## GitHub-Suche: {query}\n"]
        for i, repo in enumerate(items, 1):
            lines.append(f"### {i}. {repo['full_name']}")
            lines.append(f"- Beschreibung: {repo.get('description') or '–'}")
            lines.append(f"- Sterne: {repo['stargazers_count']:,}")
            lines.append(f"- Sprache: {repo.get('language') or '–'}")
            lines.append(f"- URL: {repo['html_url']}")
            lines.append("")
        return "\n".join(lines)

    async def _list_issues(
        self, client: httpx.AsyncClient, params: dict[str, Any]
    ) -> str:
        owner = params.get("owner", "")
        repo = params.get("repo", "")
        if not owner or not repo:
            return "Fehler: 'owner' und 'repo' sind erforderlich."

        state = params.get("state", "open")
        count = min(params.get("count", 5), 10)

        resp = await client.get(
            f"/repos/{owner}/{repo}/issues",
            params={"state": state, "per_page": count, "sort": "updated"},
        )
        resp.raise_for_status()
        issues = [i for i in resp.json() if "pull_request" not in i]

        if not issues:
            return f"Keine Issues ({state}) in {owner}/{repo} gefunden."

        lines = [f"## Issues in {owner}/{repo} (Status: {state})\n"]
        for issue in issues[:count]:
            labels = ", ".join(l["name"] for l in issue.get("labels", []))
            lines.append(f"### #{issue['number']}: {issue['title']}")
            lines.append(f"- Status: {issue['state']}")
            if labels:
                lines.append(f"- Labels: {labels}")
            lines.append(f"- Erstellt: {issue['created_at'][:10]}")
            lines.append(f"- URL: {issue['html_url']}")
            lines.append("")
        return "\n".join(lines)

    async def _list_prs(
        self, client: httpx.AsyncClient, params: dict[str, Any]
    ) -> str:
        owner = params.get("owner", "")
        repo = params.get("repo", "")
        if not owner or not repo:
            return "Fehler: 'owner' und 'repo' sind erforderlich."

        state = params.get("state", "open")
        count = min(params.get("count", 5), 10)

        resp = await client.get(
            f"/repos/{owner}/{repo}/pulls",
            params={"state": state, "per_page": count, "sort": "updated"},
        )
        resp.raise_for_status()
        prs = resp.json()

        if not prs:
            return f"Keine Pull Requests ({state}) in {owner}/{repo} gefunden."

        lines = [f"## Pull Requests in {owner}/{repo} (Status: {state})\n"]
        for pr in prs[:count]:
            labels = ", ".join(l["name"] for l in pr.get("labels", []))
            lines.append(f"### #{pr['number']}: {pr['title']}")
            lines.append(f"- Status: {pr['state']}")
            lines.append(f"- Branch: {pr['head']['ref']} → {pr['base']['ref']}")
            if labels:
                lines.append(f"- Labels: {labels}")
            lines.append(f"- Erstellt: {pr['created_at'][:10]}")
            lines.append(f"- URL: {pr['html_url']}")
            lines.append("")
        return "\n".join(lines)

    async def _get_issue(
        self, client: httpx.AsyncClient, params: dict[str, Any]
    ) -> str:
        owner = params.get("owner", "")
        repo = params.get("repo", "")
        number = params.get("number")
        if not owner or not repo or not number:
            return "Fehler: 'owner', 'repo' und 'number' sind erforderlich."

        resp = await client.get(f"/repos/{owner}/{repo}/issues/{number}")
        resp.raise_for_status()
        issue = resp.json()

        is_pr = "pull_request" in issue
        kind = "Pull Request" if is_pr else "Issue"
        labels = ", ".join(l["name"] for l in issue.get("labels", []))

        lines = [f"## {kind} #{issue['number']}: {issue['title']}\n"]
        lines.append(f"- Status: {issue['state']}")
        if labels:
            lines.append(f"- Labels: {labels}")
        lines.append(f"- Erstellt von: {issue['user']['login']}")
        lines.append(f"- Erstellt: {issue['created_at'][:10]}")
        if issue.get("closed_at"):
            lines.append(f"- Geschlossen: {issue['closed_at'][:10]}")
        lines.append(f"- URL: {issue['html_url']}")
        lines.append("")

        body = issue.get("body") or ""
        if body:
            # Truncate long bodies
            if len(body) > 3000:
                body = body[:3000] + "\n\n... (gekuerzt)"
            lines.append("### Beschreibung\n")
            lines.append(body)

        return "\n".join(lines)

    async def _get_file(
        self, client: httpx.AsyncClient, params: dict[str, Any]
    ) -> str:
        owner = params.get("owner", "")
        repo = params.get("repo", "")
        path = params.get("path", "")
        if not owner or not repo or not path:
            return "Fehler: 'owner', 'repo' und 'path' sind erforderlich."

        resp = await client.get(f"/repos/{owner}/{repo}/contents/{path}")
        resp.raise_for_status()
        data = resp.json()

        if isinstance(data, list):
            # Directory listing
            lines = [f"## Verzeichnis: {owner}/{repo}/{path}\n"]
            for item in data:
                icon = "📁" if item["type"] == "dir" else "📄"
                lines.append(f"- {icon} {item['name']}")
            return "\n".join(lines)

        # Single file
        import base64

        if data.get("encoding") == "base64" and data.get("content"):
            content = base64.b64decode(data["content"]).decode("utf-8", errors="replace")
            if len(content) > 5000:
                content = content[:5000] + "\n\n... (gekuerzt, Gesamtgroesse: {})".format(
                    data.get("size", "?")
                )
            return f"## Datei: {path}\n\n```\n{content}\n```"
        else:
            return f"Datei: {path} (Groesse: {data.get('size', '?')} Bytes, nicht dekodierbar)"

    async def _get_repo_info(
        self, client: httpx.AsyncClient, params: dict[str, Any]
    ) -> str:
        owner = params.get("owner", "")
        repo = params.get("repo", "")
        if not owner or not repo:
            return "Fehler: 'owner' und 'repo' sind erforderlich."

        resp = await client.get(f"/repos/{owner}/{repo}")
        resp.raise_for_status()
        r = resp.json()

        lines = [f"## Repository: {r['full_name']}\n"]
        lines.append(f"- Beschreibung: {r.get('description') or '–'}")
        lines.append(f"- Sprache: {r.get('language') or '–'}")
        lines.append(f"- Sterne: {r['stargazers_count']:,}")
        lines.append(f"- Forks: {r['forks_count']:,}")
        lines.append(f"- Offen Issues: {r['open_issues_count']:,}")
        lines.append(f"- Default Branch: {r['default_branch']}")
        lines.append(f"- Lizenz: {r.get('license', {}).get('name') or '–'}")
        lines.append(f"- Erstellt: {r['created_at'][:10]}")
        lines.append(f"- Letztes Update: {r['updated_at'][:10]}")
        lines.append(f"- URL: {r['html_url']}")

        if r.get("topics"):
            lines.append(f"- Topics: {', '.join(r['topics'])}")

        return "\n".join(lines)
