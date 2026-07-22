import z from "zod/v4"

export const ProtocolError = z.object({
  code: z.string(),
  message: z.string(),
  requestID: z.string().optional(),
  retryable: z.boolean().default(false),
  details: z.record(z.string(), z.unknown()).optional(),
})
export type ProtocolError = z.infer<typeof ProtocolError>

export const PageInfo = z.object({
  cursor: z.union([z.string(), z.number()]).nullable(),
  hasMore: z.boolean(),
})
export type PageInfo = z.infer<typeof PageInfo>

export function Envelope<T extends z.ZodType>(data: T) {
  return z.object({
    version: z.literal(1),
    requestID: z.string(),
    data: data.optional(),
    error: ProtocolError.optional(),
    page: PageInfo.optional(),
  }).refine((value) => (value.data === undefined) !== (value.error === undefined), {
    message: "An envelope must contain exactly one of data or error",
  })
}

export const WsControl = z.discriminatedUnion("type", [
  z.object({ type: z.literal("subscribe"), channel: z.string(), after: z.number().int().min(0).optional() }),
  z.object({ type: z.literal("resume"), channel: z.string(), cursor: z.number().int().min(0) }),
  z.object({ type: z.literal("ack"), channel: z.string(), cursor: z.number().int().min(0) }),
  z.object({ type: z.literal("ping"), nonce: z.string() }),
  z.object({ type: z.literal("pong"), nonce: z.string() }),
])
export type WsControl = z.infer<typeof WsControl>

export function success<T>(requestID: string, data: T, page?: PageInfo) {
  return { version: 1 as const, requestID, data, ...(page ? { page } : {}) }
}

export function failure(requestID: string, error: ProtocolError) {
  return { version: 1 as const, requestID, error }
}
