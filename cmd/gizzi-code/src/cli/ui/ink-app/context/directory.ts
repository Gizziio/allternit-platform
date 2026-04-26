import { createMemo } from "solid-js"
import { useSync } from "@/cli/ui/ink-app/context/sync"
import { Global } from "@/runtime/context/global"

// VcsInfo type from SDK - defined locally since SDK exports it as unknown
type VcsInfo = {
  branch?: string
}

export function useDirectory() {
  const sync = useSync()
  return createMemo(() => {
    const directory = sync.data.path.directory || process.cwd()
    const result = directory.replace(Global.Path.home, "~")
    const vcs = sync.data.vcs as VcsInfo | undefined
    if (vcs?.branch) return result + ":" + vcs.branch
    return result
  })
}
