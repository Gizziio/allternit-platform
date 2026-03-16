import type { z } from "zod/v4"

export declare class NamedErrorBase extends Error {
  data?: unknown
  toObject(): { name: string; message: string; data: unknown }
}

export declare const NamedError: {
  create<S extends z.ZodType>(
    name: string,
    schema: S,
  ): {
    new (data: z.infer<S>, opts?: ErrorOptions): NamedErrorBase & { data: z.infer<S> }
    isInstance(err: unknown): err is NamedErrorBase & { data: z.infer<S> }
    Schema: S
  }
}
