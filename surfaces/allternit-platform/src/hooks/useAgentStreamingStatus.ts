"use client";

import { useState, useEffect, useMemo } from "react";

const DEFAULT_STATUS_CYCLE = [
  "Spinning up agent",
  "Waking up computer",
  "Sorting out details",
  "Plotting",
];

/**
 * Cycles through agent execution status messages while streaming.
 * Backend SSE does not emit status events, so this simulates
 * the granular steps client-side based on streaming duration.
 *
 * @param isStreaming - Whether the agent is currently streaming a response
 * @param intervalMs - How often to cycle to the next status (default: 1500ms)
 * @returns The current status string, or null if not streaming
 */
export function useAgentStreamingStatus(
  isStreaming: boolean,
  intervalMs: number = 1500
): string | null {
  const [statusIndex, setStatusIndex] = useState(0);

  const statuses = useMemo(() => DEFAULT_STATUS_CYCLE, []);

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
