import { Clipboard } from "@/cli/ui/tui/util/clipboard"
import { GIZZICopy } from "@/runtime/brand/brand"

type Toast = {
  show: (input: { message: string; variant: "info" | "success" | "warning" | "error" }) => void
  error: (err: unknown) => void
}

type Renderer = {
  getSelection: () => { getSelectedText: () => string } | null
  clearSelection: () => void
}

export namespace Selection {
  export function copy(renderer: Renderer, toast: Toast): boolean {
    const text = renderer.getSelection()?.getSelectedText()
    if (!text) return false

    Clipboard.copy(text)
      .then(() => toast.show({ message: GIZZICopy.toast.clipboardCopied, variant: "info" }))
      .catch(toast.error)

    renderer.clearSelection()
    return true
  }
}
