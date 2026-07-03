import type { z } from "zod/v4";
export interface ToolContext {
    sessionID: string;
    directory: string;
    worktree: string;
    abort?: AbortSignal;
    metadata?: Record<string, unknown>;
}
export interface ToolDefinition<Args extends z.ZodType = z.ZodType> {
    description: string;
    args: Args;
    execute: (args: z.infer<Args>, ctx: ToolContext) => Promise<string | {
        output: string;
        title?: string;
        metadata?: Record<string, unknown>;
    }>;
}
//# sourceMappingURL=tool.d.ts.map