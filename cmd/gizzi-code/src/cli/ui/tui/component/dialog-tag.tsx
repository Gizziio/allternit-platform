import { createMemo, createResource } from "solid-js"
import { DialogSelect } from "@/cli/ui/tui/ui/dialog-select"
import { useDialog } from "@/cli/ui/tui/ui/dialog"
import { useSDK } from "@/cli/ui/tui/context/sdk"
import { createStore } from "solid-js/store"
import { GIZZICopy } from "@/shared/brand"

export function DialogTag(props: { onSelect?: (value: string) => void }) {
  const sdk = useSDK()
  const dialog = useDialog()

  const [store] = createStore({
    filter: "",
  })

  const [files] = createResource(
    () => [store.filter],
    async () => {
      const result = await (sdk.client.file as any).glob({ query: { query: store.filter } })
      if ((result as any).error) return []
      const sliced = (result.data ?? []).slice(0, 5)
      return sliced as string[]
    },
  )

  const options = createMemo(() =>
    (files() ?? []).map((file) => ({
      value: file,
      title: file,
    })),
  )

  return (
    <DialogSelect
      title={GIZZICopy.dialogs.autocompleteTitle}
      options={options()}
      onSelect={(option) => {
        props.onSelect?.(option.value)
        dialog.clear()
      }}
    />
  )
}
