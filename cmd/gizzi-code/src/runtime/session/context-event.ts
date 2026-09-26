import z from "zod/v4"
import { BusEvent } from "@/shared/bus/bus-event"

/**
 * One event for "how full is this session's context, and how do we know":
 * gizzi's own pre-request measurement (every provider), a CLI agent's own
 * report (ACP usage_update), and whether a turn's token counts had to be
 * estimated because the provider reported none. Chat bridges relay it so
 * clients can show real — or clearly estimated — telemetry.
 */
export namespace SessionContext {
  export const Event = {
    Updated: BusEvent.define(
      "session.context.updated",
      z.object({
        sessionID: z.string(),
        messageID: z.string().optional(),
        /** Tokens currently in context. */
        used: z.number().optional(),
        /** Model context window in tokens. */
        window: z.number().optional(),
        basis: z.enum(["provider", "estimated"]),
        /** The turn's token counts were estimated (provider reported none). */
        usageEstimated: z.boolean().optional(),
      }),
    ),
  }
}
