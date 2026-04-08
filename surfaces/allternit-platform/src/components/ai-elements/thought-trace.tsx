/**
 * Thought Trace — Clean thinking section matching Claude.ai streaming UX
 *
 * Streaming state:
 *   [MatrixLogo animated ~20px] Thinking...          ← single step, collapsed
 *   [MatrixLogo animated ~20px] current step  [▼]    ← multi-step, expandable
 *     previous step 1 (faded)
 *     previous step 2 (faded)
 *     current active step (bright)
 *
 * Complete collapsed:
 *   ▶  Thought process  ·  N steps
 *
 * Complete expanded:
 *   ▼  Thought process  ·  N steps
 *     step 1
 *     step 2  ...
 */

"use client";

import { cn } from "@/lib/utils";
import { CaretRight, CaretDown } from '@phosphor-icons/react';
import { memo, useState } from "react";
import { MatrixLogo } from "@/components/ai-elements/MatrixLogo";

// ============================================================================
// Types
// ============================================================================

export interface ThoughtStep {
  type: "reasoning" | "search" | "file-read" | "file-write" | "command" | "agent" | "tool";
  summary: string;
  detail?: string;
  timestamp?: number;
  status?: "pending" | "running" | "completed";
  metadata?: {
    files?: string[];
    agents?: string[];
    commands?: string[];
    searchQuery?: string;
    results?: number;
  };
}

interface ThoughtTraceProps {
  steps: ThoughtStep[];
  isStreaming?: boolean;
  isComplete?: boolean;
  className?: string;
}

// ============================================================================
// Text helpers (unchanged — used by parseThoughtSteps below)
// ============================================================================

function truncateSummary(summary: string, maxLength = 96): string {
  const normalized = summary.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  const rough = normalized.slice(0, maxLength - 1);
  const lastSpace = rough.lastIndexOf(" ");
  const boundary = lastSpace > maxLength * 0.6 ? lastSpace : rough.length;
  return `${rough.slice(0, boundary).trimEnd()}…`;
}

function normalizeTraceSentence(sentence: string): string {
  return sentence.replace(/^[\s\-*•]+/, "").replace(/\s+/g, " ").trim();
}

function stripTracePrefix(sentence: string): string {
  let next = normalizeTraceSentence(sentence);
  const prefixes = [
    /^(?:the user (?:wants?|wanted|asked|is asking|needs?) (?:me )?to)\s+/i,
    /^(?:i (?:need|want|wanted|should|can|could|will)\s+to)\s+/i,
    /^(?:i['']ll|i am going to|i'm going to|let me)\s+/i,
    /^(?:now|next|then)\s+/i,
  ];
  let changed = true;
  while (changed) {
    changed = false;
    for (const prefix of prefixes) {
      const stripped = next.replace(prefix, "").trim();
      if (stripped !== next) { next = stripped; changed = true; }
    }
  }
  return next;
}

function extractQuotedLabel(sentence: string): string | null {
  const match = sentence.match(/[""]([^""]{3,64})[""]/);
  return match?.[1]?.trim() ?? null;
}

function summarizeSearchSentence(sentence: string): string {
  const normalized = normalizeTraceSentence(sentence);
  if (/ai-sdk\.dev\/docs/i.test(normalized)) return "Searching AI SDK docs";
  if (/\b(?:docs|documentation)\b/i.test(normalized))
    return /\b(?:code|coding)\b/i.test(normalized) ? "Searching coding docs" : "Searching documentation";
  const cleaned = stripTracePrefix(normalized)
    .replace(/^(?:web\s+search(?:\s+on)?|search(?:ing)?|look(?:ing)? up|find(?:ing)?|query(?:ing)?)\s+/i, "")
    .replace(/^(?:for|about|on|into|around|regarding)\s+/i, "")
    .replace(/^https?:\/\/\S+\s*(?:and\s+)?/i, "")
    .trim();
  if (!cleaned || /^(?:or|and|to|this|that|it)\b/i.test(cleaned)) return "Running search";
  return `Searched: ${truncateSummary(cleaned, 52)}`;
}

function summarizeReasoningSentence(sentence: string): string {
  const normalized = normalizeTraceSentence(sentence);
  const stripped = stripTracePrefix(normalized);
  const quoted = extractQuotedLabel(normalized);
  if (/what specific information would you like/i.test(normalized) || /what recommendation are you referring to/i.test(normalized))
    return "Clarifying request";
  if (/don't have context from a previous conversation|do not have context from a previous conversation/i.test(normalized))
    return "Missing prior context";
  if (/^the user (?:wants?|asked|is asking|needs?)/i.test(normalized))
    return "Understanding request";
  if (/looking at the docs|reviewing the docs|from the documentation/i.test(normalized)) {
    if (/most relevant feature/i.test(normalized) && quoted) return `Identified ${quoted} as best fit`;
    return "Reviewing documentation";
  }
  if (quoted && /\bsection\b/i.test(normalized) && /\b(?:covers|about|focused on|for)\b/i.test(normalized))
    return `Identified ${quoted} section as best fit`;
  if (/found (?:a )?key feature/i.test(normalized) && quoted) return `Found feature: ${quoted}`;
  if (/most relevant feature/i.test(normalized) && quoted) return `Identified ${quoted} as best fit`;
  if (/search more specifically|look for more specific/i.test(normalized)) return "Narrowing the search";
  if (/give a concise answer|answer in one sentence|reply with two words|two words plus a source/i.test(normalized))
    return "Preparing concise answer";
  return truncateSummary(stripped || normalized, 72);
}

function isLowSignalSummary(step: ThoughtStep): boolean {
  return step.summary === "Understanding request" || step.summary === "Running search";
}

function selectSummaryStep(steps: ThoughtStep[]): ThoughtStep {
  const preferredReasoning = [...steps].reverse().find(
    (step) => step.type === "reasoning" && !isLowSignalSummary(step)
  );
  if (preferredReasoning) return preferredReasoning;
  const preferredGeneric = [...steps].reverse().find((step) => !isLowSignalSummary(step));
  return preferredGeneric ?? steps[steps.length - 1] ?? steps[0];
}

// ============================================================================
// Type guards (used by coerceThoughtSteps)
// ============================================================================

function isThoughtStepType(value: unknown): value is ThoughtStep["type"] {
  return (
    value === "reasoning" || value === "search" || value === "file-read" ||
    value === "file-write" || value === "command" || value === "agent" || value === "tool"
  );
}

function isThoughtStepStatus(value: unknown): value is ThoughtStep["status"] {
  return value === "pending" || value === "running" || value === "completed";
}

function toStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const entries = value.filter((e): e is string => typeof e === "string");
  return entries.length > 0 ? entries : undefined;
}

export function coerceThoughtSteps(value: unknown): ThoughtStep[] {
  if (!Array.isArray(value)) return [];
  const results: ThoughtStep[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    if (!isThoughtStepType(record.type) || typeof record.summary !== "string") continue;
    const metadataRecord =
      record.metadata && typeof record.metadata === "object"
        ? (record.metadata as Record<string, unknown>)
        : undefined;
    const metadata = metadataRecord
      ? {
          files: toStringArray(metadataRecord.files),
          agents: toStringArray(metadataRecord.agents),
          commands: toStringArray(metadataRecord.commands),
          searchQuery: typeof metadataRecord.searchQuery === "string" ? metadataRecord.searchQuery : undefined,
          results: typeof metadataRecord.results === "number" ? metadataRecord.results : undefined,
        }
      : undefined;
    const normalizedMetadata =
      metadata && Object.values(metadata).some((e) => e !== undefined) ? metadata : undefined;
    results.push({
      type: record.type,
      summary: record.summary,
      detail: typeof record.detail === "string" ? record.detail : undefined,
      status: isThoughtStepStatus(record.status) ? record.status : undefined,
      metadata: normalizedMetadata,
    });
  }
  return results;
}

// ============================================================================
// Logo state — maps current step type → MatrixLogo animation state
// ============================================================================

function stepToLogoState(step: ThoughtStep | undefined): "thinking" | "listening" | "speaking" | "compacting" {
  if (!step) return "thinking";
  switch (step.type) {
    case "search":      return "thinking";
    case "file-read":   return "listening";
    case "file-write":  return "speaking";
    case "command":     return "compacting";
    case "agent":       return "thinking";
    default:            return "thinking";
  }
}

// ============================================================================
// ThoughtTrace component
// ============================================================================

export const ThoughtTrace = memo(({ steps, isStreaming = false, isComplete = false, className }: ThoughtTraceProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!steps || steps.length === 0) return null;

  const currentStep = steps[steps.length - 1];
  const prevSteps = steps.slice(0, -1).slice(-6); // at most 6 previous steps

  // ---------------------------------------------------------------------------
  // STREAMING — [MatrixLogo spinner] + label + optional expand
  // ---------------------------------------------------------------------------
  if (isStreaming && !isComplete) {
    const logoState = stepToLogoState(currentStep);
    // Header label: truncated current step summary (collapsed), or "Thinking" (expanded)
    const headerLabel = isExpanded ? "Thinking" : truncateSummary(currentStep.summary, 58) || "Thinking...";
    const canExpand = steps.length > 1;

    return (
      <div className={cn("my-2", className)} style={{ userSelect: 'none' }}>
        {/* ── Header row ── */}
        <button
          onClick={() => canExpand && setIsExpanded(e => !e)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'none',
            border: 'none',
            padding: '0',
            cursor: canExpand ? 'pointer' : 'default',
            textAlign: 'left',
            width: '100%',
            maxWidth: '100%',
          }}
        >
          {/* MatrixLogo IS the spinner — rendered at 48px internal, scaled to 20px visual */}
          <div style={{
            width: 20,
            height: 20,
            flexShrink: 0,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <div style={{
              transform: 'scale(0.417)',
              transformOrigin: 'center',
              width: 48,
              height: 48,
            }}>
              <MatrixLogo state={logoState} size={48} />
            </div>
          </div>

          <span style={{
            fontSize: '14px',
            color: 'rgba(236,236,236,0.62)',
            lineHeight: '20px',
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {headerLabel}
          </span>

          {canExpand && (
            <span style={{ color: 'rgba(255,255,255,0.25)', flexShrink: 0, lineHeight: '20px' }}>
              {isExpanded ? <CaretDown size={11} /> : <CaretRight size={11} />}
            </span>
          )}
        </button>

        {/* ── Expanded step list ── */}
        {isExpanded && canExpand && (
          <div style={{
            marginTop: '8px',
            paddingLeft: '28px',
            display: 'flex',
            flexDirection: 'column',
            gap: '5px',
          }}>
            {prevSteps.map((step, idx) => (
              <div key={idx} style={{
                fontSize: '13px',
                lineHeight: '1.5',
                color: 'rgba(236,236,236,0.35)',
              }}>
                {truncateSummary(step.summary, 90)}
              </div>
            ))}
            {/* Current active step — brighter */}
            <div style={{
              fontSize: '13px',
              lineHeight: '1.5',
              color: 'rgba(236,236,236,0.78)',
            }}>
              {truncateSummary(currentStep.summary, 110)}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // COMPLETE — COLLAPSED: ▶ Thought process · N steps
  // ---------------------------------------------------------------------------
  if (isComplete && !isStreaming && !isExpanded) {
    return (
      <div className={cn("my-1.5", className)}>
        <button
          onClick={() => setIsExpanded(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            background: 'none',
            border: 'none',
            padding: '2px 0',
            cursor: 'pointer',
          }}
        >
          <CaretRight size={11} style={{ color: 'rgba(255,255,255,0.28)', flexShrink: 0 }} />
          <span style={{ fontSize: '13px', color: 'rgba(236,236,236,0.48)', fontWeight: 400 }}>
            Thought process
          </span>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.20)' }}>
            · {steps.length} {steps.length === 1 ? 'step' : 'steps'}
          </span>
        </button>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // COMPLETE — EXPANDED: ▼ Thought process + clean indented list
  // ---------------------------------------------------------------------------
  if (isComplete && !isStreaming && isExpanded) {
    return (
      <div className={cn("my-2", className)}>
        <button
          onClick={() => setIsExpanded(false)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            background: 'none',
            border: 'none',
            padding: '2px 0',
            marginBottom: '10px',
            cursor: 'pointer',
          }}
        >
          <CaretDown size={11} style={{ color: 'rgba(255,255,255,0.38)', flexShrink: 0 }} />
          <span style={{ fontSize: '13px', color: 'rgba(236,236,236,0.55)', fontWeight: 400 }}>
            Thought process
          </span>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.22)' }}>
            · {steps.length} {steps.length === 1 ? 'step' : 'steps'}
          </span>
        </button>

        {/* Clean list — single left rule, no dots, no colored labels */}
        <div style={{
          paddingLeft: '16px',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}>
          {steps.map((step, idx) => (
            <div key={idx} style={{
              fontSize: '13px',
              lineHeight: '1.55',
              color: 'rgba(236,236,236,0.48)',
            }}>
              {truncateSummary(step.summary, 100)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
});

ThoughtTrace.displayName = "ThoughtTrace";

// ============================================================================
// parseThoughtSteps — raw thinking text → structured ThoughtStep[]
// ============================================================================

export function parseThoughtSteps(text: string): ThoughtStep[] {
  const steps: ThoughtStep[] = [];

  const readMatch = (sentence: string) =>
    sentence.match(/(?:read|open|load|import)[\s:]+(.+?\.(?:ts|tsx|js|jsx|py|json|md|css|html))/i);
  const writeMatch = (sentence: string) =>
    sentence.match(/(?:write|create|save|update|modify)[\s:]+(.+?\.(?:ts|tsx|js|jsx|py|json|md|css|html))/i);
  const commandMatch = (sentence: string) =>
    sentence.match(/(?:run|execute|command|terminal)[\s:]+`?([^`]+)`?/i);
  const agentMatch = (sentence: string) =>
    sentence.match(/(?:invoke|call|use)[\s:]+(?:agent|tool)[\s:]+(.+?)(?:\.|$)/i);

  const sentences = text.split(/(?<=[\.!?])\s+|\n+/).filter(s => s.trim().length > 0);

  for (const sentence of sentences) {
    let matched = false;
    const normalizedSentence = normalizeTraceSentence(sentence);
    if (normalizedSentence.length <= 10) continue;

    if (
      !/^the user\b/i.test(normalizedSentence) &&
      /\b(?:web\s+search|search(?:ing)?|look(?:ing)? up|find(?:ing)?|query(?:ing)?)\b/i.test(normalizedSentence)
    ) {
      steps.push({ type: "search", summary: summarizeSearchSentence(normalizedSentence), detail: normalizedSentence, status: "completed" });
      matched = true;
    } else {
      const read = readMatch(normalizedSentence);
      const write = writeMatch(normalizedSentence);
      const command = commandMatch(normalizedSentence);
      const agent = agentMatch(normalizedSentence);

      if (read) {
        steps.push({ type: "file-read", summary: `Read: ${read[1].trim()}`, detail: normalizedSentence, status: "completed" });
        matched = true;
      } else if (write) {
        steps.push({ type: "file-write", summary: `Updated: ${write[1].trim()}`, detail: normalizedSentence, status: "completed" });
        matched = true;
      } else if (command) {
        steps.push({ type: "command", summary: `Ran: ${command[1].trim()}`, detail: normalizedSentence, status: "completed" });
        matched = true;
      } else if (agent) {
        steps.push({ type: "agent", summary: `Used: ${agent[1].trim()}`, detail: normalizedSentence, status: "completed" });
        matched = true;
      }
    }

    if (!matched) {
      const previousStep = steps[steps.length - 1];
      if (previousStep?.type === "reasoning" && previousStep.detail && previousStep.detail.length < 320) {
        previousStep.detail = `${previousStep.detail} ${normalizedSentence}`.trim();
        previousStep.summary = summarizeReasoningSentence(previousStep.detail);
        continue;
      }
      steps.push({
        type: "reasoning",
        summary: summarizeReasoningSentence(normalizedSentence),
        detail: normalizedSentence,
        status: "completed",
      });
    }
  }

  return steps;
}
