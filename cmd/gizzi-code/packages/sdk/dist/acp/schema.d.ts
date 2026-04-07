/**
 * ACP (Agent Capability Protocol) Zod Schemas
 *
 * Type-safe schema definitions for ACP messages, tools, sessions, and registry entries.
 */
import { z } from 'zod';
export declare const ACPTextContentSchema: z.ZodObject<{
    type: z.ZodLiteral<"text">;
    text: z.ZodString;
}, z.core.$strip>;
export declare const ACPImageContentSchema: z.ZodObject<{
    type: z.ZodLiteral<"image">;
    url: z.ZodOptional<z.ZodString>;
    base64: z.ZodOptional<z.ZodString>;
    mimeType: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const ACPFileContentSchema: z.ZodObject<{
    type: z.ZodLiteral<"file">;
    url: z.ZodString;
    name: z.ZodString;
    mimeType: z.ZodString;
    size: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const ACPContentPartSchema: z.ZodUnion<readonly [z.ZodObject<{
    type: z.ZodLiteral<"text">;
    text: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"image">;
    url: z.ZodOptional<z.ZodString>;
    base64: z.ZodOptional<z.ZodString>;
    mimeType: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"file">;
    url: z.ZodString;
    name: z.ZodString;
    mimeType: z.ZodString;
    size: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>]>;
export declare const ACPMessageSchema: z.ZodObject<{
    id: z.ZodString;
    role: z.ZodEnum<{
        assistant: "assistant";
        system: "system";
        user: "user";
        tool: "tool";
    }>;
    content: z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodUnion<readonly [z.ZodObject<{
        type: z.ZodLiteral<"text">;
        text: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"image">;
        url: z.ZodOptional<z.ZodString>;
        base64: z.ZodOptional<z.ZodString>;
        mimeType: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"file">;
        url: z.ZodString;
        name: z.ZodString;
        mimeType: z.ZodString;
        size: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>]>>]>;
    metadata: z.ZodOptional<z.ZodRecord<z.core.$ZodRecordKey, z.core.SomeType>>;
    timestamp: z.ZodString;
    parentId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const ACPToolParameterSchema: any;
export declare const ACPToolSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodString;
    parameters: z.ZodObject<{
        type: z.ZodLiteral<"object">;
        properties: z.ZodRecord<any, z.core.SomeType>;
        required: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const ACPToolCallSchema: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodLiteral<"function">;
    function: z.ZodObject<{
        name: z.ZodString;
        arguments: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const ACPToolResultSchema: z.ZodObject<{
    toolCallId: z.ZodString;
    role: z.ZodLiteral<"tool">;
    content: z.ZodString;
    isError: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export declare const ACPSessionStatusSchema: z.ZodEnum<{
    error: "error";
    initializing: "initializing";
    active: "active";
    paused: "paused";
    completed: "completed";
}>;
export declare const ACPSessionSchema: z.ZodObject<{
    id: z.ZodString;
    agentId: z.ZodString;
    status: z.ZodEnum<{
        error: "error";
        initializing: "initializing";
        active: "active";
        paused: "paused";
        completed: "completed";
    }>;
    messages: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        role: z.ZodEnum<{
            assistant: "assistant";
            system: "system";
            user: "user";
            tool: "tool";
        }>;
        content: z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodUnion<readonly [z.ZodObject<{
            type: z.ZodLiteral<"text">;
            text: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"image">;
            url: z.ZodOptional<z.ZodString>;
            base64: z.ZodOptional<z.ZodString>;
            mimeType: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"file">;
            url: z.ZodString;
            name: z.ZodString;
            mimeType: z.ZodString;
            size: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>]>>]>;
        metadata: z.ZodOptional<z.ZodRecord<z.core.$ZodRecordKey, z.core.SomeType>>;
        timestamp: z.ZodString;
        parentId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    tools: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        description: z.ZodString;
        parameters: z.ZodObject<{
            type: z.ZodLiteral<"object">;
            properties: z.ZodRecord<any, z.core.SomeType>;
            required: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>;
    }, z.core.$strip>>>;
    model: z.ZodObject<{
        provider: z.ZodString;
        model: z.ZodString;
    }, z.core.$strip>;
    config: z.ZodOptional<z.ZodObject<{
        temperature: z.ZodOptional<z.ZodNumber>;
        maxTokens: z.ZodOptional<z.ZodNumber>;
        topP: z.ZodOptional<z.ZodNumber>;
        systemPrompt: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    metadata: z.ZodOptional<z.ZodRecord<z.core.$ZodRecordKey, z.core.SomeType>>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, z.core.$strip>;
export declare const ACPCapabilitySchema: z.ZodEnum<{
    vision: "vision";
    tools: "tools";
    streaming: "streaming";
    chat: "chat";
    code_execution: "code_execution";
    memory: "memory";
    multi_agent: "multi_agent";
    file_access: "file_access";
    web_search: "web_search";
}>;
export declare const ACPAuthTypeSchema: z.ZodEnum<{
    none: "none";
    api_key: "api_key";
    oauth: "oauth";
    aws: "aws";
    azure: "azure";
    bearer: "bearer";
}>;
export declare const ACPModelInfoSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    contextWindow: z.ZodNumber;
    maxTokens: z.ZodNumber;
    capabilities: z.ZodArray<z.ZodString>;
    pricing: z.ZodOptional<z.ZodObject<{
        input: z.ZodOptional<z.ZodNumber>;
        output: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const ACPRegistryEntrySchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    version: z.ZodString;
    description: z.ZodString;
    capabilities: z.ZodArray<z.ZodEnum<{
        vision: "vision";
        tools: "tools";
        streaming: "streaming";
        chat: "chat";
        code_execution: "code_execution";
        memory: "memory";
        multi_agent: "multi_agent";
        file_access: "file_access";
        web_search: "web_search";
    }>>;
    endpoints: z.ZodObject<{
        chat: z.ZodOptional<z.ZodString>;
        stream: z.ZodOptional<z.ZodString>;
        health: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    auth: z.ZodObject<{
        type: z.ZodEnum<{
            none: "none";
            api_key: "api_key";
            oauth: "oauth";
            aws: "aws";
            azure: "azure";
            bearer: "bearer";
        }>;
        required: z.ZodBoolean;
        scopes: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>;
    models: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        contextWindow: z.ZodNumber;
        maxTokens: z.ZodNumber;
        capabilities: z.ZodArray<z.ZodString>;
        pricing: z.ZodOptional<z.ZodObject<{
            input: z.ZodOptional<z.ZodNumber>;
            output: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    metadata: z.ZodOptional<z.ZodRecord<z.core.$ZodRecordKey, z.core.SomeType>>;
}, z.core.$strip>;
export declare const ACPChatRequestSchema: z.ZodObject<{
    sessionId: z.ZodString;
    message: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
        content: z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodUnion<readonly [z.ZodObject<{
            type: z.ZodLiteral<"text">;
            text: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"image">;
            url: z.ZodOptional<z.ZodString>;
            base64: z.ZodOptional<z.ZodString>;
            mimeType: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"file">;
            url: z.ZodString;
            name: z.ZodString;
            mimeType: z.ZodString;
            size: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>]>>]>;
        metadata: z.ZodOptional<z.ZodRecord<z.core.$ZodRecordKey, z.core.SomeType>>;
        role: z.ZodEnum<{
            assistant: "assistant";
            system: "system";
            user: "user";
            tool: "tool";
        }>;
        parentId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>]>;
    stream: z.ZodOptional<z.ZodBoolean>;
    tools: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        description: z.ZodString;
        parameters: z.ZodObject<{
            type: z.ZodLiteral<"object">;
            properties: z.ZodRecord<any, z.core.SomeType>;
            required: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export declare const ACPChatResponseSchema: z.ZodObject<{
    message: z.ZodObject<{
        id: z.ZodString;
        role: z.ZodEnum<{
            assistant: "assistant";
            system: "system";
            user: "user";
            tool: "tool";
        }>;
        content: z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodUnion<readonly [z.ZodObject<{
            type: z.ZodLiteral<"text">;
            text: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"image">;
            url: z.ZodOptional<z.ZodString>;
            base64: z.ZodOptional<z.ZodString>;
            mimeType: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"file">;
            url: z.ZodString;
            name: z.ZodString;
            mimeType: z.ZodString;
            size: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>]>>]>;
        metadata: z.ZodOptional<z.ZodRecord<z.core.$ZodRecordKey, z.core.SomeType>>;
        timestamp: z.ZodString;
        parentId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    usage: z.ZodOptional<z.ZodObject<{
        promptTokens: z.ZodNumber;
        completionTokens: z.ZodNumber;
        totalTokens: z.ZodNumber;
    }, z.core.$strip>>;
    finishReason: z.ZodOptional<z.ZodEnum<{
        length: "length";
        stop: "stop";
        tool_calls: "tool_calls";
        content_filter: "content_filter";
    }>>;
}, z.core.$strip>;
export type ACPTextContent = z.infer<typeof ACPTextContentSchema>;
export type ACPImageContent = z.infer<typeof ACPImageContentSchema>;
export type ACPFileContent = z.infer<typeof ACPFileContentSchema>;
export type ACPContentPart = z.infer<typeof ACPContentPartSchema>;
export type ACPMessage = z.infer<typeof ACPMessageSchema>;
export type ACPToolParameter = z.infer<typeof ACPToolParameterSchema>;
export type ACPTool = z.infer<typeof ACPToolSchema>;
export type ACPToolCall = z.infer<typeof ACPToolCallSchema>;
export type ACPToolResult = z.infer<typeof ACPToolResultSchema>;
export type ACPSessionStatus = z.infer<typeof ACPSessionStatusSchema>;
export type ACPSession = z.infer<typeof ACPSessionSchema>;
export type ACPCapability = z.infer<typeof ACPCapabilitySchema>;
export type ACPAuthType = z.infer<typeof ACPAuthTypeSchema>;
export type ACPModelInfo = z.infer<typeof ACPModelInfoSchema>;
export type ACPRegistryEntry = z.infer<typeof ACPRegistryEntrySchema>;
export type ACPChatRequest = z.infer<typeof ACPChatRequestSchema>;
export type ACPChatResponse = z.infer<typeof ACPChatResponseSchema>;
//# sourceMappingURL=schema.d.ts.map