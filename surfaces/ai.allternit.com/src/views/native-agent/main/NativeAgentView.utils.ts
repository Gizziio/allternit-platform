export type ViewMode = "split" | "chat-only" | "canvas-only";

export function formatSessionTimestamp(value?: string): string {
  if (!value) return "Awaiting activity";
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return "Awaiting activity";

  const elapsedMinutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (elapsedMinutes < 1) return "Updated just now";
  if (elapsedMinutes < 60) return `Updated ${elapsedMinutes}m ago`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `Updated ${elapsedHours}h ago`;
  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays < 7) return `Updated ${elapsedDays}d ago`;

  return `Updated ${new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(timestamp))}`;
}

export interface Canvas {
  id: string;
  sessionId: string;
  content: string;
  type: string;
  title?: string;
}

export interface RuntimeExecutionModeStatus {
  mode: string;
  updatedAt: string;
  supportedModes: string[];
}
