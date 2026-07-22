import { Config } from "@/runtime/context/config/config";
import { Wildcard } from "@/shared/util/wildcard";
import type { HookEvent, HookResponse } from "./types";
import { HttpHookSender } from "./http/sender";
import { CommandHookExecutor } from "./command/executor";

export namespace HookDispatcher {
  function matchesTool(matchers: string[] | undefined, event: HookEvent): boolean {
    if (!matchers || matchers.length === 0) return true
    const target = String(
      event.payload?.tool ??
      event.payload?.toolName ??
      event.payload?.text ??
      event.payload?.trigger ??
      event.payload?.agent ??
      event.payload?.type ??
      event.payload?.error ??
      "",
    )
    return matchers.some((pattern) => Wildcard.match(target, pattern))
  }

  export async function emit(event: HookEvent): Promise<HookResponse> {
    const config = await Config.get();
    const pending: Promise<HookResponse | null>[] = [];
    const seen = new Set<string>()

    if (config.hooks?.http) {
      for (const hook of config.hooks.http) {
        if (hook.events.includes(event.name) && matchesTool(hook.matchers, event)) {
          const key = `http:${hook.url}`
          if (!seen.has(key)) {
            seen.add(key)
            pending.push(HttpHookSender.send(hook.url, event))
          }
        }
      }
    }

    if (config.hooks?.command) {
      for (const hook of config.hooks.command) {
        if (hook.events.includes(event.name) && matchesTool(hook.matchers, event)) {
          const key = `command:${hook.command}`
          if (!seen.has(key)) {
            seen.add(key)
            pending.push(CommandHookExecutor.execute(hook.command, event, hook.timeout))
          }
        }
      }
    }

    const responses = (await Promise.all(pending)).filter((item): item is HookResponse => item !== null)
    return mergeResponses(responses);
  }

  function mergeResponses(responses: HookResponse[]): HookResponse {
    const final: HookResponse = { decision: "allow" };
    
    for (const res of responses) {
      if (res.decision === "deny") {
        final.decision = "deny";
        final.reason = res.reason;
        // Don't break, we might want to collect all reasons or keep merging payloads
      }
      if (res.modifiedPayload) {
        final.modifiedPayload = { ...(final.modifiedPayload || {}), ...res.modifiedPayload };
      }
      if (res.message) final.message = [final.message, res.message].filter(Boolean).join("\n")
    }
    
    return final;
  }
}
