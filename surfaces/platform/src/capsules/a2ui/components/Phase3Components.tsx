// ============================================================================
// Phase 3: Agent-Specific Components
// ============================================================================
// AgentThinking, ToolCall, ArtifactPreview
// ============================================================================

"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Brain,
  MagnifyingGlass,
  Code,
  CircleNotch,
  CaretDown,
  CaretUp,
  Play,
  ArrowCounterClockwise,
  X,
  FileCode,
  FileImage,
  FileText,
  DownloadSimple,
  Copy,
  ArrowsOut,
  Sparkle,
  Clock,
  CheckCircle,
  Warning,
} from '@phosphor-icons/react';
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

import type {
  AgentThinkingProps,
  ToolCallProps,
  ArtifactPreviewProps,
  RenderContext,
} from "../a2ui.types.extended";
import { resolvePath, resolveValue, isVisible } from "../A2UIRenderer";

// ============================================================================
// AgentThinking Component
// ============================================================================

const statusConfig: Record<
  string,
  {
    icon: React.ReactNode;
    label: string;
    color: string;
  }
> = {
  idle: {
    icon: <Brain size={20} />,
    label: "Ready",
    color: "var(--muted-foreground)",
  },
  reasoning: {
    icon: <Brain className="w-5 h-5 animate-pulse" />,
    label: "Thinking",
    color: "var(--primary)",
  },
  searching: {
    icon: <MagnifyingGlass className="w-5 h-5 animate-pulse" />,
    label: "Searching",
    color: "var(--primary)",
  },
  coding: {
    icon: <Code className="w-5 h-5 animate-pulse" />,
    label: "Coding",
    color: "var(--primary)",
  },
  waiting: {
    icon: <CircleNotch className="w-5 h-5 animate-spin" />,
    label: "Waiting",
    color: "var(--primary)",
  },
  planning: {
    icon: <Sparkle className="w-5 h-5 animate-pulse" />,
    label: "Planning",
    color: "var(--primary)",
  },
  executing: {
    icon: <Play className="w-5 h-5 animate-pulse" />,
    label: "Executing",
    color: "var(--primary)",
  },
};

const stepStatusIcons = {
  pending: <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />,
  active: <CircleNotch className="w-3 h-3 animate-spin text-primary" />,
  completed: <CheckCircle className="w-3 h-3 text-green-500" />,
  error: <Warning className="w-3 h-3 text-destructive" />,
};

export function AgentThinkingRenderer({
  props,
  context,
}: {
  props: AgentThinkingProps;
  context: RenderContext;
}) {
  if (!isVisible(props, context.dataModel)) return null;

  const config = statusConfig[props.status] || statusConfig.idle;
  const steps = typeof props.steps === "string"
    ? (resolvePath(context.dataModel, props.steps) as AgentThinkingProps["steps"])
    : props.steps;

  const expandedFromModel = props.expandedPath
    ? (resolvePath(context.dataModel, props.expandedPath) as boolean)
    : undefined;
  
  const [isExpanded, setIsExpanded] = useState(
    props.collapsible ? (expandedFromModel ?? true) : true
  );

  const handleCancel = () => {
    if (props.onCancel) {
      context.onAction(props.onCancel, {});
    }
  };

  return (
    <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="p-2 rounded-lg bg-background border"
              style={{ color: config.color }}
            >
              {config.icon}
            </div>
            <div>
              <CardTitle className="text-base font-medium">
                {config.label}
              </CardTitle>
              {props.message && (
                <p className="text-sm text-muted-foreground">{props.message}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {props.progress !== undefined && (
              <div className="w-32">
                <Progress value={props.progress} className="h-2" />
                <p className="text-xs text-muted-foreground text-right mt-1">
                  {props.progress}%
                </p>
              </div>
            )}

            {props.estimatedTime && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Clock size={16} />
                ~{props.estimatedTime}s
              </div>
            )}

            {props.onCancel && (
              <Button variant="ghost" size="sm" onClick={handleCancel}>
                <X size={16} />
              </Button>
            )}

            {props.collapsible && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? (
                  <CaretUp size={16} />
                ) : (
                  <CaretDown size={16} />
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <AnimatePresence>
        {isExpanded && steps && steps.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CardContent className="pt-0">
              <div className="space-y-2 pl-2 border-l-2 border-primary/20">
                {steps && Array.isArray(steps) && steps.map((step, idx) => (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={cn(
                      "flex items-center gap-3 py-2 px-3 rounded-lg transition-colors",
                      step.status === "active" && "bg-primary/10",
                      step.status === "completed" && "text-green-600",
                      step.status === "error" && "text-destructive"
                    )}
                  >
                    <div className="flex-shrink-0">
                      {stepStatusIcons[step.status]}
                    </div>
                    <div className="flex-1">
                      <span
                        className={cn(
                          "text-sm",
                          step.status === "active" && "font-medium"
                        )}
                      >
                        {step.label}
                      </span>
                      {step.detail && (
                        <p className="text-xs text-muted-foreground">
                          {step.detail}
                        </p>
                      )}
                    </div>
                    {step.duration && (
                      <span className="text-xs text-muted-foreground">
                        {step.duration}ms
                      </span>
                    )}
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>

      {props.showSparkles && (
        <div className="absolute top-2 right-2 opacity-50">
          <Sparkle className="w-4 h-4 text-primary animate-pulse" />
        </div>
      )}
    </Card>
  );
}

// ============================================================================
// ToolCall Component
// ============================================================================

export function ToolCallRenderer({
  props,
  context,
}: {
  props: ToolCallProps;
  context: RenderContext;
}) {
  if (!isVisible(props, context.dataModel)) return null;

  const input: unknown = typeof props.input === "string"
    ? resolvePath(context.dataModel, props.input)
    : props.input;

  const output: unknown = props.output
    ? typeof props.output === "string"
      ? resolvePath(context.dataModel, props.output)
      : props.output
    : undefined;

  const error: string | undefined = props.error
    ? typeof props.error === "string"
      ? String(resolvePath(context.dataModel, props.error))
      : String(props.error)
    : undefined;

  const [isExpanded, setIsExpanded] = useState(props.expanded ?? false);
  const [activeTab, setActiveTab] = useState<"input" | "output">("input");

  const statusColors: Record<string, string> = {
    pending: "var(--muted-foreground)",
    running: "var(--primary)",
    success: "#22c55e",
    error: "var(--destructive)",
  };

  const handleRerun = () => {
    if (props.onRerun) {
      context.onAction(props.onRerun, { input });
    }
  };

  return (
    <Card
      className={cn(
        "overflow-hidden",
        props.status === "running" && "border-primary/50"
      )}
    >
      <CardHeader className="py-3 cursor-pointer" onClick={() => props.expandable !== false && setIsExpanded(!isExpanded)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: statusColors[props.status] }}
            />
            <div className="flex items-center gap-2">
              {props.toolIcon ? (
                <span>{props.toolIcon}</span>
              ) : (
                <Code className="w-4 h-4 text-muted-foreground" />
              )}
              <CardTitle className="text-sm font-medium">
                {props.toolName || props.tool}
              </CardTitle>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {props.status === "running" && (
              <CircleNotch className="w-4 h-4 animate-spin" />
            )}

            {props.duration && (
              <span className="text-xs text-muted-foreground">
                {props.duration}ms
              </span>
            )}

            {props.onRerun && props.status !== "running" && (
              <Button
                variant="ghost"
                size="icon"
                size={24}
                onClick={(e) => {
                  e.stopPropagation();
                  handleRerun();
                }}
              >
                <ArrowCounterClockwise size={12} />
              </Button>
            )}

            {props.expandable !== false && (
              <Button variant="ghost" size="icon" size={24}>
                {isExpanded ? (
                  <CaretUp size={16} />
                ) : (
                  <CaretDown size={16} />
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CardContent className="pt-0">
              {/* Tabs */}
              <div className="flex items-center gap-2 mb-3 border-b">
                <button
                  className={cn(
                    "px-3 py-2 text-sm border-b-2 transition-colors",
                    activeTab === "input"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setActiveTab("input")}
                >
                  Input
                </button>
                {output !== undefined && (
                  <button
                    className={cn(
                      "px-3 py-2 text-sm border-b-2 transition-colors",
                      activeTab === "output"
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => setActiveTab("output")}
                  >
                    Output
                  </button>
                )}
              </div>

              {/* Content */}
              <ScrollArea className="h-[200px]">
                <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto">
                  {JSON.stringify(
                    activeTab === "input" ? input : output,
                    null,
                    2
                  )}
                </pre>
              </ScrollArea>

              {error && (
                <div className="mt-3 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                  {error}
                </div>
              )}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

// ============================================================================
// ArtifactPreview Component
// ============================================================================

const artifactIcons: Record<string, React.ReactNode> = {
  code: <FileCode size={20} />,
  image: <FileImage size={20} />,
  markdown: <FileText size={20} />,
  json: <FileCode size={20} />,
  html: <FileCode size={20} />,
  text: <FileText size={20} />,
  pdf: <FileText size={20} />,
  diagram: <FileImage size={20} />,
};

export function ArtifactPreviewRenderer({
  props,
  context,
}: {
  props: ArtifactPreviewProps;
  context: RenderContext;
}) {
  if (!isVisible(props, context.dataModel)) return null;

  const content = typeof props.content === "string"
    ? props.content
    : (resolvePath(context.dataModel, props.content as string) as string) || "";

  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleDownload = () => {
    if (props.downloadAction) {
      context.onAction(props.downloadAction, { content, filename: props.filename });
    } else {
      // Default download behavior
      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = props.filename || "artifact.txt";
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    if (props.copyAction) {
      context.onAction(props.copyAction, {});
    }
  };

  const handleFullscreen = () => {
    if (props.fullscreenAction) {
      context.onAction(props.fullscreenAction, {});
    } else {
      setIsFullscreen(!isFullscreen);
    }
  };

  const renderContent = () => {
    switch (props.type) {
      case "code":
        return (
          <SyntaxHighlighter
            language={props.language || "typescript"}
            style={oneDark}
            showLineNumbers={props.showLineNumbers}
            wrapLines={props.wrapLines}
            className="text-sm rounded-lg"
          >
            {content}
          </SyntaxHighlighter>
        );

      case "markdown":
        return (
          <div className="prose prose-sm dark:prose-invert max-w-none p-4">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        );

      case "json":
        try {
          const parsed = JSON.parse(content);
          return (
            <pre className="text-sm bg-muted p-4 rounded-lg overflow-auto">
              {JSON.stringify(parsed, null, 2)}
            </pre>
          );
        } catch {
          return (
            <pre className="text-sm bg-muted p-4 rounded-lg overflow-auto text-destructive">
              Invalid JSON
            </pre>
          );
        }

      case "html":
        return (
          <div className="border rounded-lg overflow-hidden">
            <iframe
              srcDoc={content}
              className="w-full"
              style={{ height: props.height || 300 }}
              sandbox="allow-scripts"
            />
          </div>
        );

      case "image":
        return (
          <img
            src={content}
            alt={props.title || "Artifact"}
            className="max-w-full h-auto rounded-lg"
          />
        );

      default:
        return (
          <pre className="text-sm bg-muted p-4 rounded-lg overflow-auto whitespace-pre-wrap">
            {content}
          </pre>
        );
    }
  };

  return (
    <Card
      className={cn(
        "overflow-hidden",
        isFullscreen && "fixed inset-4 z-50"
      )}
    >
      <CardHeader className="py-3 flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-muted-foreground">
            {artifactIcons[props.type] || <FileText size={20} />}
          </div>
          <div>
            <CardTitle className="text-sm font-medium">
              {props.title || props.filename || "Artifact"}
            </CardTitle>
            {props.description && (
              <p className="text-xs text-muted-foreground">
                {props.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            size={32}
            onClick={handleCopy}
            title="Copy"
          >
            <Copy size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            size={32}
            onClick={handleDownload}
            title="Download"
          >
            <DownloadSimple size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            size={32}
            onClick={handleFullscreen}
            title="Fullscreen"
          >
            <ArrowsOut size={16} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <ScrollArea
          className={isFullscreen ? "h-[calc(100vh-120px)]" : ""}
          style={{ maxHeight: isFullscreen ? undefined : props.height || 400 }}
        >
          {renderContent()}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
