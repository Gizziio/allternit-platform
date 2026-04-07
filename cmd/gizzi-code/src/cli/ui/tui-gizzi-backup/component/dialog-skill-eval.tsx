/**
 * Dialog: Skill Evaluator (Skills 2.0)
 *
 * Configure → Run → Results
 *
 * Keys:
 *   Tab / shift-tab  cycle steps
 *   Enter            confirm / submit
 *   Esc              close
 */
import { createSignal, For, Show, createMemo } from "solid-js"
import { useDialog } from "@/cli/ui/tui/ui/dialog"
import { useTheme } from "@/cli/ui/tui/context/theme"
import { useSDK } from "@/cli/ui/tui/context/sdk"
import { useKeyboard } from "@opentui/solid"
import { DialogPrompt } from "@/cli/ui/tui/ui/dialog-prompt"
import type { EvalReport, EvalCriteria } from "@/runtime/skills/evaluator"

type Phase = "config" | "running" | "results"

interface EvalConfig {
  testInput: string
  criteriaRaw: string   // comma or newline separated descriptions
  runs: number
  passingScore: number
}

export interface DialogSkillEvalProps {
  skillName: string
}

export function DialogSkillEval(props: DialogSkillEvalProps) {
  const dialog = useDialog()
  const { theme } = useTheme()
  const sdk = useSDK()

  const [phase, setPhase] = createSignal<Phase>("config")
  const [config, setConfig] = createSignal<EvalConfig>({
    testInput: "",
    criteriaRaw: "",
    runs: 3,
    passingScore: 7,
  })
  const [report, setReport] = createSignal<EvalReport | null>(null)
  const [error, setError] = createSignal<string | null>(null)
  const [selectedRunIdx, setSelectedRunIdx] = createSignal(0)
  const [step, setStep] = createSignal(0)

  const totalSteps = 4  // test input, criteria, runs, passingScore

  const stepLabels = ["Test input", "Criteria (comma-separated)", "Runs (1–10)", "Passing score (0–10)"]
  const stepPlaceholders = [
    "What should the assistant do with this input?",
    "Follows instructions, Stays on topic, Concise",
    "3",
    "7",
  ]

  const apiBase = () => `${sdk.url}/v1/skill`

  const runEval = async () => {
    setPhase("running")
    setError(null)

    const cfg = config()
    const criteria: EvalCriteria[] = cfg.criteriaRaw
      .split(/,|\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((desc, i) => ({ id: `c${i}`, description: desc }))

    if (criteria.length === 0) {
      criteria.push({ id: "c0", description: "Follows the skill instructions correctly" })
    }

    try {
      const res = await fetch(`${apiBase()}/${encodeURIComponent(props.skillName)}/eval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testInput: cfg.testInput,
          criteria,
          runs: cfg.runs,
          passingScore: cfg.passingScore,
        }),
      })
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      const data = await res.json()
      setReport(data as EvalReport)
      setPhase("results")
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setPhase("config")
    }
  }

  const handleStepInput = async (value: string) => {
    const s = step()
    const cfg = { ...config() }
    if (s === 0) cfg.testInput = value
    else if (s === 1) cfg.criteriaRaw = value
    else if (s === 2) cfg.runs = Math.max(1, Math.min(10, parseInt(value) || 3))
    else if (s === 3) cfg.passingScore = Math.max(0, Math.min(10, parseFloat(value) || 7))
    setConfig(cfg)

    if (s < totalSteps - 1) {
      setStep(s + 1)
    } else {
      // All steps done — run
      await runEval()
    }
  }

  useKeyboard((evt) => {
    if (evt.name === "escape") {
      evt.preventDefault()
      dialog.clear()
    }
    if (phase() === "results") {
      if (evt.name === "up" || evt.name === "k") {
        evt.preventDefault()
        setSelectedRunIdx((i) => Math.max(0, i - 1))
      }
      if (evt.name === "down" || evt.name === "j") {
        evt.preventDefault()
        const r = report()
        if (r) setSelectedRunIdx((i) => Math.min(r.runs.length - 1, i + 1))
      }
    }
  })

  const scoreColor = (score: number) => {
    if (score >= 8) return theme.success
    if (score >= 5) return theme.warning
    return theme.error
  }

  const r = createMemo(() => report())
  const selectedRun = createMemo(() => r()?.runs[selectedRunIdx()] ?? null)

  return (
    <box
      flexDirection="column"
      width={100}
      maxHeight={40}
      padding={1}
      backgroundColor={theme.backgroundPanel}
      borderStyle="single"
      borderColor={theme.border}
    >
      {/* Header */}
      <box flexDirection="row" justifyContent="space-between" marginBottom={1}>
        <text fg={theme.text}>Skill Eval — {props.skillName}</text>
        <text fg={theme.textMuted}>Esc close</text>
      </box>

      <Show when={error()}>
        <text fg={theme.error} marginBottom={1}>{error()}</text>
      </Show>

      {/* Config phase: step-by-step prompts */}
      <Show when={phase() === "config"}>
        <box flexDirection="column" gap={1}>
          <text fg={theme.textMuted}>
            Step {step() + 1}/{totalSteps}: {stepLabels[step()]}
          </text>
          <DialogPrompt
            title={stepLabels[step()]}
            placeholder={stepPlaceholders[step()]}
            value={
              step() === 0 ? config().testInput :
              step() === 1 ? config().criteriaRaw :
              step() === 2 ? String(config().runs) :
              String(config().passingScore)
            }
            onConfirm={(v) => void handleStepInput(v.trim() || stepPlaceholders[step()])}
            onCancel={() => dialog.clear()}
          />
          <Show when={step() > 0}>
            <text fg={theme.textMuted} marginTop={1}>
              Test input: {config().testInput.slice(0, 60)}{config().testInput.length > 60 ? "…" : ""}
            </text>
          </Show>
        </box>
      </Show>

      {/* Running phase */}
      <Show when={phase() === "running"}>
        <box flexDirection="column" gap={1}>
          <text fg={theme.accent}>Running {config().runs} eval pass{config().runs !== 1 ? "es" : ""} in parallel…</text>
          <text fg={theme.textMuted}>This may take a minute. Each run generates and scores a response.</text>
        </box>
      </Show>

      {/* Results phase */}
      <Show when={phase() === "results" && r()}>
        {(() => {
          const rep = r()!
          return (
            <box flexDirection="column" flexGrow={1}>
              {/* Summary row */}
              <box flexDirection="row" gap={3} marginBottom={1}>
                <text fg={scoreColor(rep.summary.avgScore)}>
                  Avg: {rep.summary.avgScore.toFixed(1)}/10
                </text>
                <text fg={rep.summary.passRate >= 0.7 ? theme.success : theme.warning}>
                  Pass: {(rep.summary.passRate * 100).toFixed(0)}%
                </text>
                <text fg={theme.textMuted}>
                  Tokens: {rep.summary.totalTokensIn + rep.summary.totalTokensOut}
                </text>
                <text fg={theme.textMuted}>
                  Avg latency: {(rep.summary.avgLatencyMs / 1000).toFixed(1)}s
                </text>
              </box>

              <box flexDirection="row" flexGrow={1}>
                {/* Left: run list */}
                <box width={22} flexDirection="column">
                  <text fg={theme.textMuted} marginBottom={1}>Runs</text>
                  <For each={rep.runs}>
                    {(run, i) => (
                      <box
                        flexDirection="row"
                        paddingX={1}
                        gap={1}
                        backgroundColor={selectedRunIdx() === i() ? theme.backgroundElement : undefined}
                      >
                        <text fg={scoreColor(run.totalScore)}>
                          {run.totalScore.toFixed(1)}
                        </text>
                        <text fg={run.passed ? theme.success : theme.error}>
                          {run.passed ? "✓" : "✗"}
                        </text>
                        <text fg={selectedRunIdx() === i() ? theme.text : theme.textMuted}>
                          run #{i() + 1}
                        </text>
                      </box>
                    )}
                  </For>
                </box>

                {/* Divider */}
                <box width={1} borderStyle="single" borderColor={theme.border} />

                {/* Right: selected run detail */}
                <box flexGrow={1} flexDirection="column" paddingX={1}>
                  <Show when={selectedRun()}>
                    {(() => {
                      const run = selectedRun()!
                      return (
                        <box flexDirection="column" gap={1}>
                          <box flexDirection="row" gap={2}>
                            <text fg={scoreColor(run.totalScore)}>Score: {run.totalScore.toFixed(1)}/10</text>
                            <text fg={theme.textMuted}>{(run.latencyMs / 1000).toFixed(1)}s</text>
                            <text fg={theme.textMuted}>{run.tokensIn + run.tokensOut} tokens</text>
                            <Show when={run.error}>
                              <text fg={theme.error}>Error: {run.error}</text>
                            </Show>
                          </box>

                          {/* Criteria scores */}
                          <For each={rep.criteria}>
                            {(criterion) => {
                              const s = run.scores[criterion.id]
                              return (
                                <box flexDirection="column" marginBottom={1}>
                                  <box flexDirection="row" gap={2}>
                                    <text fg={scoreColor(s?.score ?? 0)}>
                                      {(s?.score ?? 0).toFixed(1)}/10
                                    </text>
                                    <text fg={theme.textMuted} wrapMode="none">
                                      {criterion.description.slice(0, 50)}
                                    </text>
                                  </box>
                                  <Show when={s?.reasoning}>
                                    <text fg={theme.textMuted} paddingLeft={6} wrapMode="none">
                                      {s!.reasoning.slice(0, 70)}
                                    </text>
                                  </Show>
                                </box>
                              )
                            }}
                          </For>

                          {/* Output preview */}
                          <text fg={theme.textMuted}>Output preview:</text>
                          <text fg={theme.text} wrapMode="none">
                            {run.output.slice(0, 200)}{run.output.length > 200 ? "…" : ""}
                          </text>
                        </box>
                      )
                    })()}
                  </Show>
                </box>
              </box>

              <box flexDirection="row" gap={2} marginTop={1}>
                <text fg={theme.textMuted}>↑↓ select run</text>
                <text fg={theme.textMuted}>Esc close</text>
              </box>
            </box>
          )
        })()}
      </Show>
    </box>
  )
}
