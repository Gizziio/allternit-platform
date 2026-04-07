import { Config } from "@/runtime/context/config/config";
import { Wildcard } from "@/shared/util/wildcard";
import type { HookEvent, HookResponse } from "./types";
import { HttpHookSender } from "./http/sender";
import { CommandHookExecutor } from "./command/executor";

export namespace HookDispatcher {
  function matchesTool(matchers: string[] | undefined, event: HookEvent): boolean {
    if (!matchers || matchers.length === 0) return true
    const toolName = event.payload?.tool ?? event.payload?.toolName ?? ""
    if (!toolName) return true
    return matchers.some((pattern) => Wildcard.match(toolName, pattern))
  }

  export async function emit(event: HookEvent): Promise<HookResponse> {
    const config = await Config.get();
    const responses: HookResponse[] = [];

    if (config.hooks?.http) {
      for (const hook of config.hooks.http) {
        if (hook.events.includes(event.name) && matchesTool(hook.matchers, event)) {
          const res = await HttpHookSender.send(hook.url, event);
          if (res) responses.push(res);
        }
      }
    }

    if (config.hooks?.command) {
      for (const hook of config.hooks.command) {
        if (hook.events.includes(event.name) && matchesTool(hook.matchers, event)) {
          const res = await CommandHookExecutor.execute(hook.command, event, hook.timeout);
          if (res) responses.push(res);
        }
      }
    }

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
    }
    
    return final;
  }
}
