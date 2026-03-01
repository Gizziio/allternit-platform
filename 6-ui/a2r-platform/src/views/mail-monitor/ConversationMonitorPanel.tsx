"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatRelativeTime } from "@/lib/time";
import type { MailMessage } from "@/lib/agents";

interface ConversationMonitorPanelProps {
  messages: MailMessage[];
  telemetry?: {
    snapshot: import("@/lib/telemetry/schema").TelemetrySnapshot | null;
    loading: boolean;
    error: string | null;
  };
}

export function ConversationMonitorPanel({ messages, telemetry }: ConversationMonitorPanelProps) {
  const snapshot = telemetry?.snapshot;
  const timeline = snapshot?.timeline ?? [];
  return (
    <div className="flex flex-col gap-4">
      <Card className="border">
        <CardHeader>
          <CardTitle className="text-[13px] font-semibold">Conversation Monitor</CardTitle>
        </CardHeader>
        <CardContent className="max-h-64 overflow-y-auto space-y-3">
          {messages.length === 0 ? (
            <p className="text-xs text-muted-foreground">No messages yet.</p>
          ) : (
            messages.map((msg) => (
              <div key={msg.message_id} className="rounded-lg border border-muted/30 p-3">
                <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-muted-foreground">
                  <span>{msg.from_agent}</span>
                  <span>{formatRelativeTime(msg.timestamp)}</span>
                </div>
                <p className="text-[12px] text-foreground">{msg.body}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
      <Card className="border">
        <CardHeader>
          <CardTitle className="text-[13px] font-semibold">Telemetry Timeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-muted-foreground">
          {timeline.length === 0 ? (
            <p>No telemetry yet.</p>
          ) : (
            timeline.map((entry) => (
              <div key={entry.timestamp} className="space-y-1">
                <p className="font-semibold">{entry.label}</p>
                <p>{entry.detail}</p>
                <p className="text-[11px] uppercase tracking-wide">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
