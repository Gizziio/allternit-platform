/**
 * ACP (Agent Capability Protocol) Zod Schemas
 *
 * Type-safe schema definitions for ACP messages, tools, sessions, and registry entries.
 */
import { z } from 'zod';
// ============================================================================
// Content Types
// ============================================================================
export const ACPTextContentSchema = z.object({
    type: z.literal('text'),
    text: z.string(),
});
export const ACPImageContentSchema = z.object({
    type: z.literal('image'),
    url: z.string().url().optional(),
    base64: z.string().optional(),
    mimeType: z.string().optional(),
});
export const ACPFileContentSchema = z.object({
    type: z.literal('file'),
    url: z.string().url(),
    name: z.string(),
    mimeType: z.string(),
    size: z.number().optional(),
});
export const ACPContentPartSchema = z.union([
    ACPTextContentSchema,
    ACPImageContentSchema,
    ACPFileContentSchema,
]);
// ============================================================================
// Message Schema
// ============================================================================
export const ACPMessageSchema = z.object({
    id: z.string().uuid(),
    role: z.enum(['system', 'user', 'assistant', 'tool']),
    content: z.union([
        z.string(),
        z.array(ACPContentPartSchema),
    ]),
    metadata: z.record(z.unknown()).optional(),
    timestamp: z.string().datetime(),
    parentId: z.string().uuid().optional(),
});
// ============================================================================
// Tool Schemas
// ============================================================================
export const ACPToolParameterSchema = z.object({
    type: z.string(),
    description: z.string().optional(),
    enum: z.array(z.string()).optional(),
    properties: z.record(z.lazy(() => ACPToolParameterSchema)).optional(),
    required: z.array(z.string()).optional(),
    items: z.lazy(() => ACPToolParameterSchema).optional(),
});
export const ACPToolSchema = z.object({
    name: z.string(),
    description: z.string(),
    parameters: z.object({
        type: z.literal('object'),
        properties: z.record(ACPToolParameterSchema),
        required: z.array(z.string()).optional(),
    }),
});
export const ACPToolCallSchema = z.object({
    id: z.string(),
    type: z.literal('function'),
    function: z.object({
        name: z.string(),
        arguments: z.string(), // JSON string
    }),
});
export const ACPToolResultSchema = z.object({
    toolCallId: z.string(),
    role: z.literal('tool'),
    content: z.string(),
    isError: z.boolean().optional(),
});
// ============================================================================
// Session Schema
// ============================================================================
export const ACPSessionStatusSchema = z.enum([
    'initializing',
    'active',
    'paused',
    'completed',
    'error',
]);
export const ACPSessionSchema = z.object({
    id: z.string().uuid(),
    agentId: z.string(),
    status: ACPSessionStatusSchema,
    messages: z.array(ACPMessageSchema),
    tools: z.array(ACPToolSchema).optional(),
    model: z.object({
        provider: z.string(),
        model: z.string(),
    }),
    config: z.object({
        temperature: z.number().optional(),
        maxTokens: z.number().optional(),
        topP: z.number().optional(),
        systemPrompt: z.string().optional(),
    }).optional(),
    metadata: z.record(z.unknown()).optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});
// ============================================================================
// Registry Entry Schema
// ============================================================================
export const ACPCapabilitySchema = z.enum([
    'chat',
    'streaming',
    'tools',
    'vision',
    'code_execution',
    'memory',
    'multi_agent',
    'file_access',
    'web_search',
]);
export const ACPAuthTypeSchema = z.enum([
    'none',
    'api_key',
    'oauth',
    'bearer',
    'aws',
    'azure',
]);
export const ACPModelInfoSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    contextWindow: z.number(),
    maxTokens: z.number(),
    capabilities: z.array(z.string()),
    pricing: z.object({
        input: z.number().optional(),
        output: z.number().optional(),
    }).optional(),
});
export const ACPRegistryEntrySchema = z.object({
    id: z.string(),
    name: z.string(),
    version: z.string(),
    description: z.string(),
    capabilities: z.array(ACPCapabilitySchema),
    endpoints: z.object({
        chat: z.string().url().optional(),
        stream: z.string().url().optional(),
        health: z.string().url().optional(),
    }),
    auth: z.object({
        type: ACPAuthTypeSchema,
        required: z.boolean(),
        scopes: z.array(z.string()).optional(),
    }),
    models: z.array(ACPModelInfoSchema),
    metadata: z.record(z.unknown()).optional(),
});
// ============================================================================
// Request/Response Schemas
// ============================================================================
export const ACPChatRequestSchema = z.object({
    sessionId: z.string().uuid(),
    message: z.union([
        z.string(),
        ACPMessageSchema.omit({ id: true, timestamp: true }),
    ]),
    stream: z.boolean().optional(),
    tools: z.array(ACPToolSchema).optional(),
});
export const ACPChatResponseSchema = z.object({
    message: ACPMessageSchema,
    usage: z.object({
        promptTokens: z.number(),
        completionTokens: z.number(),
        totalTokens: z.number(),
    }).optional(),
    finishReason: z.enum(['stop', 'length', 'tool_calls', 'content_filter']).optional(),
});
//# sourceMappingURL=schema.js.map