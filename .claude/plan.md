# Phase E: Real Agent Execution

## Analyse

Das Agent-System ist bereits erstaunlich vollstaendig:
- `BaseAgent` macht echte `AsyncAnthropic()` Calls mit Streaming und Tool-Use-Loop
- `ResearchAgent` (6 Steps) und `PlanningAgent` (4 Steps) sind komplett implementiert
- SSE-Streaming, Cost-Tracking, Thought-Log, Retry-Logic — alles da
- Frontend: AgentLiveView, ExecutionSteps, SpawnDialog, Suggestions — alles da

**Was FEHLT fuer echte Ausfuehrung:**

1. **`.env` Datei** — Es gibt nur `.env.example`, keine echte `.env` mit API-Key
2. **API-Key Validierung** — Kein Check ob ANTHROPIC_API_KEY gesetzt ist bevor ein Agent spawnt
3. **Error Handling im Frontend** — Wenn der Agent crashed, sieht der User nichts Hilfreiches
4. **Output-Anzeige nach Completion** — Die SSE endet, aber der Output wird nicht automatisch in der Task-Detail geladen
5. **Task-Status nach Agent-Ende** — Task bleibt auf `in_progress` wenn Agent failed
6. **Cost-Display** — Die Kosten werden getrackt aber nirgends prominent angezeigt
7. **Brave Search API Key** — Ohne Key nutzt der Agent internes Wissen (fallback existiert)
8. **Agent-Output Refresh** — SWR-Caches fuer TaskOutput refreshen nicht nach Agent-Completion
9. **Markdown-Rendering** — TaskOutput rendert Markdown, aber Styling fuer Dark Mode ist schwach

## Plan (8 Schritte)

### Schritt 1: `.env` Setup + API-Key Guard
- `.env` anlegen mit Platzhalter/Hinweis fuer ANTHROPIC_API_KEY
- `BRAVE_API_KEY` optional dazulegen
- Im Spawn-Endpoint (`agents.py`): Check ob `settings.ANTHROPIC_API_KEY` gesetzt ist, sonst HTTP 503 mit klarer Fehlermeldung
- `.env` zu `.gitignore` hinzufuegen (falls nicht schon drin)

### Schritt 2: Agent Error Resilience
- `base.py` `execute()`: Bei Exception den Task-Status auf `review` statt nur Agent auf `failed` setzen
- Thought-Log bei Fehler flushen (damit man sehen kann wo es crashed)
- `agent_service.py` `start_agent()`: Try/Except wrapper mit besserem Logging
- Emit `error` Event mit strukturierter Info (step, message, traceback-summary)

### Schritt 3: Task-Status Synchronisation
- Nach Agent-Completion: Task auf `review` setzen (wenn needs_approval) oder `done` (wenn full_auto)
- Nach Agent-Failure: Task zurueck auf `todo` setzen damit man neu starten kann
- Nach Agent-Cancel: Task zurueck auf `todo`

### Schritt 4: Frontend — Output Auto-Refresh
- `use-agents.ts` `useAgentInstance`: Wenn Status wechselt auf `completed`/`failed` → SWR mutate auf Task-Outputs triggern
- `task-detail.tsx`: Output-Liste automatisch refreshen nach Agent-Ende
- Board-Spalte: Task-Karte refreshen nach Agent-Ende (SWR revalidation)

### Schritt 5: Frontend — Live Output Preview
- `agent-live-view.tsx`: Wenn SSE `output` Event kommt → Markdown-Preview direkt inline anzeigen (collapsed, expandable)
- Kleiner "Ergebnis anzeigen" Button der erscheint sobald Output da ist

### Schritt 6: Frontend — Error & Cost Display
- AgentLiveView: Bei `error` Status → Fehlermeldung mit rotem Banner + letzter Thought anzeigen
- AgentLiveView: Cost-Badge im Header (waehrend + nach Ausfuehrung)
- ExecutionSteps: Summen-Zeile mit Gesamtkosten prominent oben

### Schritt 7: Markdown Styling für Agent Output
- `globals.css`: Prose-Klassen fuer Dark Mode optimieren (Headings, Links, Code-Blocks, Tables)
- TaskOutput: Bessere Markdown-Darstellung mit angepasstem Styling

### Schritt 8: End-to-End Test + Verifikation
- Backend-Tests: Agent-Spawn mit fehlendem API-Key → 503
- Backend-Tests: Task-Status-Sync nach Agent-Completion
- Frontend Build verifizieren
- Gesamte Test-Suite laufen lassen

## Ergebnis
Nach Phase E kann man:
1. Einen API-Key in `.env` eintragen
2. Im Board eine Task oeffnen → "Agent zuweisen" → Research Agent waehlen
3. Live zusehen wie der Agent 6 Schritte durchlaeuft (mit Streaming-Thoughts)
4. Das Ergebnis als Markdown-Bericht sehen
5. Den Bericht genehmigen, ablehnen oder Aenderungen anfordern
6. Kosten pro Ausfuehrung sehen
