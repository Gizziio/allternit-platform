import { DialogSelect, type DialogSelectOption } from "@/cli/ui/tui/ui/dialog-select"
import { createResource, createMemo, Show } from "solid-js"
import { useDialog } from "@/cli/ui/tui/ui/dialog"
import { useSDK } from "@/cli/ui/tui/context/sdk"
import { GIZZICopy, sanitizeBrandSurface } from "@/runtime/brand/brand"
import { useTheme } from "@/cli/ui/tui/context/theme"

// Local type definition since SDK exports unknown
 type Skill = {
  name: string
  description?: string
}

export type DialogSkillProps = {
  onSelect: (skill: string) => void
}

export function DialogSkill(props: DialogSkillProps) {
  const dialog = useDialog()
  const sdk = useSDK()
  const { theme } = useTheme()
  dialog.setSize("large")

  const [skills] = createResource(async () => {
    const res = await sdk.client.app.skills()
    return ((res.data ?? []) as Skill[])
  })


  const options = createMemo<DialogSelectOption<string>[]>(() => {
    const list = (skills() ?? []) as Skill[]
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
    <Show
      when={!skills.error}
      fallback={
        <DialogSelect
          title={GIZZICopy.dialogs.skillsTitle}
          placeholder=""
          options={[{
            title: "Failed to load skills",
            description: String(skills.error?.message ?? "Unknown error"),
            value: "",
            onSelect: () => dialog.clear(),
          }]}
        />
      }
    >
      <DialogSelect
        title={GIZZICopy.dialogs.skillsTitle}
        placeholder={skills.loading ? GIZZICopy.dialogs.loading : GIZZICopy.dialogs.skillsSearchPlaceholder}
        options={options()}
      />
    </Show>
  )
}
