import { z } from 'zod';
/**
 * ToolDefinition - First-class contract for agent tools
 */
export interface ToolDefinition {
    name: string;
    description: string;
    input_schema: {
        type: 'object';
        properties: Record<string, any>;
        required?: string[];
    };
    /**
     * Execution hooks
     */
    preExecute?: (args: any, context: any) => Promise<{
        proceed: boolean;
        reason?: string;
    }>;
    execute?: (args: any, context: any) => Promise<any>;
    postExecute?: (args: any, result: any, context: any) => Promise<any>;
    /**
     * Metadata for the tool belt
     */
    metadata?: Record<string, unknown> & {
        category?: string;
        isDestructive?: boolean;
        requiresVision?: boolean;
    };
}
/**
 * DeferredToolDefinition - Tools that are known but not yet "active" in the context window.
 */
export interface DeferredToolDefinition extends Omit<ToolDefinition, 'execute' | 'preExecute' | 'postExecute'> {
    id: string;
    tags?: string[];
    activate?: () => ToolDefinition;
}
/**
 * Question Schema - For HITL tools like AskUserQuestion
 */
export declare const QuestionSchema: z.ZodObject<{
    id: z.ZodString;
    question: z.ZodString;
    type: z.ZodEnum<{
        text: "text";
        choice: "choice";
        yesno: "yesno";
    }>;
    header: z.ZodString;
    options: z.ZodOptional<z.ZodArray<z.ZodObject<{
        label: z.ZodString;
        description: z.ZodString;
        preview: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    multiSelect: z.ZodOptional<z.ZodBoolean>;
    placeholder: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type Question = z.infer<typeof QuestionSchema>;
/**
 * ToolRegistrySnapshot - For session persistence/rehydration
 */
export interface ToolRegistrySnapshot {
    activeToolNames: string[];
    discoveredToolIds: string[];
    sessionPolicies: Record<string, ToolPolicy>;
}
export type ToolPolicy = 'allow' | 'require_approval' | 'deny';
/**
 * Tool Lifecycle Events
 */
export type ToolLifecycleEvent = {
    type: 'tool.registered';
    tool: ToolDefinition | DeferredToolDefinition;
} | {
    type: 'tool.discovered';
    toolId: string;
    metadata?: any;
} | {
    type: 'tool.activated';
    toolId: string;
} | {
    type: 'tool.called';
    toolName: string;
    callId: string;
    input: any;
} | {
    type: 'tool.completed';
    toolName: string;
    callId: string;
    output: any;
} | {
    type: 'tool.failed';
    toolName: string;
    callId: string;
    error: string;
};
