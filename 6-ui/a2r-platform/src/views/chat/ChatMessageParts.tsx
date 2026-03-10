// ============================================================================
// Extended Message Parts Renderer with A2UI Support
// ============================================================================
// Renders all message part types including A2UI, action buttons, and agent thinking
// ============================================================================

"use client";

import React from "react";
import type { RichContentPart, A2UIPart, ArtifactPart } from "./ChatMessageTypes";
import { MessageA2UI } from "./ChatA2UI";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle2, AlertCircle, Search, Code, Brain } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// Type Guards
// ============================================================================

function isA2UIPart(part: RichContentPart): part is A2UIPart {
  return part.type === "a2ui";
}

function isActionButtonsPart(
  part: RichContentPart
): part is Extract<RichContentPart, { type: "action-buttons" }> {
  return part.type === "action-buttons";
}

function isAgentThinkingPart(
  part: RichContentPart
): part is Extract<RichContentPart, { type: "agent-thinking" }> {
  return part.type === "agent-thinking";
}

function isArtifactPart(
  part: RichContentPart
): part is Extract<RichContentPart, { type: "artifact" }> {
  return part.type === "artifact";
}

function isBrowserLinkPart(
  part: RichContentPart
): part is Extract<RichContentPart, { type: "browser-link" }> {
  return part.type === "browser-link";
}

function isMiniappPart(
  part: RichContentPart
): part is Extract<RichContentPart, { type: "miniapp" }> {
  return part.type === "miniapp";
}

// ============================================================================
// Component Props
// ============================================================================

interface RichMessagePartsProps {
  parts: RichContentPart[];
  messageId: string;
  isLoading?: boolean;
  onAction?: (messageId: string, actionId: string, payload: unknown) => void;
  className?: string;
}

// ============================================================================
// Main Renderer
// ============================================================================

export function RichMessageParts({
  parts,
  messageId,
  isLoading,
  onAction,
  className,
}: RichMessagePartsProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {parts.map((part, idx) => {
        // A2UI Part - Interactive UI
        if (isA2UIPart(part)) {
          return (
            <MessageA2UI
              key={`a2ui-${idx}`}
              part={part}
              messageId={messageId}
              onAction={onAction}
            />
          );
        }

        // Action Buttons Part
        if (isActionButtonsPart(part)) {
          return (
            <ActionButtonsRenderer
              key={`actions-${idx}`}
              part={part}
              onAction={(action, payload) => onAction?.(messageId, action, payload)}
            />
          );
        }

        // Agent Thinking Part
        if (isAgentThinkingPart(part)) {
          return (
            <AgentThinkingRenderer
              key={`thinking-${idx}`}
              part={part}
            />
          );
        }

        // Artifact Part
        if (isArtifactPart(part)) {
          return (
            <ArtifactRenderer
              key={`artifact-${idx}`}
              part={part}
            />
          );
        }

        // Browser Link Part
        if (isBrowserLinkPart(part)) {
          return (
            <BrowserLinkRenderer
              key={`link-${idx}`}
              part={part}
            />
          );
        }

        // Miniapp Part
        if (isMiniappPart(part)) {
          return (
            <MiniappRenderer
              key={`miniapp-${idx}`}
              part={part}
            />
          );
        }

        // Text Part (from UIPart)
        if (part.type === "text") {
          return (
            <div key={`text-${idx}`} className="prose prose-sm dark:prose-invert max-w-none">
              {part.text}
            </div>
          );
        }

        // Tool Part (from UIPart)
        if (part.type === "dynamic-tool") {
          return (
            <ToolRenderer
              key={`tool-${idx}`}
              part={part}
            />
          );
        }

        // File Part (from UIPart)
        if (part.type === "file") {
          return (
            <FileRenderer
              key={`file-${idx}`}
              part={part}
            />
          );
        }

        // Source Document Part (from UIPart)
        if (part.type === "source-document") {
          return (
            <SourceDocumentRenderer
              key={`source-${idx}`}
              part={part}
            />
          );
        }

        return null;
      })}

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Thinking...</span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Individual Part Renderers
// ============================================================================

function ActionButtonsRenderer({
  part,
  onAction,
}: {
  part: Extract<RichContentPart, { type: "action-buttons" }>;
  onAction: (action: string, payload: unknown) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {part.buttons.map((button, idx) => (
        <Button
          key={idx}
          variant={
            button.variant === "primary"
              ? "default"
              : button.variant === "destructive"
              ? "destructive"
              : button.variant === "ghost"
              ? "ghost"
              : "secondary"
          }
          size="sm"
          onClick={() => onAction(button.action, button.payload)}
        >
          {button.label}
        </Button>
      ))}
    </div>
  );
}

function AgentThinkingRenderer({
  part,
}: {
  part: Extract<RichContentPart, { type: "agent-thinking" }>;
}) {
  const statusIcons: Record<string, React.ReactNode> = {
    idle: <Brain className="w-4 h-4" />,
    reasoning: <Brain className="w-4 h-4 animate-pulse" />,
    searching: <Search className="w-4 h-4 animate-pulse" />,
    coding: <Code className="w-4 h-4 animate-pulse" />,
    waiting: <Loader2 className="w-4 h-4 animate-spin" />,
  };

  const statusLabels: Record<string, string> = {
    idle: "Ready",
    reasoning: "Thinking",
    searching: "Searching",
    coding: "Coding",
    waiting: "Waiting",
  };

  return (
    <Card className="bg-muted/50 border-dashed">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {statusIcons[part.status] || statusIcons.idle}
          <span>{statusLabels[part.status] || "Processing"}</span>
          {part.message && (
            <span className="text-xs">- {part.message}</span>
          )}
        </div>

        {part.steps && part.steps.length > 0 && (
          <div className="space-y-1 pl-6">
            {part.steps.map((step) => (
              <div
                key={step.id}
                className={cn(
                  "flex items-center gap-2 text-sm",
                  step.status === "completed" && "text-green-600",
                  step.status === "active" && "text-primary",
                  step.status === "error" && "text-destructive",
                  step.status === "pending" && "text-muted-foreground"
                )}
              >
                {step.status === "completed" && (
                  <CheckCircle2 className="w-3 h-3" />
                )}
                {step.status === "active" && (
                  <Loader2 className="w-3 h-3 animate-spin" />
                )}
                {step.status === "error" && (
                  <AlertCircle className="w-3 h-3" />
                )}
                {step.status === "pending" && (
                  <div className="w-3 h-3 rounded-full border border-muted-foreground/30" />
                )}
                <span>{step.label}</span>
                {step.detail && (
                  <span className="text-xs text-muted-foreground">
                    {step.detail}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ArtifactRenderer({
  part,
}: {
  part: Extract<RichContentPart, { type: "artifact" }>;
}) {
  const typeIcons: Record<string, string> = {
    code: "</>",
    document: "📄",
    diagram: "📊",
    a2ui: "🎨",
  };

  return (
    <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
      <CardContent className="p-3 flex items-center gap-3">
        <span className="text-2xl">{typeIcons[(part as ArtifactPart).artifactType] || "📎"}</span>
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{part.title}</div>
          {(part as ArtifactPart).preview && (
            <div className="text-sm text-muted-foreground truncate">
              {(part as ArtifactPart).preview}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function BrowserLinkRenderer({
  part,
}: {
  part: Extract<RichContentPart, { type: "browser-link" }>;
}) {
  return (
    <a
      href={part.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 text-primary hover:underline"
    >
      <span>🌐</span>
      {part.title || part.url}
    </a>
  );
}

function MiniappRenderer({
  part,
}: {
  part: Extract<RichContentPart, { type: "miniapp" }>;
}) {
  return (
    <Card className="border-primary/20">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            🧩
          </div>
          <div className="flex-1">
            <div className="font-medium">{part.title || "Miniapp"}</div>
            <div className="text-sm text-muted-foreground">
              {part.description || `ID: ${part.capsuleId}`}
            </div>
          </div>
          <Button variant="outline" size="sm">
            Open
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ToolRenderer({
  part,
}: {
  part: Extract<RichContentPart, { type: "dynamic-tool" }>;
}) {
  // Use the existing Tool component from AI Elements
  return (
    <Card className="bg-muted/30">
      <CardContent className="p-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">{part.toolName}</span>
          <span
            className={cn(
              "text-xs px-2 py-0.5 rounded",
              part.state === "output-available" && "bg-green-500/10 text-green-600",
              part.state === "output-error" && "bg-destructive/10 text-destructive",
              (part.state === "input-available" || part.state === "input-streaming") &&
                "bg-primary/10 text-primary"
            )}
          >
            {part.state}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function FileRenderer({
  part,
}: {
  part: Extract<RichContentPart, { type: "file" }>;
}) {
  return (
    <div className="inline-flex items-center gap-2 bg-muted px-3 py-1.5 rounded-md text-sm">
      <span>📎</span>
      <span>{part.filename || "unnamed file"}</span>
    </div>
  );
}

function SourceDocumentRenderer({
  part,
}: {
  part: Extract<RichContentPart, { type: "source-document" }>;
}) {
  return (
    <a
      href={`#source-${part.sourceId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary hover:underline text-sm"
    >
      📄 {part.title}
    </a>
  );
}
