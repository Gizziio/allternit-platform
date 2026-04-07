/**
 * Simple AI-Guided Skill Creation Dialog
 *
 * Natural conversation flow:
 * 1. User describes what they want
 * 2. AI asks follow-up questions
 * 3. AI generates complete skill
 * 4. Done!
 */

import { useDialog } from "@/cli/ui/tui/ui/dialog"
import { useTheme } from "@/cli/ui/tui/context/theme"
import { createSignal, Show } from "solid-js"
import {
  createSkillWithAI,
  generateInterviewQuestions,
  type GeneratedSkill,
} from "@/runtime/skills/skill-generator"
import { TextAttributes } from "@opentui/core"

export type DialogSkillCreateSimpleProps = {
  onCreate: (result: { name: string; path: string; generated: GeneratedSkill }) => void
  initialDescription?: string
}

export function DialogSkillCreateSimple(props: DialogSkillCreateSimpleProps) {
  const dialog = useDialog()
  const { theme } = useTheme()

  const [description, setDescription] = createSignal(props.initialDescription || "")
  const [step, setStep] = createSignal<"input" | "interview" | "generating" | "done">("input")
  const [questions, setQuestions] = createSignal<string[]>([])
  const [answers, setAnswers] = createSignal<string[]>([])
  const [currentAnswer, setCurrentAnswer] = createSignal("")
  const [generated, setGenerated] = createSignal<GeneratedSkill | null>(null)
  const [error, setError] = createSignal<string | null>(null)

  const currentQuestionIndex = () => answers().length
  const currentQuestion = () => questions()[currentQuestionIndex()]
  const hasMoreQuestions = () => currentQuestionIndex() < questions().length

  const handleStart = async () => {
    if (description().length < 10) {
      setError("Please provide a more detailed description")
      return
    }

    setError(null)
    setStep("interview")

    try {
      const qs = await generateInterviewQuestions(description())
      setQuestions(qs.slice(0, 3))

      if (qs.length === 0) {
        await generateSkill([])
      }
    } catch {
      await generateSkill([])
    }
  }

  const handleAnswer = async () => {
    const newAnswers = [...answers(), currentAnswer()]
    setAnswers(newAnswers)
    setCurrentAnswer("")

    if (newAnswers.length >= questions().length) {
      const qa = questions().map((q, i) => ({ question: q, answer: newAnswers[i] }))
      await generateSkill(qa)
    }
  }

  const generateSkill = async (interviewQa: { question: string; answer: string }[]) => {
    setStep("generating")

    try {
      const { skillPath, generated: gen } = await createSkillWithAI({
        description: description(),
        interviewAnswers: interviewQa,
        targetPath: "./.gizzi/skills",
      })

      setGenerated(gen)
      setStep("done")

      setTimeout(() => {
        props.onCreate({ name: gen.name, path: skillPath, generated: gen })
        dialog.clear()
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create skill")
      setStep("input")
    }
  }

  const handleSkip = async () => {
    const qa = questions().slice(0, answers().length).map((q, i) => ({
      question: q,
      answer: answers()[i] || "",
    }))
    await generateSkill(qa)
  }

  return (
    <box flexDirection="column" gap={1} padding={2}>
      {/* Title */}
      <box flexDirection="row" justifyContent="space-between" marginBottom={1}>
        <text fg={theme.text} attributes={TextAttributes.BOLD}>
          Create Skill (AI)
        </text>
        <text fg={theme.textMuted} onMouseDown={() => dialog.clear()}>
          [ESC to close]
        </text>
      </box>

      {/* Error */}
      <Show when={error()}>
        <box flexDirection="row" gap={1}>
          <text fg={theme.error}>{error()}</text>
          <text fg={theme.textMuted} onMouseDown={() => setError(null)}>[OK]</text>
        </box>
      </Show>

      {/* Step 1: Initial Description */}
      <Show when={step() === "input"}>
        <box flexDirection="column" gap={1}>
          <text fg={theme.text} attributes={TextAttributes.BOLD}>
            What skill do you want to create?
          </text>
          <text fg={theme.textMuted}>
            Describe what you want in plain English. I'll ask a few questions then build it.
          </text>
          <box backgroundColor={theme.backgroundElement} padding={1} marginTop={1}>
            <text fg={description() ? theme.text : theme.textMuted}>
              {description() || "Example: I need a skill that analyzes GitHub PRs..."}
            </text>
          </box>
          <box flexDirection="row" gap={2} marginTop={1}>
            <text
              fg={description().length >= 10 ? theme.accent : theme.textMuted}
              attributes={description().length >= 10 ? TextAttributes.BOLD : undefined}
              onMouseDown={description().length >= 10 ? handleStart : undefined}
            >
              [Continue]
            </text>
            <text fg={theme.textMuted} onMouseDown={() => dialog.clear()}>
              [Cancel]
            </text>
          </box>
        </box>
      </Show>

      {/* Step 2: Interview Questions */}
      <Show when={step() === "interview"}>
        <box flexDirection="column" gap={1}>
          <text fg={theme.textMuted}>
            Quick question ({currentQuestionIndex() + 1}/{questions().length})
          </text>
          <text fg={theme.text} attributes={TextAttributes.BOLD}>
            {currentQuestion()}
          </text>
          <box backgroundColor={theme.backgroundElement} padding={1} marginTop={1}>
            <text fg={currentAnswer() ? theme.text : theme.textMuted}>
              {currentAnswer() || "Your answer..."}
            </text>
          </box>
          <box flexDirection="row" gap={2} marginTop={1}>
            <text
              fg={currentAnswer() ? theme.accent : theme.textMuted}
              attributes={currentAnswer() ? TextAttributes.BOLD : undefined}
              onMouseDown={currentAnswer() ? handleAnswer : undefined}
            >
              [{hasMoreQuestions() ? "Next" : "Create Skill"}]
            </text>
            <text fg={theme.textMuted} onMouseDown={handleSkip}>
              [Skip]
            </text>
          </box>
          <Show when={answers().length > 0}>
            <text fg={theme.textMuted}>Answered {String(answers().length)} question(s)</text>
          </Show>
        </box>
      </Show>

      {/* Step 3: Generating */}
      <Show when={step() === "generating"}>
        <box flexDirection="column" gap={1} alignItems="center">
          <text fg={theme.accent}>⟳ Building your skill...</text>
          <text fg={theme.textMuted}>This takes a few seconds</text>
        </box>
      </Show>

      {/* Step 4: Done */}
      <Show when={step() === "done" && !!generated()}>
        <box flexDirection="column" gap={1}>
          <text fg={theme.success} attributes={TextAttributes.BOLD}>✓ Skill Created!</text>
          <text fg={theme.text}>{generated()!.name}</text>
          <text fg={theme.textMuted}>{generated()!.description}</text>
          <text fg={theme.textMuted}>Closing...</text>
        </box>
      </Show>
    </box>
  )
}
