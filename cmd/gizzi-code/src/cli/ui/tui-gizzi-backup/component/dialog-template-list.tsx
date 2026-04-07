/**
 * Session Template List Dialog
 *
 * Browse, search, and select session templates.
 */

import { createMemo, createSignal, Show } from "solid-js"
import { useTheme } from "@/cli/ui/tui/context/theme"
import { useDialog } from "@/cli/ui/tui/ui/dialog"
import { DialogSelect, type DialogSelectOption } from "@/cli/ui/tui/ui/dialog-select"
import { SessionTemplate } from "@/runtime/session/template"
import { RGBA, TextAttributes } from "@opentui/core"
import { Locale } from "@/runtime/util/locale"
import { GIZZICopy } from "@/runtime/brand/brand"

interface DialogTemplateListProps {
  onSelect?: (template: SessionTemplate) => void
}

export function DialogTemplateList(props: DialogTemplateListProps) {
  const { theme } = useTheme()
  const dialog = useDialog()
  const [templates, setTemplates] = createSignal<SessionTemplate[]>([])
  const [loading, setLoading] = createSignal(true)

  // Load templates
  const loadTemplates = async () => {
    setLoading(true)
    try {
      const list = await SessionTemplate.list()
      setTemplates(list)
    } finally {
      setLoading(false)
    }
  }

  // Load on mount
  loadTemplates()

  const options = createMemo<DialogSelectOption<SessionTemplate>[]>(() => {
    const list = templates()
    
    if (list.length === 0 && !loading()) {
      return [{
        title: "No templates found",
        value: null as any,
        disabled: true,
        description: "Create templates with: gizzi-code session template-save <session-id> <name>",
      }]
    }
    
    return list.map((template): DialogSelectOption<SessionTemplate> => ({
      title: template.name,
      value: template,
      description: template.description || `Created ${Locale.time(template.createdAt)}`,
      category: template.category || "General",
      footer: template.tags?.map(t => `[${t}]`).join(" ") || undefined,
    }))
  })

  return (
    <Show
      when={!loading()}
      fallback={
        <box flexDirection="column" padding={2} alignItems="center" gap={1}>
          <text fg={theme.text} attributes={TextAttributes.BOLD}>
            Loading templates...
          </text>
        </box>
      }
    >
      <DialogSelect
        title="Session Templates"
        placeholder="Search templates..."
        options={options()}
        onSelect={(option) => {
          if (option.value) {
            props.onSelect?.(option.value)
            dialog.clear()
          }
        }}
        onFilter={() => {}}
        keybind={[
          {
            keybind: undefined,
            title: "Delete",
            onTrigger: async (option) => {
              if (!option.value) return
              await SessionTemplate.remove(option.value.id)
              await loadTemplates()
            },
          },
        ]}
      />
    </Show>
  )
}
