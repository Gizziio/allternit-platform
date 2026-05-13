import { memo } from "react";
import { IconMessage, IconPhone, IconClock } from "@tabler/icons-react";
import { ToolRowBase } from "./tool-row-base";
import { cn } from "../utils/cn";

export type TextMessage = {
  to?: string;
  from?: string;
  body?: string;
  scheduledTime?: string;
};

export type TextMessageToolProps = {
  part: {
    id?: string;
    toolCallId?: string;
    type?: string;
    state?: string;
    input?: Record<string, unknown>;
    args?: Record<string, unknown>;
    output?: Record<string, unknown>;
    result?: Record<string, unknown>;
  };
  defaultOpen?: boolean;
};

function normalizeMessage(value: unknown): TextMessage | undefined {
  if (!value || typeof value !== "object") return undefined;
  const v = value as Record<string, unknown>;
  return {
    to: typeof v.to === "string" ? v.to : typeof v.recipient === "string" ? v.recipient : undefined,
    from: typeof v.from === "string" ? v.from : typeof v.sender === "string" ? v.sender : undefined,
    body: typeof v.body === "string" ? v.body : typeof v.message === "string" ? v.message : typeof v.text === "string" ? v.text : undefined,
    scheduledTime: typeof v.scheduledTime === "string" ? v.scheduledTime : typeof v.schedule === "string" ? v.schedule : undefined,
  };
}

export const TextMessageTool = memo(function TextMessageTool({
  part,
  defaultOpen = false,
}: TextMessageToolProps) {
  const isPending =
    part.state !== "output-available" && part.state !== "output-error";

  const msg =
    normalizeMessage(part.output) ??
    normalizeMessage(part.result) ??
    normalizeMessage(part.input) ??
    normalizeMessage(part.args) ??
    {};

  const hasContent = !!(msg.to || msg.body);

  return (
    <ToolRowBase
      icon={<IconMessage className="w-full h-full text-muted-foreground" />}
      shimmerLabel="Composing message..."
      completeLabel={msg.to ? `Message to ${msg.to}` : "Message composed"}
      isAnimating={isPending}
      expandable={hasContent}
      defaultOpen={defaultOpen}
    >
      <div className="rounded-an-tool-border-radius border border-border bg-an-tool-background overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-an-tool-border-color bg-background/50">
          <IconPhone className="size-3.5  text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Text Message</span>
        </div>
        <div className="p-3 space-y-2">
          {msg.to && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground text-xs uppercase tracking-wide w-14">To</span>
              <span className="text-foreground font-medium">{msg.to}</span>
            </div>
          )}
          {msg.from && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground text-xs uppercase tracking-wide w-14">From</span>
              <span className="text-foreground">{msg.from}</span>
            </div>
          )}
          {msg.scheduledTime && (
            <div className="flex items-center gap-2 text-sm">
              <IconClock className="size-3.5  text-muted-foreground shrink-0" />
              <span className="text-muted-foreground text-xs">{msg.scheduledTime}</span>
            </div>
          )}
          {msg.body && (
            <div className="pt-2 border-t border-an-tool-border-color">
              <div
                className={cn(
                  "inline-block max-w-full text-sm text-foreground leading-relaxed",
                  "bg-primary/5 rounded-2xl rounded-tl-sm px-3 py-2"
                )}
              >
                {msg.body}
              </div>
            </div>
          )}
        </div>
      </div>
    </ToolRowBase>
  );
});
