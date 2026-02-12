"use client";

import { useEffect, useRef, useState } from "react";
import type { ToolCallEvent } from "@/types";

interface ThoughtEntry {
  text: string;
  timestamp: string;
}

interface UseSSEResult {
  progress: number;
  currentStep: number;
  totalSteps: number;
  stepDescription: string;
  thoughts: ThoughtEntry[];
  toolCalls: ToolCallEvent[];
  status: "connecting" | "running" | "completed" | "error" | "cancelled" | "paused";
  output: string | null;
  approvalId: string | null;
  errorMessage: string | null;
  totalCostCents: number;
}

export function useSSE(
  instanceId: string | null,
  onStatusChange?: (status: string) => void,
): UseSSEResult {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [stepDescription, setStepDescription] = useState("");
  const [thoughts, setThoughts] = useState<ThoughtEntry[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCallEvent[]>([]);
  const [status, setStatus] = useState<UseSSEResult["status"]>("connecting");
  const [output, setOutput] = useState<string | null>(null);
  const [approvalId, setApprovalId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [totalCostCents, setTotalCostCents] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;

  useEffect(() => {
    if (!instanceId) return;

    const es = new EventSource(`/api/stream/${instanceId}`);
    eventSourceRef.current = es;

    es.onopen = () => setStatus("running");

    es.addEventListener("progress", (e) => {
      const data = JSON.parse(e.data);
      setProgress(data.percent);
      setCurrentStep(data.current_step);
      setTotalSteps(data.total_steps);
    });

    es.addEventListener("thought", (e) => {
      const data = JSON.parse(e.data);
      setThoughts((prev) => [...prev.slice(-50), data]);
    });

    es.addEventListener("step_start", (e) => {
      const data = JSON.parse(e.data);
      setStepDescription(data.description);
    });

    es.addEventListener("step_complete", () => {
      // Progress already updated via progress event
    });

    es.addEventListener("output", (e) => {
      const data = JSON.parse(e.data);
      setOutput(data.content);
    });

    es.addEventListener("approval_needed", (e) => {
      const data = JSON.parse(e.data);
      setApprovalId(data.approval_id);
    });

    es.addEventListener("tool_call", (e) => {
      const data = JSON.parse(e.data);
      setToolCalls((prev) => [...prev.slice(-20), data]);
      setThoughts((prev) => [
        ...prev.slice(-50),
        {
          text: `🔧 ${data.tool_name}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    });

    es.addEventListener("sub_agent_spawned", (e) => {
      const data = JSON.parse(e.data);
      setThoughts((prev) => [
        ...prev.slice(-50),
        {
          text: `🤖 Sub-Agent: ${data.agent_type_name} → ${data.sub_task_title}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    });

    es.addEventListener("retry", (e) => {
      const data = JSON.parse(e.data);
      setThoughts((prev) => [
        ...prev.slice(-50),
        {
          text: `⏳ Retry ${data.attempt}/${data.max_retries} (${data.reason})`,
          timestamp: new Date().toISOString(),
        },
      ]);
    });

    es.addEventListener("revision_start", (e) => {
      const data = JSON.parse(e.data);
      setStatus("running");
      setThoughts((prev) => [
        ...prev.slice(-50),
        {
          text: `📝 Revision: ${data.feedback}`,
          timestamp: data.timestamp,
        },
      ]);
    });

    es.addEventListener("completed", (e) => {
      const data = e.data ? JSON.parse(e.data) : {};
      setStatus("completed");
      setProgress(100);
      if (data.total_cost_cents) setTotalCostCents(data.total_cost_cents);
      onStatusChangeRef.current?.("completed");
      es.close();
    });

    es.addEventListener("error", (e) => {
      const me = e as MessageEvent;
      const data = me.data ? JSON.parse(me.data) : {};
      setStatus("error");
      if (data.message) setErrorMessage(data.message);
      if (data.total_cost_cents) setTotalCostCents(data.total_cost_cents);
      onStatusChangeRef.current?.("error");
      es.close();
    });

    es.addEventListener("cancelled", () => {
      setStatus("cancelled");
      onStatusChangeRef.current?.("cancelled");
      es.close();
    });

    es.onerror = () => {
      // EventSource auto-reconnects, but if it keeps failing, close it
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [instanceId]);

  return {
    progress,
    currentStep,
    totalSteps,
    stepDescription,
    thoughts,
    toolCalls,
    status,
    output,
    approvalId,
    errorMessage,
    totalCostCents,
  };
}
