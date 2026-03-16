import { Log } from "@/shared/util/log";
import type { HookEvent, HookResponse } from "../types";

export class HttpHookSender {
  private static log = Log.create({ service: "hooks.http" });

  static async send(url: string, event: HookEvent): Promise<HookResponse | null> {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event),
      });

      if (response.ok) {
        return await response.json() as HookResponse;
      }
      this.log.error("HTTP Hook returned non-OK status", { url, status: response.status });
    } catch (e) {
      this.log.error("HTTP Hook fetch failed", { url, error: e });
    }
    return null;
  }
}
