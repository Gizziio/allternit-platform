import { useDialog } from "@/cli/ui/tui/ui/dialog"
import { useTheme } from "@/cli/ui/tui/context/theme"
import { createSignal, For, Show } from "solid-js"
import { SkillCreator, type SkillTemplate } from "@/runtime/skills/creator"
import { TextAttributes } from "@opentui/core"

export type DialogSkillCreateProps = {
  onCreate: (result: { name: string; path: string }) => void
}

const TEMPLATES: { value: SkillTemplate; label: string; description: string }[] = [
  {
    value: "minimal",
    label: "Minimal",
    description: "Basic skill structure with just SKILL.md",
  },
  {
    value: "tool-integration",
    label: "Tool Integration",
    description: "For integrating with external APIs and services",
  },
  {
    value: "data-processing",
    label: "Data Processing",
    description: "For processing and transforming data",
  },
  {
    value: "workflow-automation",
    label: "Workflow Automation",
    description: "For automating multi-step workflows",
  },
]

export function DialogSkillCreate(props: DialogSkillCreateProps) {
  const dialog = useDialog()
  const { theme } = useTheme()
  dialog.setSize("large")

  const [name, setName] = createSignal("")
  const [description, setDescription] = createSignal("")
  const [template, setTemplate] = createSignal<SkillTemplate>("minimal")
  const [isCreating, setIsCreating] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)

  const validateName = (value: string): string | undefined => {
    if (!value || value.length === 0) return "Skill name is required"
    if (!/^[a-z0-9-]+$/.test(value)) return "Use only lowercase letters, numbers, and hyphens"
    if (value.startsWith("-") || value.endsWith("-")) return "Cannot start or end with hyphen"
    if (value.includes("--")) return "Cannot contain consecutive hyphens"
    return undefined
  }

  const handleSubmit = async () => {
    const nameError = validateName(name())
    if (nameError) {
      setError(nameError)
      return
    }

    if (!description() || description().length === 0) {
      setError("Description is required")
      return
    }

    setIsCreating(true)
    setError(null)

    try {
      const targetPath = "./.gizzi/skills"

      const skillPath = await SkillCreator.createSkill({
        name: name(),
        description: description(),
        template: template(),
        targetPath,
      })

      props.onCreate({ name: name(), path: skillPath })
      dialog.clear()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <box flexDirection="column" gap={1} padding={2}>
      {/* Title */}
      <box flexDirection="row" justifyContent="space-between" marginBottom={1}>
        <text fg={theme.text} attributes={TextAttributes.BOLD}>
          Create New Skill
        </text>
        <text fg={theme.textMuted} onMouseDown={() => dialog.clear()}>
          [ESC to close]
        </text>
      </box>

      {/* Error */}
      <Show when={error()}>
        <text fg={theme.error}>{error()}</text>
      </Show>

      {/* Name field */}
      <box flexDirection="column" gap={0}>
        <text fg={theme.text} attributes={TextAttributes.BOLD}>Skill Name</text>
        <text fg={theme.textMuted}>Kebab-case name (e.g., 'pdf-processor')</text>
        <box backgroundColor={theme.backgroundElement} padding={1} marginTop={1}>
          <text fg={name() ? theme.text : theme.textMuted}>
            {name() || "my-skill"}
          </text>
        </box>
      </box>

      {/* Description field */}
      <box flexDirection="column" gap={0}>
        <text fg={theme.text} attributes={TextAttributes.BOLD}>Description</text>
        <text fg={theme.textMuted}>Brief description of what the skill does</text>
        <box backgroundColor={theme.backgroundElement} padding={1} marginTop={1}>
          <text fg={description() ? theme.text : theme.textMuted}>
            {description() || "Processes PDF files and extracts text content"}
          </text>
        </box>
      </box>

      {/* Template selector */}
      <box flexDirection="column" gap={0}>
        <text fg={theme.text} attributes={TextAttributes.BOLD}>Template</text>
        <text fg={theme.textMuted}>Choose a starting template for your skill</text>
        <box flexDirection="column" gap={0} marginTop={1}>
          <For each={TEMPLATES}>
            {(t) => (
              <box
                flexDirection="row"
                gap={1}
                onMouseDown={() => setTemplate(t.value)}
              >
                <text fg={template() === t.value ? theme.accent : theme.textMuted}>
                  {template() === t.value ? "◉" : "○"}
                </text>
                <box flexDirection="column">
                  <text fg={theme.text}>{t.label}</text>
                  <text fg={theme.textMuted}>{t.description}</text>
                </box>
              </box>
            )}
          </For>
        </box>
      </box>

      {/* Help text */}
      <text fg={theme.textMuted}>
        Skills are stored in .gizzi/skills/ and can include: scripts/, references/, and assets/
      </text>

      {/* Actions */}
      <box flexDirection="row" gap={2} marginTop={1}>
        <text
          fg={isCreating() ? theme.textMuted : theme.accent}
          attributes={isCreating() ? undefined : TextAttributes.BOLD}
          onMouseDown={isCreating() ? undefined : handleSubmit}
        >
          [{isCreating() ? "Creating..." : "Create Skill"}]
        </text>
        <text fg={theme.textMuted} onMouseDown={() => dialog.clear()}>
          [Cancel]
        </text>
      </box>
    </box>
  )
}
