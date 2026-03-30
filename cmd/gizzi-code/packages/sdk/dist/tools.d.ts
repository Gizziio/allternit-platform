import type { ZodType } from "zod/v4";

export interface ToolDefinition {
  id: string;
  strict?: boolean;
  init: () => Promise<{
    description: string;
    parameters: ZodType;
    strict?: boolean;
    execute(
      args: unknown,
      ctx?: unknown,
    ): Promise<{
      title: string;
      metadata: Record<string, unknown>;
      output: string;
    }>;
  }>;
}

export declare function defineTool<I, O>(opts: {
  name: string;
  description: string;
  input: ZodType<I>;
  output?: ZodType<O>;
  strict?: boolean;
  execute: (args: I, ctx?: unknown) => Promise<O>;
}): ToolDefinition;
