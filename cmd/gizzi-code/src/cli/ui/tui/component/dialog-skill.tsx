import { DialogSelect, type DialogSelectOption } from "@/cli/ui/tui/ui/dialog-select"
import { createResource, createMemo } from "solid-js"
import { useDialog } from "@/cli/ui/tui/ui/dialog"
import { useSDK } from "@/cli/ui/tui/context/sdk"
import { GIZZICopy, sanitizeBrandSurface } from "@/shared/brand"

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
      category: GIZZICopy.dialogs.skillsCategory,
      onSelect: () => {
        props.onSelect(skill.name)
        dialog.clear()
      },
    }))
  })

  return (
    <DialogSelect
      title={GIZZICopy.dialogs.skillsTitle}
      placeholder={GIZZICopy.dialogs.skillsSearchPlaceholder}
      options={options()}
    />
  )
}
