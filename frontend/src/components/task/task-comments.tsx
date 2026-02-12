"use client";

import { useState } from "react";
import { MessageCircle, Trash2, Bot, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useComments } from "@/hooks/use-comments";

interface TaskCommentsProps {
  taskId: string;
}

export function TaskComments({ taskId }: TaskCommentsProps) {
  const { comments, createComment, deleteComment } = useComments(taskId);
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!newComment.trim()) return;
    setIsSubmitting(true);
    try {
      await createComment(taskId, "Lukas", newComment.trim());
      setNewComment("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSubmit();
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Gerade eben";
    if (diffMin < 60) return `vor ${diffMin} Min.`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `vor ${diffH} Std.`;
    const diffD = Math.floor(diffH / 24);
    return `vor ${diffD} Tag${diffD > 1 ? "en" : ""}`;
  };

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
        <h3 className="text-xs font-medium uppercase text-muted-foreground">
          Kommentare
        </h3>
        {comments.length > 0 && (
          <span className="text-xs text-muted-foreground">
            ({comments.length})
          </span>
        )}
      </div>

      {/* Comment List */}
      {comments.length === 0 ? (
        <p className="mb-3 text-xs text-muted-foreground">
          Noch keine Kommentare
        </p>
      ) : (
        <div className="mb-3 space-y-3">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="group rounded-md border border-border/50 bg-secondary/20 p-2.5"
            >
              <div className="mb-1 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {/* Avatar */}
                  <div
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-medium ${
                      comment.author_type === "agent"
                        ? "bg-cyan-500/20 text-cyan-400"
                        : "bg-orange-500/20 text-orange-400"
                    }`}
                  >
                    {comment.author_type === "agent" ? (
                      <Bot className="h-3 w-3" />
                    ) : (
                      <User className="h-3 w-3" />
                    )}
                  </div>
                  <span className="text-xs font-medium">
                    {comment.author_name}
                  </span>
                  <span
                    className={`rounded px-1 py-0.5 text-[10px] ${
                      comment.author_type === "agent"
                        ? "bg-cyan-500/10 text-cyan-400"
                        : "bg-green-500/10 text-green-400"
                    }`}
                  >
                    {comment.author_type === "agent" ? "Agent" : "Mensch"}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground">
                    {formatTime(comment.created_at)}
                  </span>
                  <button
                    onClick={() => deleteComment(comment.id)}
                    className="hidden text-muted-foreground hover:text-destructive group-hover:block"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
              <p className="whitespace-pre-wrap text-sm text-foreground/80">
                {comment.content}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Input Area */}
      <div className="space-y-2">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Kommentar schreiben... (⌘+Enter zum Senden)"
          rows={2}
          className="w-full rounded-md border border-border bg-secondary/30 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/50 focus:border-[hsl(var(--accent-orange))]"
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!newComment.trim() || isSubmitting}
            className="bg-[hsl(var(--accent-orange))] text-white hover:bg-[hsl(var(--accent-orange))]/90"
          >
            {isSubmitting ? "Sendet..." : "Kommentieren"}
          </Button>
        </div>
      </div>
    </div>
  );
}
