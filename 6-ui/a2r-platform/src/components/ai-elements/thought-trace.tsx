/**
 * Thought Trace — Clean timeline of reasoning steps
 *
 * Design principles:
 * - No pill boxes, no heavy borders — natural typography
 * - Vertical connecting line links all steps
 * - Text-first: readable 13px summaries, 11px labels
 * - Streaming: shows current step live, previous steps faded above
 * - Complete collapsed: single compact summary line
 * - Complete expanded: full timeline with status markers
 */

"use client";

import { cn } from "@/lib/utils";
import { ChevronRight, ChevronDown } from "lucide-react";
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
// Constants
// ============================================================================

const stepLabel: Record<ThoughtStep["type"], string> = {
  reasoning: "Reasoning",
  search: "Searching",
  "file-read": "Reading",
  "file-write": "Writing",
  command: "Running",
  agent: "Agent",
  tool: "Tool",
};

// Accent colour per step type — used for the small label only
const stepTone: Record<ThoughtStep["type"], string> = {
  reasoning:  "text-[#C9B0F0]",
  search:     "text-[#7EC8FF]",
  "file-read":"text-[#7FD9A8]",
  "file-write":"text-[#F0C47B]",
  command:    "text-[#F2A97A]",
  agent:      "text-[#F3A8D7]",
  tool:       "text-[#7FD7D5]",
};

// ============================================================================
// Text helpers (preserved from original — used in UnifiedMessageRenderer)
// ============================================================================

function truncateSummary(summary: string, maxLength = 96): string {
  const normalized = summary.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  // Truncate at word boundary so we don't cut mid-word
  const rough = normalized.slice(0, maxLength - 1);
  const lastSpace = rough.lastIndexOf(" ");
  // Only snap to word boundary if it's not too far back (>60% of max)
  const boundary = lastSpace > maxLength * 0.6 ? lastSpace : rough.length;
  return `${rough.slice(0, boundary).trimEnd()}…`;
}

function normalizeTraceSentence(sentence: string): string {
  return sentence
    .replace(/^[\s\-*•]+/, "")
    .replace(/\s+/g, " ")
    .trim();
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
// Sub-components
// ============================================================================

/** A single dot on the timeline */
function StepDot({ active = false, complete = false }: { active?: boolean; complete?: boolean }) {
  if (active) {
    return (
      <span
        style={{
          display: 'inline-block',
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: '#D4B08C',
          boxShadow: '0 0 0 3px rgba(212,176,140,0.15)',
          flexShrink: 0,
        }}
      />
    );
  }
  return (
    <span
      style={{
        display: 'inline-block',
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        background: complete ? 'rgba(74,222,128,0.45)' : 'rgba(255,255,255,0.22)',
        flexShrink: 0,
      }}
    />
  );
}

/** One row in the timeline */
function TimelineRow({
  step,
  active = false,
  showDetail = false,
}: {
  step: ThoughtStep;
  active?: boolean;
  showDetail?: boolean;
}) {
  const labelColor = stepTone[step.type];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', minWidth: 0 }}>
        {/* Label */}
        <span
          className={cn("flex-shrink-0", labelColor)}
          style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', lineHeight: '20px' }}
        >
          {stepLabel[step.type]}
        </span>
        {/* Summary */}
        <span
          style={{
            fontSize: '13px',
            lineHeight: '20px',
            color: active ? 'rgba(236,236,236,0.88)' : 'rgba(236,236,236,0.62)',
            flex: 1,
            minWidth: 0,
            wordBreak: 'break-word',
          }}
        >
          {truncateSummary(step.summary, active ? 140 : 90)}
        </span>
        {/* Complete check */}
        {!active && (
          <span style={{ fontSize: '10px', color: 'rgba(74,222,128,0.5)', flexShrink: 0, lineHeight: '20px' }}>✓</span>
        )}
      </div>
      {/* Detail line (shown in expanded or active) */}
      {showDetail && step.detail && step.detail !== step.summary && (
        <div style={{ paddingLeft: '52px', fontSize: '12px', color: 'rgba(236,236,236,0.38)', lineHeight: '1.5' }}>
          {step.detail.length > 180 ? step.detail.slice(0, 180) + '…' : step.detail}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main component
// ============================================================================

export const ThoughtTrace = memo(({ steps, isStreaming = false, isComplete = false, className }: ThoughtTraceProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!steps || steps.length === 0) return null;

  // ---------------------------------------------------------------------------
  // STREAMING MODE — current step live, previous steps faded above it
  // ---------------------------------------------------------------------------
  if (isStreaming && !isComplete) {
    const prevSteps = steps.slice(0, -1);
    const currentStep = steps[steps.length - 1];
    // Show last 3 previous steps max to keep it concise
    const visiblePrev = prevSteps.slice(-3);

    return (
      <div className={cn("my-2", className)} style={{ userSelect: 'none' }}>
        <div style={{ position: 'relative', paddingLeft: '16px' }}>
          {/* Vertical line */}
          {(visiblePrev.length > 0) && (
            <div
              style={{
                position: 'absolute',
                left: '3px',
                top: 0,
                bottom: 0,
                width: '1px',
                background: 'rgba(255,255,255,0.09)',
              }}
            />
          )}

          {/* Previous steps — faded */}
          {visiblePrev.map((step, idx) => (
            <div
              key={idx}
              style={{
                position: 'relative',
                marginBottom: '6px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
              }}
            >
              {/* Dot aligned with line */}
              <div style={{ position: 'absolute', left: '-14px', top: '6px' }}>
                <StepDot complete />
              </div>
              <TimelineRow step={step} active={false} />
            </div>
          ))}

          {/* Current active step — MatrixLogo moves here to follow the trace */}
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
            }}
          >
            {/* MatrixLogo replaces the dot on the active step */}
            <div style={{ position: 'absolute', left: '-17px', top: '2px' }}>
              <MatrixLogo state="thinking" size={14} />
            </div>
            <TimelineRow step={currentStep} active showDetail />
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // COMPLETE — COLLAPSED: single summary line
  // ---------------------------------------------------------------------------
  if (isComplete && !isStreaming && !isExpanded) {
    const summaryStep = selectSummaryStep(steps);
    return (
      <div className={cn("my-1.5", className)}>
        <button
          onClick={() => setIsExpanded(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'none',
            border: 'none',
            padding: '2px 0',
            cursor: 'pointer',
            textAlign: 'left',
            maxWidth: '100%',
          }}
        >
          <ChevronRight
            size={11}
            style={{ color: 'rgba(255,255,255,0.28)', flexShrink: 0, transition: 'color 0.15s' }}
          />
          {/* Step count badge */}
          <span style={{
            fontSize: '10px',
            fontWeight: 700,
            color: 'rgba(212,176,140,0.55)',
            letterSpacing: '0.08em',
            flexShrink: 0,
          }}>
            {steps.length} steps
          </span>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.18)', flexShrink: 0 }}>—</span>
          {/* Best summary */}
          <span style={{
            fontSize: '13px',
            color: 'rgba(236,236,236,0.48)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {truncateSummary(summaryStep?.summary ?? "Thinking complete", 80)}
          </span>
        </button>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // COMPLETE — EXPANDED: full timeline
  // ---------------------------------------------------------------------------
  if (isComplete && !isStreaming && isExpanded) {
    return (
      <div className={cn("my-3", className)}>
        {/* Header / collapse button */}
        <button
          onClick={() => setIsExpanded(false)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'none',
            border: 'none',
            padding: '2px 0',
            marginBottom: '10px',
            cursor: 'pointer',
          }}
        >
          <ChevronDown size={11} style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
          <span style={{
            fontSize: '10px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: 'rgba(255,255,255,0.38)',
          }}>
            Thought trace · {steps.length} steps
          </span>
        </button>

        {/* Timeline */}
        <div style={{ position: 'relative', paddingLeft: '16px' }}>
          {/* Vertical connecting line */}
          <div
            style={{
              position: 'absolute',
              left: '3px',
              top: '6px',
              bottom: '6px',
              width: '1px',
              background: 'rgba(255,255,255,0.10)',
            }}
          />

          {steps.map((step, idx) => {
            const isLast = idx === steps.length - 1;
            return (
              <div
                key={idx}
                style={{
                  position: 'relative',
                  marginBottom: isLast ? 0 : '10px',
                  paddingBottom: isLast ? 0 : '2px',
                }}
              >
                {/* Dot on the line */}
                <div style={{ position: 'absolute', left: '-14px', top: '6px' }}>
                  <StepDot complete />
                </div>

                {/* Step content */}
                <TimelineRow step={step} active={false} showDetail />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
});

ThoughtTrace.displayName = "ThoughtTrace";

// ============================================================================
// parseThoughtSteps — convert raw thinking text to structured steps
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
