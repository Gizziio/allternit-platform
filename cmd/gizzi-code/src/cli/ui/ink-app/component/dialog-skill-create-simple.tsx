/**
 * Simple AI-Guided Skill Creation Dialog
 * 
 * Natural conversation flow:
 * 1. User describes what they want
 * 2. AI asks follow-up questions (like AskUserQuestion tool)
 * 3. AI generates complete skill
 * 4. Done!
 */

import { useDialog } from "@/cli/ui/ink-app/ui/dialog"
import { createSignal, Show, createResource } from "solid-js"
import { 
  createSkillWithAI, 
  generateInterviewQuestions,
  type GeneratedSkill 
} from "@/runtime/skills/skill-generator"

export type DialogSkillCreateSimpleProps = {
  onCreate: (result: { name: string; path: string; generated: GeneratedSkill }) => void
  initialDescription?: string
}

export function DialogSkillCreateSimple(props: DialogSkillCreateSimpleProps) {
  const dialog = useDialog()

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

  // Start the process
  const handleStart = async () => {
    if (description().length < 10) {
      setError("Please provide a more detailed description")
      return
    }

    setError(null)
    setStep("interview")

    try {
      // Generate follow-up questions
      const qs = await generateInterviewQuestions(description())
      setQuestions(qs.slice(0, 3)) // Max 3 questions

      // If no questions needed, skip to generation
      if (qs.length === 0) {
        await generateSkill([])
      }
    } catch (err) {
      // Skip interview on error, just generate
      await generateSkill([])
    }
  }

  // Submit answer and continue
  const handleAnswer = async () => {
    const newAnswers = [...answers(), currentAnswer()]
    setAnswers(newAnswers)
    setCurrentAnswer("")

    if (newAnswers.length >= questions().length) {
      // All questions answered
      const qa = questions().map((q, i) => ({ question: q, answer: newAnswers[i] }))
      await generateSkill(qa)
    }
  }

  // Generate the skill
  const generateSkill = async (interviewQa: { question: string; answer: string }[]) => {
    setStep("generating")

    try {
      const { skillPath, generated } = await createSkillWithAI({
        description: description(),
        interviewAnswers: interviewQa,
        targetPath: "./.gizzi/skills",
      })

      setGenerated(generated)
      setStep("done")

      // Auto-close after showing success
      setTimeout(() => {
        props.onCreate({ name: generated.name, path: skillPath, generated })
        dialog.clear()
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create skill")
      setStep("input")
    }
  }

  // Skip remaining questions
  const handleSkip = async () => {
    const qa = questions().slice(0, answers().length).map((q, i) => ({ 
      question: q, 
      answer: answers()[i] || "" 
    }))
    await generateSkill(qa)
  }

  return (
    <div class="skill-create-dialog">
      {/* Error State */}
      <Show when={error()}>
        <div class="error-message">
          {error()}
          <button onClick={() => setError(null)}>OK</button>
        </div>
      </Show>

      {/* Step 1: Initial Description */}
      <Show when={step() === "input"}>
        <div class="step-input">
          <h3>What skill do you want to create?</h3>
          <p class="hint">
            Describe what you want in plain English. I'll ask a few questions then build it for you.
          </p>
          
          <textarea
            value={description()}
            onInput={(e) => setDescription(e.currentTarget.value)}
            placeholder="Example: I need a skill that analyzes GitHub PRs and summarizes the changes for my team"
            rows={4}
            disabled={step() !== "input"}
          />

          <div class="actions">
            <button 
              onClick={handleStart}
              disabled={description().length < 10}
              class="primary"
            >
              Continue
            </button>
            <button onClick={() => dialog.clear()}>Cancel</button>
          </div>
        </div>
      </Show>

      {/* Step 2: Interview Questions */}
      <Show when={step() === "interview"}>
        <div class="step-interview">
          <h3>Quick question ({currentQuestionIndex() + 1}/{questions().length})</h3>
          
          <p class="question">{currentQuestion()}</p>
          
          <input
            type="text"
            value={currentAnswer()}
            onInput={(e) => setCurrentAnswer(e.currentTarget.value)}
            placeholder="Your answer..."
            onKeyPress={(e) => e.key === "Enter" && currentAnswer() && handleAnswer()}
            autofocus
          />

          <div class="actions">
            <button 
              onClick={handleAnswer}
              disabled={!currentAnswer()}
              class="primary"
            >
              {hasMoreQuestions() ? "Next" : "Create Skill"}
            </button>
            <button onClick={handleSkip}>Skip</button>
          </div>

          {/* Show progress */}
          <Show when={answers().length > 0}>
            <div class="progress">
              <small>Answered {answers().length} question(s)</small>
            </div>
          </Show>
        </div>
      </Show>

      {/* Step 3: Generating */}
      <Show when={step() === "generating"}>
        <div class="step-generating">
          <div class="spinner" />
          <p>Building your skill...</p>
          <p class="hint">This takes a few seconds</p>
        </div>
      </Show>

      {/* Step 4: Done */}
      <Show when={step() === "done" && generated()}>
        <div class="step-done">
          <div class="success-icon">✓</div>
          <h3>Skill Created!</h3>
          <p class="skill-name">{generated()!.name}</p>
          <p class="skill-desc">{generated()!.description}</p>
          <p class="hint">Closing...</p>
        </div>
      </Show>
    </div>
  )
}
