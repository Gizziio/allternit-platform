/**
 * AI-Guided Skill Creation Dialog
 *
 * Instead of forms, this uses a conversational approach where the AI:
 * 1. Asks clarifying questions
 * 2. Generates complete skill structure
 * 3. Creates all files automatically
 *
 * The user just describes what they want in natural language.
 */

import { useDialog } from "@/cli/ui/tui/ui/dialog"
import { useTheme } from "@/cli/ui/tui/context/theme"
import { createSignal, Show, For, Switch, Match } from "solid-js"
import { TextAttributes } from "@opentui/core"
import {
  createSkillWithAI,
  generateInterviewQuestions,
  type GeneratedSkill,
} from "@/runtime/skills/skill-generator"

export type DialogSkillCreateAIProps = {
  onCreate: (result: { name: string; path: string; generated: GeneratedSkill }) => void
}

type Step =
  | { type: "initial" }
  | { type: "interview"; questions: string[]; answers: string[] }
  | { type: "generating"; message: string }
  | { type: "preview"; generated: GeneratedSkill }
  | { type: "creating"; message: string }
  | { type: "error"; message: string }

export function DialogSkillCreateAI(props: DialogSkillCreateAIProps) {
  const dialog = useDialog()
  const { theme } = useTheme()
  dialog.setSize("large")

  const [description, setDescription] = createSignal("")
  const [step, setStep] = createSignal<Step>({ type: "initial" })
  const [currentAnswer, setCurrentAnswer] = createSignal("")

  const handleStart = async () => {
    if (!description() || description().length < 10) {
      setStep({ type: "error", message: "Please provide a more detailed description" })
      return
    }

    setStep({ type: "generating", message: "Analyzing your requirements..." })

    try {
      const questions = await generateInterviewQuestions(description())

      if (questions.length === 0) {
        await generateSkill([])
      } else {
        setStep({ type: "interview", questions, answers: [] })
      }
    } catch (error) {
      setStep({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to start interview",
      })
    }
  }

  const handleAnswerSubmit = async () => {
    const currentStep = step()
    if (currentStep.type !== "interview") return

    const newAnswers = [...currentStep.answers, currentAnswer()]
    setCurrentAnswer("")

    if (newAnswers.length < currentStep.questions.length) {
      setStep({ ...currentStep, answers: newAnswers })
    } else {
      const qa = currentStep.questions.map((q, i) => ({ question: q, answer: newAnswers[i] }))
      await generateSkill(qa)
    }
  }

  const generateSkill = async (interviewQa: { question: string; answer: string }[]) => {
    setStep({ type: "generating", message: "Designing your skill..." })

    try {
      const targetPath = "./.gizzi/skills"

      const { skillPath, generated } = await createSkillWithAI({
        description: description(),
        interviewAnswers: interviewQa,
        targetPath,
        onProgress: (msg) => setStep({ type: "generating", message: msg }),
      })

      setStep({ type: "preview", generated })

      setTimeout(() => {
        props.onCreate({ name: generated.name, path: skillPath, generated })
        dialog.clear()
      }, 2000)
    } catch (error) {
      setStep({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to generate skill",
      })
    }
  }

  const getCurrentQuestion = () => {
    const s = step()
    if (s.type !== "interview") return null
    return s.questions[s.answers.length]
  }

  const getProgress = () => {
    const s = step()
    if (s.type !== "interview") return null
    return `${s.answers.length + 1}/${s.questions.length}`
  }

  return (
    <box flexDirection="column" gap={1} padding={2}>
      {/* Title bar */}
      <box flexDirection="row" justifyContent="space-between" marginBottom={1}>
        <text fg={theme.text} attributes={TextAttributes.BOLD}>
          Create New Skill (AI-Guided)
        </text>
        <text fg={theme.textMuted} onMouseDown={() => dialog.clear()}>
          [ESC to close]
        </text>
      </box>

      <Switch>
        {/* Error state */}
        <Match when={step().type === "error"}>
          <box flexDirection="column" gap={1}>
            <text fg={theme.error}>
              {(step() as Extract<Step, { type: "error" }>).message}
            </text>
            <box flexDirection="row" gap={2}>
              <text
                fg={theme.accent}
                onMouseDown={() => setStep({ type: "initial" })}
                attributes={TextAttributes.BOLD}
              >
                [Retry]
              </text>
              <text fg={theme.textMuted} onMouseDown={() => dialog.clear()}>
                [Cancel]
              </text>
            </box>
          </box>
        </Match>

        {/* Initial description step */}
        <Match when={step().type === "initial"}>
          <box flexDirection="column" gap={1}>
            <text fg={theme.text}>
              Describe what you want this skill to do. Be as specific as possible.
            </text>
            <text fg={theme.textMuted}>
              {"Examples:\n• \"A skill that analyzes GitHub PRs and summarizes the changes\"\n• \"Process PDF files and extract text with page numbers\"\n• \"Connect to Stripe API and generate usage reports\""}
            </text>
            <box
              backgroundColor={theme.backgroundElement}
              padding={1}
              marginTop={1}
            >
              <text fg={description() ? theme.text : theme.textMuted}>
                {description() || "Type your description here, then press Continue below..."}
              </text>
            </box>
            <box flexDirection="row" gap={2} marginTop={1}>
              <text
                fg={description().length >= 10 ? theme.accent : theme.textMuted}
                onMouseDown={description().length >= 10 ? handleStart : undefined}
                attributes={description().length >= 10 ? TextAttributes.BOLD : undefined}
              >
                [Continue]
              </text>
              <text fg={theme.textMuted} onMouseDown={() => dialog.clear()}>
                [Cancel]
              </text>
            </box>
          </box>
        </Match>

        {/* Interview step */}
        <Match when={step().type === "interview"}>
          <box flexDirection="column" gap={1}>
            <text fg={theme.textMuted} attributes={TextAttributes.BOLD}>
              Question {getProgress()}
            </text>
            <text fg={theme.text}>{getCurrentQuestion()}</text>
            <box
              backgroundColor={theme.backgroundElement}
              padding={1}
              marginTop={1}
            >
              <text fg={currentAnswer() ? theme.text : theme.textMuted}>
                {currentAnswer() || "Your answer..."}
              </text>
            </box>
            <box flexDirection="row" gap={2} marginTop={1}>
              <text
                fg={currentAnswer().length >= 3 ? theme.accent : theme.textMuted}
                onMouseDown={currentAnswer().length >= 3 ? handleAnswerSubmit : undefined}
                attributes={currentAnswer().length >= 3 ? TextAttributes.BOLD : undefined}
              >
                [Next]
              </text>
              <text fg={theme.textMuted} onMouseDown={() => generateSkill([])}>
                [Skip Questions]
              </text>
            </box>

            {/* Previous Q&A */}
            <Show when={(step() as Extract<Step, { type: "interview" }>).answers.length > 0}>
              <box flexDirection="column" gap={1} marginTop={1}>
                <text fg={theme.textMuted} attributes={TextAttributes.BOLD}>Previous answers:</text>
                <For
                  each={(step() as Extract<Step, { type: "interview" }>).questions.slice(
                    0,
                    (step() as Extract<Step, { type: "interview" }>).answers.length,
                  )}
                >
                  {(q, i) => (
                    <box flexDirection="column" gap={0}>
                      <text fg={theme.textMuted}>Q: {q}</text>
                      <text fg={theme.text}>
                        A: {(step() as Extract<Step, { type: "interview" }>).answers[i()]}
                      </text>
                    </box>
                  )}
                </For>
              </box>
            </Show>
          </box>
        </Match>

        {/* Generating step */}
        <Match when={step().type === "generating"}>
          <box flexDirection="column" gap={1} alignItems="center">
            <text fg={theme.accent}>⟳ Working...</text>
            <text fg={theme.text}>
              {(step() as Extract<Step, { type: "generating" }>).message}
            </text>
          </box>
        </Match>

        {/* Preview step */}
        <Match when={step().type === "preview"}>
          <box flexDirection="column" gap={1}>
            <text fg={theme.success} attributes={TextAttributes.BOLD}>✓ Skill generated successfully!</text>

            <box flexDirection="column" gap={1} marginTop={1}>
              <text fg={theme.textMuted} attributes={TextAttributes.BOLD}>Generated Skill</text>
              <box flexDirection="row" gap={1}>
                <text fg={theme.textMuted}>Name:</text>
                <text fg={theme.text}>
                  {(step() as Extract<Step, { type: "preview" }>).generated.name}
                </text>
              </box>
              <box flexDirection="row" gap={1}>
                <text fg={theme.textMuted}>Template:</text>
                <text fg={theme.text}>
                  {(step() as Extract<Step, { type: "preview" }>).generated.template}
                </text>
              </box>
              <box flexDirection="row" gap={1}>
                <text fg={theme.textMuted}>Description:</text>
                <text fg={theme.text} wrapMode="word">
                  {(step() as Extract<Step, { type: "preview" }>).generated.description}
                </text>
              </box>
            </box>

            <Show when={(step() as Extract<Step, { type: "preview" }>).generated.scripts}>
              <box flexDirection="column" gap={1} marginTop={1}>
                <text fg={theme.textMuted} attributes={TextAttributes.BOLD}>Scripts</text>
                <For
                  each={Object.keys(
                    (step() as Extract<Step, { type: "preview" }>).generated.scripts || {},
                  )}
                >
                  {(filename) => (
                    <text fg={theme.accent}>• {filename}</text>
                  )}
                </For>
              </box>
            </Show>

            <text fg={theme.textMuted}>Creating files...</text>
          </box>
        </Match>
      </Switch>
    </box>
  )
}
