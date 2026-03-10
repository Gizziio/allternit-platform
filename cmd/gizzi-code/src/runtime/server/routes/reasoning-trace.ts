type ReasoningTraceStepType =
  | "reasoning"
  | "search"
  | "file-read"
  | "file-write"
  | "command"
  | "agent"
  | "tool"

type ReasoningTraceStepStatus = "pending" | "running" | "completed"

type ReasoningTraceStepMetadata = {
  files?: string[]
  agents?: string[]
  commands?: string[]
  searchQuery?: string
  results?: number
}

export type ReasoningTraceStep = {
  type: ReasoningTraceStepType
  summary: string
  detail?: string
  status?: ReasoningTraceStepStatus
  metadata?: ReasoningTraceStepMetadata
}

export type ReasoningTrace = {
  version: 1
  source: "backend"
  headline: string
  steps: ReasoningTraceStep[]
}

function truncateSummary(summary: string, maxLength = 96): string {
  const normalized = summary.replace(/\s+/g, " ").trim()
  if (normalized.length <= maxLength) {
    return normalized
  }
  return `${normalized.slice(0, maxLength - 1).trimEnd()}...`
}

function normalizeTraceSentence(sentence: string): string {
  return sentence
    .replace(/^[\s\-*]+/, "")
    .replace(/\s+/g, " ")
    .trim()
}

function stripTracePrefix(sentence: string): string {
  let next = normalizeTraceSentence(sentence)
  const prefixes = [
    /^(?:the user (?:wants?|wanted|asked|is asking|needs?) (?:me )?to)\s+/i,
    /^(?:i (?:need|want|wanted|should|can|could|will)\s+to)\s+/i,
    /^(?:i'll|i am going to|i'm going to|let me)\s+/i,
    /^(?:now|next|then)\s+/i,
  ]

  let changed = true
  while (changed) {
    changed = false
    for (const prefix of prefixes) {
      const stripped = next.replace(prefix, "").trim()
      if (stripped !== next) {
        next = stripped
        changed = true
      }
    }
  }

  return next
}

function extractQuotedLabel(sentence: string): string | null {
  const match = sentence.match(/"([^"]{3,64})"/)
  return match?.[1]?.trim() ?? null
}

function summarizeSearchSentence(sentence: string): string {
  const normalized = normalizeTraceSentence(sentence)
  if (/ai-sdk\.dev\/docs/i.test(normalized)) {
    return "Searching AI SDK docs"
  }
  if (/\b(?:docs|documentation)\b/i.test(normalized)) {
    return /\b(?:code|coding)\b/i.test(normalized)
      ? "Searching coding docs"
      : "Searching documentation"
  }

  const cleaned = stripTracePrefix(normalized)
    .replace(/^(?:web\s+search(?:\s+on)?|search(?:ing)?|look(?:ing)? up|find(?:ing)?|query(?:ing)?)\s+/i, "")
    .replace(/^(?:for|about|on|into|around|regarding)\s+/i, "")
    .replace(/^https?:\/\/\S+\s*(?:and\s+)?/i, "")
    .trim()

  if (!cleaned || /^(?:or|and|to|this|that|it)\b/i.test(cleaned)) {
    return "Running search"
  }

  return `Searched: ${truncateSummary(cleaned, 52)}`
}

function summarizeReasoningSentence(sentence: string): string {
  const normalized = normalizeTraceSentence(sentence)
  const stripped = stripTracePrefix(normalized)
  const quoted = extractQuotedLabel(normalized)

  if (
    /what specific information would you like/i.test(normalized) ||
    /what recommendation are you referring to/i.test(normalized)
  ) {
    return "Clarifying request"
  }

  if (/don't have context from a previous conversation|do not have context from a previous conversation/i.test(normalized)) {
    return "Missing prior context"
  }

  if (/^the user (?:wants?|asked|is asking|needs?)/i.test(normalized)) {
    return "Understanding request"
  }

  if (/looking at the docs|reviewing the docs|from the documentation/i.test(normalized)) {
    if (/most relevant feature/i.test(normalized) && quoted) {
      return `Identified ${quoted} as best fit`
    }
    return "Reviewing documentation"
  }

  if (quoted && /\bsection\b/i.test(normalized) && /\b(?:covers|about|focused on|for)\b/i.test(normalized)) {
    return `Identified ${quoted} section as best fit`
  }

  if (/found (?:a )?key feature/i.test(normalized) && quoted) {
    return `Found feature: ${quoted}`
  }

  if (/most relevant feature/i.test(normalized) && quoted) {
    return `Identified ${quoted} as best fit`
  }

  if (/search more specifically|look for more specific/i.test(normalized)) {
    return "Narrowing the search"
  }

  if (/give a concise answer|answer in one sentence|reply with two words|two words plus a source/i.test(normalized)) {
    return "Preparing concise answer"
  }

  return truncateSummary(stripped || normalized, 72)
}

function isLowSignalSummary(step: ReasoningTraceStep): boolean {
  return step.summary === "Understanding request" || step.summary === "Running search"
}

function selectSummaryStep(steps: ReasoningTraceStep[]): ReasoningTraceStep {
  const preferredReasoning = [...steps]
    .reverse()
    .find((step) => step.type === "reasoning" && !isLowSignalSummary(step))
  if (preferredReasoning) {
    return preferredReasoning
  }

  const preferredGeneric = [...steps].reverse().find((step) => !isLowSignalSummary(step))
  return preferredGeneric ?? steps[steps.length - 1] ?? steps[0]
}

function parseReasoningTraceSteps(text: string): ReasoningTraceStep[] {
  const steps: ReasoningTraceStep[] = []
  const readMatch = (sentence: string) =>
    sentence.match(/(?:read|open|load|import)[\s:]+(.+?\.(?:ts|tsx|js|jsx|py|json|md|css|html))/i)
  const writeMatch = (sentence: string) =>
    sentence.match(/(?:write|create|save|update|modify)[\s:]+(.+?\.(?:ts|tsx|js|jsx|py|json|md|css|html))/i)
  const commandMatch = (sentence: string) =>
    sentence.match(/(?:run|execute|command|terminal)[\s:]+`?([^`]+)`?/i)
  const agentMatch = (sentence: string) =>
    sentence.match(/(?:invoke|call|use)[\s:]+(?:agent|tool)[\s:]+(.+?)(?:\.|$)/i)

  const sentences = text
    .split(/(?<=[.!?])\s+|\n+/)
    .filter((sentence) => sentence.trim().length > 0)

  for (const sentence of sentences) {
    let matched = false
    const normalizedSentence = normalizeTraceSentence(sentence)
    if (normalizedSentence.length <= 10) {
      continue
    }

    if (
      !/^the user\b/i.test(normalizedSentence) &&
      /\b(?:web\s+search|search(?:ing)?|look(?:ing)? up|find(?:ing)?|query(?:ing)?)\b/i.test(normalizedSentence)
    ) {
      const cleaned = stripTracePrefix(normalizedSentence)
        .replace(/^(?:web\s+search(?:\s+on)?|search(?:ing)?|look(?:ing)? up|find(?:ing)?|query(?:ing)?)\s+/i, "")
        .replace(/^(?:for|about|on|into|around|regarding)\s+/i, "")
        .trim()

      steps.push({
        type: "search",
        summary: summarizeSearchSentence(normalizedSentence),
        detail: normalizedSentence,
        status: "completed",
        metadata: cleaned
          ? {
              searchQuery: truncateSummary(cleaned, 72),
            }
          : undefined,
      })
      matched = true
    } else {
      const read = readMatch(normalizedSentence)
      const write = writeMatch(normalizedSentence)
      const command = commandMatch(normalizedSentence)
      const agent = agentMatch(normalizedSentence)

      if (read) {
        const file = read[1].trim()
        steps.push({
          type: "file-read",
          summary: `Read: ${file}`,
          detail: normalizedSentence,
          status: "completed",
          metadata: { files: [file] },
        })
        matched = true
      } else if (write) {
        const file = write[1].trim()
        steps.push({
          type: "file-write",
          summary: `Updated: ${file}`,
          detail: normalizedSentence,
          status: "completed",
          metadata: { files: [file] },
        })
        matched = true
      } else if (command) {
        const executed = command[1].trim()
        steps.push({
          type: "command",
          summary: `Ran: ${executed}`,
          detail: normalizedSentence,
          status: "completed",
          metadata: { commands: [executed] },
        })
        matched = true
      } else if (agent) {
        const used = agent[1].trim()
        steps.push({
          type: "agent",
          summary: `Used: ${used}`,
          detail: normalizedSentence,
          status: "completed",
          metadata: { agents: [used] },
        })
        matched = true
      }
    }

    if (!matched) {
      const previousStep = steps[steps.length - 1]
      if (previousStep?.type === "reasoning" && previousStep.detail && previousStep.detail.length < 320) {
        previousStep.detail = `${previousStep.detail} ${normalizedSentence}`.trim()
        previousStep.summary = summarizeReasoningSentence(previousStep.detail)
        continue
      }

      steps.push({
        type: "reasoning",
        summary: summarizeReasoningSentence(normalizedSentence),
        detail: normalizedSentence,
        status: "completed",
      })
    }
  }

  return steps
}

export function buildReasoningTrace(text: string): ReasoningTrace | undefined {
  const normalized = typeof text === "string" ? text.trim() : ""
  if (!normalized) {
    return undefined
  }

  const steps = parseReasoningTraceSteps(normalized)
  if (steps.length === 0) {
    return undefined
  }

  return {
    version: 1,
    source: "backend",
    headline: truncateSummary(selectSummaryStep(steps)?.summary ?? "Thinking", 78),
    steps,
  }
}
