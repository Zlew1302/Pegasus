"use client";

import { useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { useTodos } from "@/hooks/use-todos";

interface TodoWidgetProps {
  embedded?: boolean;
}

export function TodoWidget({ embedded = false }: TodoWidgetProps) {
  const { todos, createTodo, toggleTodo, deleteTodo } = useTodos();
  const [newTitle, setNewTitle] = useState("");

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    await createTodo(newTitle.trim());
    setNewTitle("");
  };

  const content = (
    <>
      {/* Add Todo */}
      <div className="mb-3 flex gap-2">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Neuer Eintrag..."
          className="flex-1 rounded-md border border-border bg-secondary/30 px-2 py-1 text-xs outline-none focus:border-[hsl(var(--accent-orange))]"
        />
        <button
          onClick={handleAdd}
          className="rounded-md bg-[hsl(var(--accent-orange))] p-1 text-white hover:bg-[hsl(var(--accent-orange))]/90"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>

      {/* Todo List */}
      <div className="flex-1 space-y-1 overflow-y-auto">
        {todos.length === 0 ? (
          <p className="py-2 text-center text-xs text-muted-foreground">
            Keine Todos
          </p>
        ) : (
          todos.map((todo) => (
            <div
              key={todo.id}
              className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-secondary/30"
            >
              <button
                onClick={() => toggleTodo(todo.id, !todo.is_completed)}
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                  todo.is_completed
                    ? "border-green-500 bg-green-500/20"
                    : "border-border hover:border-[hsl(var(--accent-orange))]"
                }`}
              >
                {todo.is_completed && (
                  <Check className="h-3 w-3 text-green-500" />
                )}
              </button>
              <span
                className={`flex-1 text-xs ${
                  todo.is_completed
                    ? "text-muted-foreground line-through"
                    : ""
                }`}
              >
                {todo.title}
              </span>
              <button
                onClick={() => deleteTodo(todo.id)}
                className="invisible text-muted-foreground hover:text-destructive group-hover:visible"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))
        )}
      </div>
    </>
  );

  if (embedded) {
    return <div className="flex h-full flex-col">{content}</div>;
  }

  return (
    <div className="flex h-full flex-col rounded-lg border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-medium">Nächste Schritte</h3>
      {content}
    </div>
  );
}
