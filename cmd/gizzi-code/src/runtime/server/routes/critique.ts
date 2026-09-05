import { Hono } from "hono"
import { streamSSE } from "hono/streaming"
import { describeRoute, resolver, validator } from "@/runtime/server/openapi"
import { errors } from "@/runtime/server/error"
import { Provider } from "@/runtime/providers/provider"
import { ProviderTransform } from "@/runtime/providers/adapters/transform"
import { Installation } from "@/shared/installation"
import { Log } from "@/shared/util/log"
import z from "zod/v4"

const log = Log.create({ service: "critique" })

// ── Schemas ───────────────────────────────────────────────────────────────────

const DimensionSchema = z.object({
  name: z.string(),
  score: z.number().min(0).max(10),
  severity: z.enum(["info", "minor", "major", "critical"]),
  findings: z.array(z.string()),
})

const PanelistCritiqueSchema = z.object({
  role: z.string(),
  verdict: z.enum(["ship", "iterate"]),
  overall: z.number().min(0).max(10),
  dimensions: z.array(DimensionSchema),
  suggestions: z.array(z.string()),
  summary: z.string(),
})

const CritiqueRequest = z.object({
  html: z.string().min(1).max(400_000),
  providerID: z.string().optional(),
  modelID: z.string().optional(),
  panelists: z.number().int().min(1).max(5).default(3),
  sessionID: z.string().optional(),
})

const PublicPanelistSchema = PanelistCritiqueSchema.extend({
  error: z.string().optional(),
})

const CritiqueResponseSchema = z.object({
  runId: z.string(),
  sessionID: z.string().optional(),
  model: z.object({
    providerID: z.string(),
    modelID: z.string(),
  }),
  verdict: z.enum(["ship", "iterate"]),
  overall: z.number(),
  dimensions: z.array(z.object({
    name: z.string(),
    score: z.number(),
    severity: z.string(),
    findings: z.array(z.object({
      role: z.string(),
      text: z.string(),
    })),
  })),
  suggestions: z.array(z.object({
    role: z.string(),
    text: z.string(),
  })),
  panelists: z.array(PublicPanelistSchema),
  summary: z.string(),
})

const CritiqueStreamEventSchema = z.object({
  payload: z.object({
    type: z.string(),
    properties: z.record(z.string(), z.unknown()),
  }),
})

// ── Panelist roster (roles only — the brain produces all findings) ────────────
// Each persona is a system-prompt stance; the configured model generates every
// score/finding/suggestion. We orchestrate + aggregate; we do not invent data.

interface Panelist {
  role: string
  dimensions: string[]
  stance: string
}

const PANELISTS: Panelist[] = [
  {
    role: "Accessibility",
    dimensions: ["Accessibility", "Semantics", "Keyboard & screen-reader"],
    stance:
      "You are an accessibility specialist reviewing a web artifact. Judge WCAG conformance, semantic HTML, focus/keyboard support, color contrast, and screen-reader experience.",
  },
  {
    role: "Visual design",
    dimensions: ["Visual hierarchy", "Spacing & rhythm", "Color & typography"],
    stance:
      "You are a senior visual designer reviewing a web artifact. Judge visual hierarchy, spacing and layout rhythm, color palette, and typographic quality.",
  },
  {
    role: "UX & interaction",
    dimensions: ["Interaction", "Feedback & states", "Flow clarity"],
    stance:
      "You are a UX engineer reviewing a web artifact. Judge interaction quality, hover/focus/loading/error states, and clarity of the user flow.",
  },
  {
    role: "Content & clarity",
    dimensions: ["Content clarity", "Copy quality", "Information architecture"],
    stance:
      "You are a content strategist reviewing a web artifact. Judge clarity of copy, scannability, and whether the information architecture serves the goal.",
  },
  {
    role: "Responsive & performance",
    dimensions: ["Responsiveness", "Cross-device", "Performance hints"],
    stance:
      "You are a front-end performance engineer reviewing a web artifact. Judge responsive behavior across viewports and obvious performance risks.",
  },
]

const MAX_HTML_CHARS = 120_000

function buildPrompt(panelist: Panelist, html: string) {
  const truncated = html.length > MAX_HTML_CHARS
  const body = truncated ? html.slice(0, MAX_HTML_CHARS) : html
  const system = `${panelist.stance}

You must return ONLY a single JSON object (no prose, no markdown code fences, no comments) with exactly this shape:
{
  "role": "${panelist.role}",
  "verdict": "ship" | "iterate",
  "overall": <number 0-10>,
  "dimensions": [ { "name": "<dimension>", "score": <number 0-10>, "severity": "info"|"minor"|"major"|"critical", "findings": ["<specific finding citing the artifact>"] } ],
  "suggestions": ["<concrete, actionable suggestion>"],
  "summary": "<1-2 sentence summary>"
}
Be specific: cite concrete elements, classes, or snippets from the artifact in every finding. No generic advice.

Scoring: 0 = broken/missing, 10 = excellent. verdict = "ship" only if overall >= 8 and there are no critical findings; otherwise "iterate".

Score these dimensions for your role: ${panelist.dimensions.join(", ")}.

Example of the exact output format (use double-quoted keys, real values from THIS artifact):
{"role":"${panelist.role}","verdict":"iterate","overall":4.5,"dimensions":[{"name":"${panelist.dimensions[0]}","score":3,"severity":"major","findings":["<finding about a concrete element in the artifact>"]}],"suggestions":["<actionable fix>"],"summary":"<one sentence>"}`
  const user = `Design artifact (HTML) to critique${truncated ? ` — truncated to ${MAX_HTML_CHARS} chars` : ""}:

\`\`\`html
${body}
\`\`\`

Return the structured critique now.`
  return { system, user }
}

// ── Aggregation ───────────────────────────────────────────────────────────────

type PanelistOut = z.infer<typeof PanelistCritiqueSchema> & { error?: string }

function aggregate(panelists: PanelistOut[]) {
  const ok = panelists.filter((p) => !p.error)
  const byDim = new Map<string, { scores: number[]; severity: string; findings: { role: string; text: string }[] }>()
  const suggestions: { role: string; text: string }[] = []
  let overallSum = 0
  let hasCritical = false

  for (const p of ok) {
    overallSum += p.overall
    for (const s of p.suggestions) suggestions.push({ role: p.role, text: s })
    for (const d of p.dimensions) {
      if (d.severity === "critical") hasCritical = true
      const slot = byDim.get(d.name) ?? { scores: [], severity: d.severity, findings: [] }
      slot.scores.push(d.score)
      if (sevRank(d.severity) > sevRank(slot.severity)) slot.severity = d.severity
      for (const f of d.findings) slot.findings.push({ role: p.role, text: f })
      byDim.set(d.name, slot)
    }
  }

  const dimensions = Array.from(byDim.entries()).map(([name, v]) => ({
    name,
    score: v.scores.length ? Math.round((v.scores.reduce((a, b) => a + b, 0) / v.scores.length) * 10) / 10 : 0,
    severity: v.severity,
    findings: v.findings,
  }))

  const overall = ok.length ? Math.round((overallSum / ok.length) * 10) / 10 : 0
  const allShip = ok.length > 0 && ok.every((p) => p.verdict === "ship")
  const verdict: "ship" | "iterate" = allShip && overall >= 8 && !hasCritical ? "ship" : "iterate"

  // Dedupe suggestions by text, keep first role attribution, cap.
  const seen = new Set<string>()
  const uniqueSuggestions: { role: string; text: string }[] = []
  for (const s of suggestions) {
    const k = s.text.trim().toLowerCase()
    if (!k || seen.has(k)) continue
    seen.add(k)
    uniqueSuggestions.push(s)
    if (uniqueSuggestions.length >= 12) break
  }

  return { verdict, overall, dimensions, suggestions: uniqueSuggestions, hasCritical }
}

function sevRank(s: string): number {
  return { info: 0, minor: 1, major: 2, critical: 3 }[s] ?? 0
}

const PANELIST_TIMEOUT_MS = 90_000

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
  })
  try {
    return await Promise.race([p, timeout])
  } finally {
    if (t) clearTimeout(t)
  }
}

// Subprocess/text brains (claude-cli, qwen-cli, codex-cli, ollama) emit
// conversational text — often wrapping JSON in prose or ``` fences. Extract the
// outermost balanced JSON object, then validate strictly. We never fabricate or
// coerce fields; zod validation still rejects malformed output.
function extractJsonObject(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
  const start = trimmed.indexOf("{")
  if (start === -1) {
    const snippet = trimmed.slice(0, 200).replace(/\s+/g, " ")
    throw new Error(`no JSON object in response (len=${text.length}; model said: ${snippet})`)
  }
  let depth = 0
  let inStr = false
  let esc = false
  for (let i = start; i < trimmed.length; i++) {
    const ch = trimmed[i]
    if (inStr) {
      if (esc) esc = false
      else if (ch === "\\") esc = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') inStr = true
    else if (ch === "{") depth++
    else if (ch === "}") {
      depth--
      if (depth === 0) return JSON.parse(trimmed.slice(start, i + 1))
    }
  }
  throw new Error("unterminated JSON object in response")
}

// ── Engine (shared by JSON + SSE routes) ──────────────────────────────────────

type ModelRef = { providerID: string; modelID: string; model: Provider.Model }
type CritiqueBody = z.infer<typeof CritiqueRequest>

async function resolveModelRef(body: CritiqueBody): Promise<ModelRef> {
  const ref =
    body.providerID && body.modelID
      ? { providerID: body.providerID, modelID: body.modelID }
      : await Provider.defaultModelConcrete()
  const model = await Provider.getModel(ref.providerID, ref.modelID)
  return { providerID: model.providerID, modelID: model.id, model }
}

// Builds the model-call context. Reuses gizzi's proven pipeline (runtime/session/llm.ts):
// the wrapLanguageModel middleware runs ProviderTransform.message on the stream prompt —
// without it, subprocess/CLI and openai-compatible brains return empty text.
async function buildCallCtx(modelRef: ModelRef) {
  const { streamText, wrapLanguageModel } = await import("ai")
  const language = await Provider.getLanguage(modelRef.model)
  const wrappedModel = wrapLanguageModel({
    model: language as any,
    middleware: [
      {
        specificationVersion: "v3" as const,
        async transformParams(args: { type: string; params: any }) {
          if (args.type === "stream") {
            args.params.prompt = ProviderTransform.message(args.params.prompt, modelRef.model, {})
          }
          return args.params
        },
      } as any,
    ],
  })
  return {
    streamText,
    wrappedModel,
    maxOutputTokens: ProviderTransform.maxOutputTokens(modelRef.model),
    providerOptions: ProviderTransform.providerOptions(modelRef.model, {}),
    headers: modelRef.model.providerID.startsWith("gizzi")
      ? undefined
      : { "User-Agent": `gizzi/${Installation.VERSION}`, ...(modelRef.model.headers ?? {}) },
  }
}

type CallCtx = Awaited<ReturnType<typeof buildCallCtx>>

async function runPanelist(panelist: Panelist, html: string, ctx: CallCtx): Promise<PanelistOut> {
  const { system, user } = buildPrompt(panelist, html)
  try {
    const stream = ctx.streamText({
      model: ctx.wrappedModel,
      maxOutputTokens: ctx.maxOutputTokens,
      temperature: 0,
      maxRetries: 0,
      providerOptions: ctx.providerOptions,
      headers: ctx.headers,
      // Single user turn by design: gizzi's CLI/subprocess adapter
      // (runtime/providers/adapters/loaders/subprocess.ts extractLastUserText)
      // forwards only the LAST user message and drops the system prompt. The
      // JSON-shape instructions live in `system`, so we fold them into the user
      // turn — otherwise claude/codex/kimi CLI brains never see the schema and
      // return free-form text. API providers handle an instruction-bearing user
      // message equally well, so one unified turn works for every brain.
      messages: [
        { role: "user", content: `${system}\n\n${user}` },
      ],
      experimental_telemetry: { isEnabled: false },
    })
    const text = await withTimeout(
      (async () => {
        let t = ""
        let streamErr = ""
        let finishReason = ""
        for await (const part of stream.fullStream) {
          if (part.type === "text-delta") t += (part as any).text ?? ""
          else if (part.type === "error") {
            const e = (part as any).error
            streamErr = (e?.message ?? String(e ?? "")).slice(0, 300)
          } else if (part.type === "finish") finishReason = (part as any).finishReason ?? ""
        }
        // If the brain produced no text but the stream reported an error (e.g. a
        // CLI subprocess exiting "Failed to authenticate (401)"), surface THAT as
        // the panelist error instead of a misleading "no JSON object".
        if (!t.trim() && (streamErr || finishReason === "error")) {
          throw new Error(streamErr || "brain stream ended with an error")
        }
        return t
      })(),
      PANELIST_TIMEOUT_MS,
      panelist.role,
    )
    const parsed = extractJsonObject(text)
    const validated = PanelistCritiqueSchema.safeParse(parsed)
    if (!validated.success) {
      throw new Error(`schema mismatch: ${validated.error.issues.map((i) => i.message).join("; ").slice(0, 200)}`)
    }
    return { ...validated.data, role: panelist.role }
  } catch (e) {
    log.warn("critique: panelist failed", { role: panelist.role, error: String(e) })
    return {
      role: panelist.role,
      verdict: "iterate" as const,
      overall: 0,
      dimensions: [],
      suggestions: [],
      summary: "",
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

function publicPanelist(r: PanelistOut) {
  return {
    role: r.role,
    verdict: r.verdict,
    overall: r.overall,
    dimensions: r.dimensions,
    suggestions: r.suggestions,
    summary: r.summary,
    ...(r.error ? { error: r.error } : {}),
  }
}

const NO_BRAIN_MSG =
  "No brain configured. Set up a provider in Settings (Ollama, OpenAI, Allternit, or a CLI brain) and retry."

// ── Route ─────────────────────────────────────────────────────────────────────

export const CritiqueRoutes = () =>
  new Hono()
    .post(
      "/",
      describeRoute({
        summary: "Run a design critique",
        description:
          "Runs a multi-panelist critique of a design artifact through the configured brain. " +
          "Each panelist is a reviewer persona; the model generates all scores, findings, and suggestions. " +
          "Provider-agnostic: works with Ollama, OpenAI, Allternit, and CLI subprocess brains.",
        operationId: "critique.run",
        responses: {
          200: {
            description: "Aggregated critique",
            content: { "application/json": { schema: resolver(CritiqueResponseSchema) } },
          },
          ...errors(400, 503),
        },
      }),
      validator("json", CritiqueRequest),
      async (c) => {
        const body = c.req.valid("json")

        let modelRef: ModelRef
        try {
          modelRef = await resolveModelRef(body)
        } catch (e) {
          log.warn("critique: no model available", { error: String(e) })
          return c.json({ error: NO_BRAIN_MSG }, 503)
        }

        const roster = PANELISTS.slice(0, body.panelists)
        const runId = `crt_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`
        const ctx = await buildCallCtx(modelRef)
        const results: PanelistOut[] = await Promise.all(roster.map((p) => runPanelist(p, body.html, ctx)))

        const agg = aggregate(results)
        const usable = results.filter((r) => !r.error)

        return c.json({
          runId,
          sessionID: body.sessionID,
          model: { providerID: modelRef.providerID, modelID: modelRef.modelID },
          verdict: agg.verdict,
          overall: agg.overall,
          dimensions: agg.dimensions,
          suggestions: agg.suggestions,
          panelists: results.map(publicPanelist),
          summary: usable.length
            ? `${usable.length}/${results.length} panelists · verdict ${agg.verdict} · overall ${agg.overall}/10`
            : "All panelists failed to produce a critique — see panelists[].error.",
        })
      },
    )
    .post(
      "/stream",
      describeRoute({
        summary: "Stream a design critique",
        description:
          "SSE variant of the critique engine. Emits critique.start, one critique.panelist event per " +
          "panelist as it completes, and a final critique.done with the aggregated ship/iterate verdict.",
        operationId: "critique.stream",
        responses: {
          200: { description: "Event stream", content: { "text/event-stream": { schema: resolver(CritiqueStreamEventSchema) } } },
          ...errors(400, 503),
        },
      }),
      validator("json", CritiqueRequest),
      async (c) => {
        const body = c.req.valid("json")
        c.header("X-Accel-Buffering", "no")
        c.header("X-Content-Type-Options", "nosniff")
        return streamSSE(c, async (stream) => {
          const send = (type: string, properties: Record<string, unknown>) =>
            stream.writeSSE({ data: JSON.stringify({ payload: { type, properties } }) })

          let modelRef: ModelRef
          try {
            modelRef = await resolveModelRef(body)
          } catch (e) {
            await send("critique.error", { message: NO_BRAIN_MSG })
            return
          }

          const roster = PANELISTS.slice(0, body.panelists)
          const runId = `crt_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`
          await send("critique.start", {
            runId,
            sessionID: body.sessionID,
            model: { providerID: modelRef.providerID, modelID: modelRef.modelID },
            panelists: roster.map((p) => p.role),
          })

          const ctx = await buildCallCtx(modelRef)
          // Run in parallel; emit each panelist event as soon as it resolves.
          const results: PanelistOut[] = await Promise.all(
            roster.map(async (p) => {
              const r = await runPanelist(p, body.html, ctx)
              await send("critique.panelist", { runId, panelist: publicPanelist(r) })
              return r
            }),
          )

          const agg = aggregate(results)
          const usable = results.filter((r) => !r.error)
          await send("critique.done", {
            runId,
            verdict: agg.verdict,
            overall: agg.overall,
            dimensions: agg.dimensions,
            suggestions: agg.suggestions,
            summary: usable.length
              ? `${usable.length}/${results.length} panelists · verdict ${agg.verdict} · overall ${agg.overall}/10`
              : "All panelists failed to produce a critique — see panelists[].error.",
          })
        })
      },
    )
