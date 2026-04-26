"use client";

import { useState, useEffect, useMemo } from "react";

const DEFAULT_STATUS_CYCLE = [
  "Spinning up agent",
  "Loading workspace context...",
  "Waking up computer",
  "Analyzing your request...",
  "Sorting out details...",
  "Plotting response...",
  "Cross-referencing sources...",
  "Finalizing answer...",
];

const AGENT_STATUS_CYCLES: Record<string, string[]> = {
  code: [
    "Spinning up Code Agent",
    "Loading codebase context...",
    "Indexing files...",
    "Analyzing dependencies...",
    "Planning implementation...",
    "Writing code...",
    "Running tests...",
    "Finalizing solution...",
  ],
  research: [
    "Spinning up Research Agent",
    "Loading knowledge base...",
    "Searching sources...",
    "Analyzing findings...",
    "Cross-referencing data...",
    "Synthesizing insights...",
    "Verifying claims...",
    "Compiling report...",
  ],
  write: [
    "Spinning up Writing Agent",
    "Loading style guide...",
    "Analyzing tone...",
    "Outlining structure...",
    "Drafting content...",
    "Refining language...",
    "Checking grammar...",
    "Polishing final draft...",
  ],
};

function getStatusCycle(agentName?: string): string[] {
  if (!agentName) return DEFAULT_STATUS_CYCLE;
  const lower = agentName.toLowerCase();
  for (const [key, cycle] of Object.entries(AGENT_STATUS_CYCLES)) {
    if (lower.includes(key)) return cycle;
  }
  return DEFAULT_STATUS_CYCLE.map((s) =>
    s === "Spinning up agent" ? `Spinning up ${agentName}` : s
  );
}

/**
 * Cycles through agent execution status messages while streaming.
 * Simulates the granular status steps shown in ChatGPT's agent mode.
 *
 * @param isStreaming - Whether the agent is currently streaming a response
 * @param agentName - Optional agent name for personalized status messages
 * @param intervalMs - How often to cycle to the next status (default: 1800ms)
 * @returns The current status string, or null if not streaming
 */
export function useAgentStreamingStatus(
  isStreaming: boolean,
  agentName?: string,
  intervalMs: number = 1800
): string | null {
  const [statusIndex, setStatusIndex] = useState(0);

  const statuses = useMemo(
    () => getStatusCycle(agentName),
    [agentName]
  );

  useEffect(() => {
    if (!isStreaming) {
      setStatusIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setStatusIndex((prev) => {
        const next = prev + 1;
        // Once we reach the final status, stay there
        return next >= statuses.length ? statuses.length - 1 : next;
      });
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isStreaming, statuses.length, intervalMs]);

  if (!isStreaming) return null;
  return statuses[Math.min(statusIndex, statuses.length - 1)];
}
