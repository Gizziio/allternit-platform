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

import { Dialog } from "@/cli/ui/ink-app/ui/dialog"
import { useDialog } from "@/cli/ui/ink-app/ui/dialog"
import { useTheme } from "@/cli/ui/ink-app/context/theme"
import { GIZZICopy } from "@/shared/brand"
import { createSignal, createEffect, Show, For } from "solid-js"
import { 
  createSkillWithAI, 
  generateInterviewQuestions,
  type GeneratedSkill 
} from "@/runtime/skills/skill-generator"
import { Instance } from "@/runtime/context/project/instance"

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
      // Generate interview questions
      const questions = await generateInterviewQuestions(description())
      
      if (questions.length === 0) {
        // Skip interview if no questions needed
        await generateSkill([])
      } else {
        setStep({ type: "interview", questions, answers: [] })
      }
    } catch (error) {
      setStep({ 
        type: "error", 
        message: error instanceof Error ? error.message : "Failed to start interview" 
      })
    }
  }

  const handleAnswerSubmit = async () => {
    const currentStep = step()
    if (currentStep.type !== "interview") return

    const newAnswers = [...currentStep.answers, currentAnswer()]
    setCurrentAnswer("")

    if (newAnswers.length < currentStep.questions.length) {
      // More questions to ask
      setStep({ ...currentStep, answers: newAnswers })
    } else {
      // All questions answered, generate skill
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
      
      // Auto-confirm and finish
      setTimeout(() => {
        props.onCreate({ name: generated.name, path: skillPath, generated })
        dialog.clear()
      }, 2000)
      
    } catch (error) {
      setStep({ 
        type: "error", 
        message: error instanceof Error ? error.message : "Failed to generate skill" 
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
    <Dialog
      title="Create New Skill"
      onCancel={() => dialog.clear()}
    >
      <Show
        when={step().type !== "error"}
        fallback={
          <Dialog.Error 
            message={(step() as Extract<Step, { type: "error" }>).message}
            onRetry={() => setStep({ type: "initial" })}
          />
        }
      >
        <Switch>
          {/* Initial Description Step */}
          <Match when={step().type === "initial"}>
            <Dialog.Content>
              <Dialog.Text>
                Describe what you want this skill to do. Be as specific as possible.
              </Dialog.Text>
              
              <Dialog.Text dim>
                Examples:
                • "A skill that analyzes GitHub PRs and summarizes the changes"
                • "Process PDF files and extract text with page numbers"
                • "Connect to Stripe API and generate usage reports"
              </Dialog.Text>

              <Dialog.TextArea
                value={description()}
                onChange={setDescription}
                placeholder="I need a skill that..."
                rows={4}
              />

              <Dialog.Actions>
                <Dialog.Button 
                  onClick={handleStart}
                  primary
                  disabled={description().length < 10}
                >
                  Continue
                </Dialog.Button>
                <Dialog.Button onClick={() => dialog.clear()}>
                  Cancel
                </Dialog.Button>
              </Dialog.Actions>
            </Dialog.Content>
          </Match>

          {/* Interview Step */}
          <Match when={step().type === "interview"}>
            <Dialog.Content>
              <Dialog.Header>
                Question {getProgress()}
              </Dialog.Header>

              <Dialog.Text>
                {getCurrentQuestion()}
              </Dialog.Text>

              <Dialog.TextArea
                value={currentAnswer()}
                onChange={setCurrentAnswer}
                placeholder="Your answer..."
                rows={3}
                onSubmit={handleAnswerSubmit}
              />

              <Dialog.Actions>
                <Dialog.Button 
                  onClick={handleAnswerSubmit}
                  primary
                  disabled={currentAnswer().length < 3}
                >
                  Next
                </Dialog.Button>
                <Dialog.Button onClick={() => generateSkill([])}>
                  Skip Questions
                </Dialog.Button>
              </Dialog.Actions>

              {/* Show previous Q&A */}
              <Show when={(step() as Extract<Step, { type: "interview" }>).answers.length > 0}>
                <Dialog.Collapsible title="Previous answers">
                  <For each={(step() as Extract<Step, { type: "interview" }>).questions.slice(0, (step() as Extract<Step, { type: "interview" }>).answers.length)}>
                    {(q, i) => (
                      <Dialog.QAPair
                        question={q}
                        answer={(step() as Extract<Step, { type: "interview" }>).answers[i()]}
                      />
                    )}
                  </For>
                </Dialog.Collapsible>
              </Show>
            </Dialog.Content>
          </Match>

          {/* Generating Step */}
          <Match when={step().type === "generating"}>
            <Dialog.Content center>
              <Dialog.Spinner />
              <Dialog.Text>
                {(step() as Extract<Step, { type: "generating" }>).message}
              </Dialog.Text>
            </Dialog.Content>
          </Match>

          {/* Preview Step */}
          <Match when={step().type === "preview"}>
            <Dialog.Content>
              <Dialog.Success>
                Skill generated successfully!
              </Dialog.Success>

              <Dialog.Section title="Generated Skill">
                <Dialog.Detail label="Name" value={(step() as Extract<Step, { type: "preview" }>).generated.name} />
                <Dialog.Detail label="Template" value={(step() as Extract<Step, { type: "preview" }>).generated.template} />
                <Dialog.Detail label="Description" value={(step() as Extract<Step, { type: "preview" }>).generated.description} />
              </Dialog.Section>

              <Show when={(step() as Extract<Step, { type: "preview" }>).generated.scripts}>
                <Dialog.Section title="Scripts">
                  <For each={Object.keys((step() as Extract<Step, { type: "preview" }>).generated.scripts || {})}>
                    {(filename) => <Dialog.FileBadge filename={filename} type="script" />}
                  </For>
                </Dialog.Section>
              </Show>

              <Dialog.Text dim>
                Creating files...
              </Dialog.Text>
            </Dialog.Content>
          </Match>
        </Switch>
      </Show>
    </Dialog>
  )
}

// Helper components that should exist in the UI library
// These are type definitions for the pattern used above
declare module "@/cli/ui/ink-app/ui/dialog" {
  interface Dialog {
    Content: typeof DialogContent
    Text: typeof DialogText
    TextArea: typeof DialogTextArea
    Actions: typeof DialogActions
    Button: typeof DialogButton
    Header: typeof DialogHeader
    Spinner: typeof DialogSpinner
    Success: typeof DialogSuccess
    Section: typeof DialogSection
    Detail: typeof DialogDetail
    FileBadge: typeof DialogFileBadge
    Collapsible: typeof DialogCollapsible
    QAPair: typeof DialogQAPair
    Error: typeof DialogError
  }
}

// Placeholder type definitions - actual implementation depends on UI library
type DialogContent = (props: { children: any; center?: boolean }) => any
type DialogText = (props: { children: any; dim?: boolean }) => any
type DialogTextArea = (props: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; onSubmit?: () => void }) => any
type DialogActions = (props: { children: any }) => any
type DialogButton = (props: { children: any; onClick: () => void; primary?: boolean; disabled?: boolean }) => any
type DialogHeader = (props: { children: any }) => any
type DialogSpinner = () => any
type DialogSuccess = (props: { children: any }) => any
type DialogSection = (props: { title: string; children: any }) => any
type DialogDetail = (props: { label: string; value: string }) => any
type DialogFileBadge = (props: { filename: string; type: "script" | "reference" }) => any
type DialogCollapsible = (props: { title: string; children: any }) => any
type DialogQAPair = (props: { question: string; answer: string }) => any
type DialogError = (props: { message: string; onRetry: () => void }) => any
