import z, { type ZodType } from "zod/v4"
import { zodToJsonSchema } from "zod-to-json-schema"

export interface ToolDefinition {
  id: string
  strict?: boolean
  init: () => Promise<{
    description: string
    parameters: z.ZodType
    strict?: boolean
    execute(
      args: unknown,
      ctx?: unknown,
    ): Promise<{
      title: string
      metadata: Record<string, unknown>
      output: string
    }>
  }>
}

export function defineTool<I, O>(opts: {
  name: string
  description: string
  input: ZodType<I>
  output?: ZodType<O>
  strict?: boolean
  execute: (args: I, ctx?: unknown) => Promise<O>
}): ToolDefinition {
  return {
    id: opts.name,
    strict: opts.strict,
    init: async () => ({
      description: opts.description,
      strict: opts.strict,
      parameters: opts.input as z.ZodType,
      execute: async (args, ctx) => {
        const result = await opts.execute(args as I, ctx)
        return {
          title: opts.name,
          output: typeof result === "string" ? result : JSON.stringify(result, null, 2),
          metadata: {
            strict: opts.strict ?? false,
            inputSchema: zodToJsonSchema(opts.input as z.ZodType),
            outputSchema: opts.output ? zodToJsonSchema(opts.output as z.ZodType) : undefined,
          },
        }
      },
    }),
  }
}
