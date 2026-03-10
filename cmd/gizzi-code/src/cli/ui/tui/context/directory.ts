import { createMemo } from "solid-js"
import { useSync } from "@/cli/ui/tui/context/sync"
import { Global } from "@/runtime/context/global"

export function useDirectory() {
  const sync = useSync()
  return createMemo(() => {
    const directory = sync.data.path.directory || process.cwd()
    const result = directory.replace(Global.Path.home, "~")
    if (sync.data.vcs?.branch) return result + ":" + sync.data.vcs.branch
    return result
  })
}
