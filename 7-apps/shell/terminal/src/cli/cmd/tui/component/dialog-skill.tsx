import { DialogSelect, type DialogSelectOption } from "@tui/ui/dialog-select"
import { createResource, createMemo } from "solid-js"
import { useDialog } from "@tui/ui/dialog"
import { useSDK } from "@tui/context/sdk"
import { A2RCopy, sanitizeBrandSurface } from "@/brand"

export type DialogSkillProps = {
  onSelect: (skill: string) => void
}

export function DialogSkill(props: DialogSkillProps) {
  const dialog = useDialog()
  const sdk = useSDK()
  dialog.setSize("large")

  const [skills] = createResource(async () => {
    const result = await sdk.client.app.skills()
    return result.data ?? []
  })

  const options = createMemo<DialogSelectOption<string>[]>(() => {
    const list = skills() ?? []
    const maxWidth = Math.max(0, ...list.map((s) => s.name.length))
    return list.map((skill) => ({
      title: skill.name.padEnd(maxWidth),
      description: skill.description ? sanitizeBrandSurface(skill.description.replace(/\s+/g, " ").trim()) : undefined,
      value: skill.name,
      category: A2RCopy.dialogs.skillsCategory,
      onSelect: () => {
        props.onSelect(skill.name)
        dialog.clear()
      },
    }))
  })

  return (
    <DialogSelect
      title={A2RCopy.dialogs.skillsTitle}
      placeholder={A2RCopy.dialogs.skillsSearchPlaceholder}
      options={options()}
    />
  )
}
