import { Bus } from "@/shared/bus"
import { PermissionNext } from "@/runtime/tools/guard/permission/next"
import { Question } from "@/runtime/integrations/question/question"
import { RuntimeService } from "@/runtime/runtime-service"
import { Log } from "@/shared/util/log"

const log = Log.create({ service: "remote-control-push" })

function pushWorkerUrl(): string | undefined {
  return process.env.ALLTERNIT_REMOTE_CONTROL_PUSH_URL
}

async function notifySubscribers(runtimeId: string, title: string, body: string, tag: string) {
  const url = pushWorkerUrl()
  if (!url) return

  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runtimeId, title, body, tag }),
    })
    if (!response.ok) {
      log.warn("push worker returned error", { status: response.status })
    }
  } catch (error) {
    log.warn("failed to notify remote control subscribers", { error: error instanceof Error ? error.message : String(error) })
  }
}

async function runtimeIdsToNotify(): Promise<string[]> {
  const explicit = process.env.ALLTERNIT_REMOTE_CONTROL_RUNTIME_ID
  if (explicit) return explicit.split(",").map((id) => id.trim()).filter(Boolean)

  const runtimes = await RuntimeService.list()
  return runtimes.filter((r) => r.status === "online").map((r) => r.id)
}

export function initRemoteControlPush(): void {
  if (!pushWorkerUrl()) {
    log.info("remote control push worker URL not configured; skipping subscriptions")
    return
  }

  Bus.subscribe(PermissionNext.Event.Asked, async (event) => {
    const runtimeIds = await runtimeIdsToNotify()
    await Promise.all(
      runtimeIds.map((runtimeId) =>
        notifySubscribers(
          runtimeId,
          "Permission required",
          `Machine ${runtimeId} is asking for permission: ${event.properties.permission}`,
          `permission:${event.properties.id}`,
        )
      )
    )
  })

  Bus.subscribe(Question.Event.Asked, async (event) => {
    const runtimeIds = await runtimeIdsToNotify()
    const summary = event.properties.questions.map((q) => q.header).join(", ")
    await Promise.all(
      runtimeIds.map((runtimeId) =>
        notifySubscribers(
          runtimeId,
          "Question waiting",
          `Machine ${runtimeId} needs input: ${summary}`,
          `question:${event.properties.id}`,
        )
      )
    )
  })

  log.info("remote control push subscriptions initialized")
}
