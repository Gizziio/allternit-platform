import { Plugin } from "@/runtime/integrations/plugin"
import { Format } from "@/shared/format"
import { LSP } from "@/runtime/integrations/lsp"
import { FileWatcher } from "@/shared/file/watcher"
import { File } from "@/shared/file"
import { Project } from "@/runtime/context/project/project"
import { Bus } from "@/shared/bus"
import { Command } from "@/runtime/loop/command"
import { Instance } from "@/runtime/context/project/instance"
import { Vcs } from "@/runtime/context/project/vcs"
import { Log } from "@/shared/util/log"
import { ShareNext } from "@/runtime/session/share/share-next"
import { Snapshot } from "@/runtime/session/snapshot"
import { Truncate } from "@/runtime/tools/builtins/truncation"
import { Sidecar } from "@/runtime/sidecar"

export async function InstanceBootstrap() {
  Log.Default.info("bootstrapping", { directory: Instance.directory })
  await Plugin.init()
  ShareNext.init()
  Format.init()
  await LSP.init()
  FileWatcher.init()
  File.init()
  Vcs.init()
  Snapshot.init()
  Truncate.init()

  // Initialize Agent Communication Runtime
  try {
    const { AgentCommunicationRuntime } = await import("@/runtime/agents/communication-runtime-fixed")
    await AgentCommunicationRuntime.initialize()
  } catch (e) {
    Log.Default.warn("agent communication runtime setup failed", { error: e instanceof Error ? e.message : String(e) })
  }

  // Start embedded model sidecar in the background (non-blocking)
  Sidecar.ensure().catch((e) => {
    Log.Default.warn("sidecar setup failed", { error: e instanceof Error ? e.message : String(e) })
  })

  Bus.subscribe(Command.Event.Executed, async (payload) => {
    if (payload.properties.name === Command.Default.INIT) {
      await Project.setInitialized(Instance.project.id)
    }
  })
}
