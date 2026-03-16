/**
 * Skills 2.0 Evaluator
 *
 * Runs a skill N times in parallel with a test input,
 * scores each run against rubric criteria, and returns
 * a structured EvalReport.
 */
import { Log } from "@/shared/util/log"
import { Skill } from "@/runtime/skills/skill"

const log = Log.create({ service: "skill-evaluator" })

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface EvalCriteria {
  id: string
  description: string
  weight?: number  // 0–1, default 1
}

export interface EvalRunScore {
  score: number     // 0–10
  reasoning: string
}

export interface EvalRun {
  idx: number
  output: string
  scores: Record<string, EvalRunScore>   // keyed by criteria.id
  totalScore: number                     // weighted average 0–10
  passed: boolean                        // totalScore >= passingScore
  tokensIn: number
  tokensOut: number
  latencyMs: number
  error?: string
}

export interface EvalSummary {
  avgScore: number
  passRate: number
  totalTokensIn: number
  totalTokensOut: number
  avgLatencyMs: number
  perCriteria: Record<string, { avg: number; min: number; max: number }>
}

export interface EvalReport {
  id: string
  skillName: string
  skillLocation: string
  testInput: string
  criteria: EvalCriteria[]
  runs: EvalRun[]
  summary: EvalSummary
  model?: string
  passingScore: number
  createdAt: string
}

export interface RunEvalOptions {
  skillName: string
  testInput: string
  criteria: EvalCriteria[]
  runs?: number          // default 3
  model?: string         // provider/model, default → system default
  passingScore?: number  // default 7
}

// ─────────────────────────────────────────────────────────────
// LLM helpers (mirrors ars-contexta pattern)
// ─────────────────────────────────────────────────────────────

async function getLanguageModel(modelId?: string) {
  const { Provider } = await import("@/runtime/providers/provider")
  if (modelId) {
    const parsed = Provider.parseModel(modelId)
    return Provider.getLanguage(await Provider.getModel(parsed.providerID, parsed.modelID))
  }
  const def = await Provider.defaultModel()
  return Provider.getLanguage(await Provider.getModel(def.providerID, def.modelID))
}

async function completeLlm(
  model: unknown,
  system: string,
  user: string,
  maxTokens = 2048,
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const { generateText } = await import("ai")
  const result = await generateText({
    model: model as any,
    system,
    prompt: user,
    maxOutputTokens: maxTokens,
  })
  return {
    text: result.text,
    inputTokens: result.usage?.inputTokens ?? 0,
    outputTokens: result.usage?.outputTokens ?? 0,
  }
}

// ─────────────────────────────────────────────────────────────
// Core evaluator
// ─────────────────────────────────────────────────────────────

async function runSingle(opts: {
  model: unknown
  skillContent: string
  testInput: string
  criteria: EvalCriteria[]
  idx: number
  passingScore: number
}): Promise<EvalRun> {
  const start = Date.now()

  // Step 1: run the skill with test input
  const runSystem = `You are an AI assistant. The following skill/instructions have been provided to you:\n\n${opts.skillContent}`
  let output = ""
  let tokensIn = 0
  let tokensOut = 0
  let runError: string | undefined

  try {
    const res = await completeLlm(opts.model, runSystem, opts.testInput, 2048)
    output = res.text
    tokensIn += res.inputTokens
    tokensOut += res.outputTokens
  } catch (err) {
    runError = err instanceof Error ? err.message : String(err)
    log.warn("eval run failed", { idx: opts.idx, err })
  }

  // Step 2: score against each criterion
  const scores: Record<string, EvalRunScore> = {}
  for (const criterion of opts.criteria) {
    const scoringSystem = `You are an evaluation judge. Your job is to score an AI response against a specific criterion.

Respond with a JSON object like: {"score": <0-10>, "reasoning": "<one sentence>"}
Only output valid JSON, nothing else.`

    const scoringPrompt = `CRITERION: ${criterion.description}

USER INPUT:
${opts.testInput}

AI RESPONSE:
${output || "(no output — run errored)"}

Score the response 0–10 for this criterion. 0 = completely fails, 10 = perfectly meets criterion.`

    try {
      const res = await completeLlm(opts.model, scoringSystem, scoringPrompt, 256)
      tokensIn += res.inputTokens
      tokensOut += res.outputTokens
      const json = JSON.parse(res.text.trim().replace(/^```json\n?/, "").replace(/\n?```$/, ""))
      scores[criterion.id] = {
        score: Math.min(10, Math.max(0, Number(json.score) || 0)),
        reasoning: String(json.reasoning ?? ""),
      }
    } catch {
      scores[criterion.id] = { score: 0, reasoning: "Scoring failed" }
    }
  }

  // Weighted average
  const totalWeight = opts.criteria.reduce((s, c) => s + (c.weight ?? 1), 0) || 1
  const totalScore =
    opts.criteria.reduce((s, c) => s + (scores[c.id]?.score ?? 0) * (c.weight ?? 1), 0) / totalWeight

  return {
    idx: opts.idx,
    output,
    scores,
    totalScore,
    passed: totalScore >= opts.passingScore,
    tokensIn,
    tokensOut,
    latencyMs: Date.now() - start,
    error: runError,
  }
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

export namespace Evaluator {
  export async function run(opts: RunEvalOptions): Promise<EvalReport> {
    const skill = await Skill.get(opts.skillName)
    if (!skill) throw new Error(`Skill "${opts.skillName}" not found`)

    const n = Math.max(1, Math.min(10, opts.runs ?? 3))
    const passingScore = opts.passingScore ?? 7
    const model = await getLanguageModel(opts.model)

    log.info("starting eval", { skill: opts.skillName, runs: n, criteria: opts.criteria.length })

    // Run all N evaluations in parallel
    const runs = await Promise.all(
      Array.from({ length: n }, (_, i) =>
        runSingle({
          model,
          skillContent: skill.content,
          testInput: opts.testInput,
          criteria: opts.criteria,
          idx: i,
          passingScore,
        }),
      ),
    )

    // Summary
    const successfulRuns = runs.filter((r) => !r.error)
    const avgScore =
      successfulRuns.length > 0
        ? successfulRuns.reduce((s, r) => s + r.totalScore, 0) / successfulRuns.length
        : 0
    const passRate = runs.filter((r) => r.passed).length / runs.length

    const perCriteria: EvalSummary["perCriteria"] = {}
    for (const criterion of opts.criteria) {
      const vals = runs.map((r) => r.scores[criterion.id]?.score ?? 0)
      perCriteria[criterion.id] = {
        avg: vals.reduce((a, b) => a + b, 0) / vals.length,
        min: Math.min(...vals),
        max: Math.max(...vals),
      }
    }

    const report: EvalReport = {
      id: `eval-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      skillName: opts.skillName,
      skillLocation: skill.location,
      testInput: opts.testInput,
      criteria: opts.criteria,
      runs,
      summary: {
        avgScore,
        passRate,
        totalTokensIn: runs.reduce((s, r) => s + r.tokensIn, 0),
        totalTokensOut: runs.reduce((s, r) => s + r.tokensOut, 0),
        avgLatencyMs: runs.reduce((s, r) => s + r.latencyMs, 0) / runs.length,
        perCriteria,
      },
      model: opts.model,
      passingScore,
      createdAt: new Date().toISOString(),
    }

    log.info("eval complete", {
      skill: opts.skillName,
      avgScore: avgScore.toFixed(2),
      passRate: `${(passRate * 100).toFixed(0)}%`,
    })

    return report
  }
}
