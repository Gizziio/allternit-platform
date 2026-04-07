/**
 * Save Session as Template Dialog
 *
 * Save the current session configuration as a reusable template.
 */

import { createSignal } from "solid-js"
import { useTheme } from "@/cli/ui/tui/context/theme"
import { useDialog } from "@/cli/ui/tui/ui/dialog"
import { useToast } from "@/cli/ui/tui/ui/toast"
import { SessionTemplate } from "@/runtime/session/template"
import { RGBA, TextAttributes } from "@opentui/core"
import { useKeyboard } from "@opentui/solid"
import { DialogPrompt } from "@/cli/ui/tui/ui/dialog-prompt"

interface DialogTemplateSaveProps {
  sessionID: string
  defaultName?: string
}

export function DialogTemplateSave(props: DialogTemplateSaveProps) {
  const { theme } = useTheme()
  const dialog = useDialog()
  const toast = useToast()
  
  const [step, setStep] = createSignal<"name" | "description" | "saving">("name")
  const [name, setName] = createSignal(props.defaultName || "")
  const [description, setDescription] = createSignal("")

  const handleSave = async () => {
    try {
      const template = await SessionTemplate.saveFromSession(
        props.sessionID,
        name().trim(),
        {
          description: description().trim() || undefined,
          includeMessages: false,
        }
      )
      
      toast.show({ 
        message: `Template "${template.name}" saved`, 
        variant: "info" 
      })
      dialog.clear()
    } catch (error) {
      toast.show({ 
        message: `Failed to save template: ${error}`, 
        variant: "error" 
      })
      setStep("name")
    }
  }

  // Step 1: Get template name
  if (step() === "name") {
    return (
      <DialogPrompt
        title="Save Session as Template"
        placeholder="Enter template name..."
        value={props.defaultName}
        onConfirm={(value) => {
          if (!value.trim()) {
            toast.show({ message: "Please enter a template name", variant: "warning" })
            return
          }
          setName(value)
          setStep("description")
        }}
        onCancel={() => dialog.clear()}
      />
    )
  }

  // Step 2: Get description (optional)
  if (step() === "description") {
    return (
      <DialogPrompt
        title="Template Description (Optional)"
        placeholder="Enter description or press enter to skip..."
        onConfirm={(value) => {
          setDescription(value)
          setStep("saving")
          handleSave()
        }}
        onCancel={() => {
          // Skip description and save
          setStep("saving")
          handleSave()
        }}
      />
    )
  }

  // Step 3: Saving state
  return (
    <box flexDirection="column" padding={2} alignItems="center" gap={1}>
      <text fg={theme.text} attributes={TextAttributes.BOLD}>
        Saving template...
      </text>
      <text fg={theme.textMuted}>
        Please wait
      </text>
    </box>
  )
}
