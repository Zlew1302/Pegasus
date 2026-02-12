"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TaskPriority, TaskStatus } from "@/types";

interface TaskFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    title: string;
    description?: string;
    priority?: TaskPriority;
    task_type?: string;
    status?: TaskStatus;
    acceptance_criteria?: string;
  }) => void;
  defaultStatus?: TaskStatus;
}

export function TaskForm({
  open,
  onOpenChange,
  onSubmit,
  defaultStatus = "todo",
}: TaskFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [taskType, setTaskType] = useState("feature");
  const [criteria, setCriteria] = useState("");

  const handleSubmit = () => {
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      task_type: taskType,
      status: defaultStatus,
      acceptance_criteria: criteria.trim() || undefined,
    });
    // Reset
    setTitle("");
    setDescription("");
    setPriority("medium");
    setTaskType("feature");
    setCriteria("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Neue Aufgabe</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Input
              placeholder="Titel der Aufgabe"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && title.trim()) handleSubmit();
              }}
              autoFocus
            />
          </div>

          <div>
            <Textarea
              placeholder="Beschreibung (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div>
            <Textarea
              placeholder="Akzeptanzkriterien (optional)"
              value={criteria}
              onChange={(e) => setCriteria(e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex gap-2">
            <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Priorität" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="critical">Kritisch</SelectItem>
                <SelectItem value="high">Hoch</SelectItem>
                <SelectItem value="medium">Mittel</SelectItem>
                <SelectItem value="low">Niedrig</SelectItem>
              </SelectContent>
            </Select>

            <Select value={taskType} onValueChange={setTaskType}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Typ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="feature">Feature</SelectItem>
                <SelectItem value="bug">Bug</SelectItem>
                <SelectItem value="docs">Doku</SelectItem>
                <SelectItem value="maintenance">Wartung</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} disabled={!title.trim()}>
            Erstellen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
