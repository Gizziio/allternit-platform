"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatRelativeTime } from "@/lib/time";
import type { LedgerEvent, LogEntry, MailMessage, SessionAnalytics } from "@/lib/agents";

export interface MailMonitorPanelProps {
  threadId: string;
  messages: MailMessage[];
  analytics: SessionAnalytics | null;
  relevantEvents: LedgerEvent[];
  relevantLogs: LogEntry[];
  telemetry?: {
    snapshot: import("@/lib/telemetry/schema").TelemetrySnapshot | null;
    loading: boolean;
    error: string | null;
  };
}

export function MailMonitorPanel({
  threadId,
  messages,
  analytics,
  relevantEvents,
  relevantLogs,
  telemetry,
}: MailMonitorPanelProps) {
  const snapshot = telemetry?.snapshot;
  const tokenUsage = snapshot?.tokenUsage;
  const timeline = snapshot?.timeline ?? [];
  const providerLabel = snapshot?.providerName || snapshot?.providerId || "Telemetry";
  return (
    <div className="grid h-full gap-4 md:grid-cols-[2fr_1fr]">
      <div className="flex flex-col rounded-2xl border border-border/50 bg-background/60 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold">Conversation</div>
          <span className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
            {messages.length} messages
          </span>
        </div>
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {messages.length === 0 ? (
            <p className="text-xs text-muted-foreground">Waiting for new activity...</p>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.message_id}
                className="rounded-2xl border border-muted/30 bg-muted/10 p-3 shadow-inner"
              >
                <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-muted-foreground">
                  <span>{msg.from_agent}</span>
                  <span>{formatRelativeTime(msg.timestamp)}</span>
                </div>
                <p className="mt-2 text-sm leading-snug text-foreground">{msg.body}</p>
              </div>
            ))
          )}
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <Card className="flex-1 border">
          <CardHeader>
            <CardTitle className="text-[13px] font-semibold">Session Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            {snapshot ? (
              snapshot.lines?.map((line) => (
                <div key={`${line.label}-${line.type}`}>
                  <p className="font-semibold text-[11px] uppercase text-muted-foreground">{line.label}</p>
                  {line.type === "progress" ? (
                    <div className="text-[11px]">
                      {(line as any).used}/{(line as any).limit} {(line as any).format}
                    </div>
                  ) : (
                    <p className="text-[11px]">{(line as any).text || (line as any).value}</p>
                  )}
                </div>
              ))
            ) : (
              <p>No telemetry yet</p>
            )}
            <p className="text-[10px] text-muted-foreground">Source: {providerLabel}</p>
            {tokenUsage && (
              <div className="text-[10px] text-muted-foreground">
                Tokens (in/out/total): {tokenUsage.input} / {tokenUsage.output} / {tokenUsage.total}
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="flex-1 border">
          <CardHeader>
            <CardTitle className="text-[13px] font-semibold">Telemetry Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {timeline.length === 0 ? (
              <p className="text-muted-foreground">No recent telemetry</p>
            ) : (
              timeline.map((entry) => (
                <div key={entry.timestamp}>
                  <p className="font-semibold">{entry.label}</p>
                  <p className="text-[11px] text-muted-foreground">{new Date(entry.timestamp).toLocaleTimeString()}</p>
                  <p className="text-[10px] text-muted-foreground">{entry.detail}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card className="flex-1 border">
          <CardHeader>
            <CardTitle className="text-[13px] font-semibold">Logs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            {relevantLogs.length === 0 ? (
              <p>No log entries</p>
            ) : (
              relevantLogs.map((log) => (
                <div key={log.id} className="space-y-1 border-b border-muted/40 pb-2 last:border-b-0">
                  <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                    {log.level}
                  </p>
                  <p className="text-[12px]">{log.message}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatRelativeTime(new Date(log.timestamp).toISOString())}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
