import { DialogForm } from "@/cli/ui/ink-app/ui/dialog-form"
import { useDialog } from "@/cli/ui/ink-app/ui/dialog"
import { useTheme } from "@/cli/ui/ink-app/context/theme"
import { GIZZICopy } from "@/shared/brand"
import { createSignal } from "solid-js"
import { SkillCreator, type SkillTemplate } from "@/runtime/skills/creator"

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
      // Determine target path (project-local .gizzi/skills)
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
    <DialogForm
      title="Create New Skill"
      onSubmit={handleSubmit}
      onCancel={() => dialog.clear()}
      submitLabel={isCreating() ? "Creating..." : "Create Skill"}
      error={error()}
    >
      <DialogForm.Field
        label="Skill Name"
        description="Kebab-case name for the skill (e.g., 'pdf-processor')"
      >
        <DialogForm.Input
          value={name()}
          onChange={setName}
          placeholder="my-skill"
          disabled={isCreating()}
          validate={validateName}
        />
      </DialogForm.Field>

      <DialogForm.Field
        label="Description"
        description="Brief description of what the skill does"
      >
        <DialogForm.Input
          value={description()}
          onChange={setDescription}
          placeholder="Processes PDF files and extracts text content"
          disabled={isCreating()}
        />
      </DialogForm.Field>

      <DialogForm.Field
        label="Template"
        description="Choose a starting template for your skill"
      >
        <DialogForm.Select
          value={template()}
          onChange={(v) => setTemplate(v as SkillTemplate)}
          options={TEMPLATES}
          disabled={isCreating()}
        />
      </DialogForm.Field>

      <DialogForm.Help>
        Skills are stored in {theme.style.accent(".gizzi/skills/")} and can include:
        {" "}
        {theme.style.dim("scripts/")}, {theme.style.dim("references/")}, and{" "}
        {theme.style.dim("assets/")}
      </DialogForm.Help>
    </DialogForm>
  )
}
