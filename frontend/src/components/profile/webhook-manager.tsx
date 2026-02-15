"use client";

import { useState } from "react";
import {
  Check,
  Copy,
  Globe,
  Loader2,
  Plus,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWebhooks, useWebhookDeliveries } from "@/hooks/use-webhooks";
import type { Webhook } from "@/types";

const EVENTS = [
  { key: "task.created", label: "Task erstellt" },
  { key: "task.status_changed", label: "Task Status geändert" },
  { key: "task.completed", label: "Task abgeschlossen" },
  { key: "agent.completed", label: "Agent fertig" },
  { key: "approval.needed", label: "Genehmigung nötig" },
  { key: "approval.resolved", label: "Genehmigung bearbeitet" },
  { key: "comment.created", label: "Kommentar erstellt" },
];

function DeliveryLog({ webhookId }: { webhookId: string }) {
  const { deliveries, isLoading } = useWebhookDeliveries(webhookId);

  if (isLoading) return <p className="text-xs text-muted-foreground">Lade...</p>;
  if (deliveries.length === 0) return <p className="text-xs text-muted-foreground">Keine Zustellungen</p>;

  return (
    <div className="max-h-40 overflow-y-auto space-y-1">
      {deliveries.slice(0, 10).map((d) => (
        <div key={d.id} className="flex items-center gap-2 text-xs">
          <span className={d.status_code && d.status_code < 300 ? "text-green-400" : "text-red-400"}>
            {d.status_code ?? "ERR"}
          </span>
          <span className="text-muted-foreground">{d.event_type}</span>
          <span className="text-[10px] text-muted-foreground/60">#{d.attempt}</span>
          {d.error_message && (
            <span className="truncate text-[10px] text-red-400/60">{d.error_message}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function WebhookCard({ webhook, onDelete, onTest, onToggle }: {
  webhook: Webhook;
  onDelete: () => void;
  onTest: () => void;
  onToggle: () => void;
}) {
  const [showDeliveries, setShowDeliveries] = useState(false);
  const [copied, setCopied] = useState(false);

  const copySecret = () => {
    navigator.clipboard.writeText(webhook.secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg border border-border p-3 space-y-2">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">{webhook.name}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
              webhook.is_active ? "bg-green-500/10 text-green-400" : "bg-secondary text-muted-foreground"
            }`}>
              {webhook.is_active ? "Aktiv" : "Inaktiv"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-sm">{webhook.url}</p>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onTest}>
            <Send className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggle}>
            {webhook.is_active ? <X className="h-3 w-3" /> : <Check className="h-3 w-3" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDelete}>
            <Trash2 className="h-3 w-3 text-destructive" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {webhook.events.split(",").filter(Boolean).map((e) => (
          <span key={e} className="rounded-full bg-secondary px-2 py-0.5 text-[10px]">
            {EVENTS.find((ev) => ev.key === e.trim())?.label ?? e.trim()}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <span>Secret:</span>
        <code className="bg-secondary px-1.5 py-0.5 rounded text-[10px]">
          {webhook.secret.substring(0, 12)}...
        </code>
        <button onClick={copySecret} className="hover:text-foreground">
          {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
        </button>
      </div>

      <button
        onClick={() => setShowDeliveries(!showDeliveries)}
        className="text-[11px] text-muted-foreground hover:text-foreground"
      >
        {showDeliveries ? "Zustellungen verbergen" : "Zustellungen anzeigen"}
      </button>
      {showDeliveries && <DeliveryLog webhookId={webhook.id} />}
    </div>
  );
}

export function WebhookManager() {
  const { webhooks, isLoading, create, remove, test, update } = useWebhooks();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);

  const handleCreate = async () => {
    if (!name || !url) return;
    await create(name, url, selectedEvents.join(","));
    setName("");
    setUrl("");
    setSelectedEvents([]);
    setShowCreate(false);
  };

  const toggleEvent = (key: string) => {
    setSelectedEvents((prev) =>
      prev.includes(key) ? prev.filter((e) => e !== key) : [...prev, key]
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Webhooks</h3>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowCreate(!showCreate)}>
          <Plus className="h-3 w-3" />
          Webhook erstellen
        </Button>
      </div>

      {showCreate && (
        <div className="rounded-lg border border-border p-3 space-y-3">
          <input
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded border border-border bg-secondary px-3 py-1.5 text-sm"
          />
          <input
            placeholder="URL (https://...)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full rounded border border-border bg-secondary px-3 py-1.5 text-sm"
          />
          <div className="flex flex-wrap gap-1.5">
            {EVENTS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => toggleEvent(key)}
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                  selectedEvents.includes(key)
                    ? "bg-[hsl(var(--accent-orange))] text-white"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate}>Erstellen</Button>
            <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>Abbrechen</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : webhooks.length === 0 ? (
        <p className="text-center py-4 text-xs text-muted-foreground">
          Noch keine Webhooks konfiguriert.
        </p>
      ) : (
        <div className="space-y-3">
          {webhooks.map((w) => (
            <WebhookCard
              key={w.id}
              webhook={w}
              onDelete={() => remove(w.id)}
              onTest={() => test(w.id)}
              onToggle={() => update(w.id, { is_active: !w.is_active })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
