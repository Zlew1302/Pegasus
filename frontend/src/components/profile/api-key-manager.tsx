"use client";

import { useState } from "react";
import { Key, Plus, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { useApiKeys } from "@/hooks/use-profile";
import { Button } from "@/components/ui/button";

export function ApiKeyManager() {
  const { apiKeys, createKey, deleteKey, toggleKey } = useApiKeys();
  const [showForm, setShowForm] = useState(false);
  const [provider, setProvider] = useState("anthropic");
  const [keyName, setKeyName] = useState("");
  const [keyValue, setKeyValue] = useState("");

  const handleCreate = async () => {
    if (!keyName.trim() || !keyValue.trim()) return;
    await createKey(provider, keyName.trim(), keyValue.trim());
    setKeyName("");
    setKeyValue("");
    setShowForm(false);
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Key className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">API-Keys</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowForm(!showForm)}
        >
          <Plus className="mr-1 h-3 w-3" />
          Hinzufügen
        </Button>
      </div>

      {showForm && (
        <div className="mb-3 space-y-2 rounded-md bg-secondary/30 p-3">
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none"
          >
            <option value="anthropic">Anthropic</option>
            <option value="openai">OpenAI</option>
            <option value="google">Google AI</option>
            <option value="other">Andere</option>
          </select>
          <input
            type="text"
            value={keyName}
            onChange={(e) => setKeyName(e.target.value)}
            placeholder="Key-Name (z.B. Production Key)"
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none"
          />
          <input
            type="password"
            value={keyValue}
            onChange={(e) => setKeyValue(e.target.value)}
            placeholder="API-Key eingeben"
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate}>
              Speichern
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowForm(false)}
            >
              Abbrechen
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {apiKeys.length === 0 ? (
          <p className="py-2 text-center text-xs text-muted-foreground">
            Keine API-Keys hinterlegt
          </p>
        ) : (
          apiKeys.map((key) => (
            <div
              key={key.id}
              className="flex items-center gap-3 rounded-md bg-secondary/20 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">{key.key_name}</span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                    {key.provider}
                  </span>
                </div>
                <p className="text-xs font-mono text-muted-foreground">
                  {key.key_masked}
                </p>
              </div>
              <button
                onClick={() => toggleKey(key.id, !key.is_active)}
                className="text-muted-foreground hover:text-foreground"
              >
                {key.is_active ? (
                  <ToggleRight className="h-5 w-5 text-green-500" />
                ) : (
                  <ToggleLeft className="h-5 w-5" />
                )}
              </button>
              <button
                onClick={() => deleteKey(key.id)}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
