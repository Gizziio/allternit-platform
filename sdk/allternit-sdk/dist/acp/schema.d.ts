/**
 * ACP (Agent Capability Protocol) Schema
 * Zod schemas for ACP message validation
 */
import { z } from 'zod';
/**
 * ACP Message Schema
 * Core message format for agent communication
 */
export declare const ACPMessageSchema: z.ZodObject<{
    id: z.ZodString;
    version: z.ZodLiteral<"1.0">;
    timestamp: z.ZodString;
    source: z.ZodObject<{
        agentId: z.ZodString;
        sessionId: z.ZodOptional<z.ZodString>;
        capability: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        agentId: string;
        capability: string;
        sessionId?: string | undefined;
    }, {
        agentId: string;
        capability: string;
        sessionId?: string | undefined;
    }>;
    target: z.ZodObject<{
        agentId: z.ZodString;
        capability: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        agentId: string;
        capability?: string | undefined;
    }, {
        agentId: string;
        capability?: string | undefined;
    }>;
    type: z.ZodEnum<["request", "response", "event", "error", "handshake", "heartbeat"]>;
    payload: z.ZodObject<{
        action: z.ZodString;
        parameters: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        data: z.ZodOptional<z.ZodUnknown>;
        context: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        action: string;
        data?: unknown;
        parameters?: Record<string, unknown> | undefined;
        context?: Record<string, unknown> | undefined;
    }, {
        action: string;
        data?: unknown;
        parameters?: Record<string, unknown> | undefined;
        context?: Record<string, unknown> | undefined;
    }>;
    metadata: z.ZodOptional<z.ZodObject<{
        priority: z.ZodDefault<z.ZodEnum<["low", "normal", "high", "critical"]>>;
        ttl: z.ZodOptional<z.ZodNumber>;
        correlationId: z.ZodOptional<z.ZodString>;
        parentId: z.ZodOptional<z.ZodString>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        priority: "low" | "high" | "normal" | "critical";
        ttl?: number | undefined;
        correlationId?: string | undefined;
        parentId?: string | undefined;
        tags?: string[] | undefined;
    }, {
        priority?: "low" | "high" | "normal" | "critical" | undefined;
        ttl?: number | undefined;
        correlationId?: string | undefined;
        parentId?: string | undefined;
        tags?: string[] | undefined;
    }>>;
    signature: z.ZodOptional<z.ZodObject<{
        algorithm: z.ZodEnum<["ed25519", "secp256k1"]>;
        publicKey: z.ZodString;
        value: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        value: string;
        algorithm: "ed25519" | "secp256k1";
        publicKey: string;
    }, {
        value: string;
        algorithm: "ed25519" | "secp256k1";
        publicKey: string;
    }>>;
}, "strip", z.ZodTypeAny, {
    type: "error" | "response" | "event" | "request" | "handshake" | "heartbeat";
    source: {
        agentId: string;
        capability: string;
        sessionId?: string | undefined;
    };
    id: string;
    target: {
        agentId: string;
        capability?: string | undefined;
    };
    version: "1.0";
    timestamp: string;
    payload: {
        action: string;
        data?: unknown;
        parameters?: Record<string, unknown> | undefined;
        context?: Record<string, unknown> | undefined;
    };
    signature?: {
        value: string;
        algorithm: "ed25519" | "secp256k1";
        publicKey: string;
    } | undefined;
    metadata?: {
        priority: "low" | "high" | "normal" | "critical";
        ttl?: number | undefined;
        correlationId?: string | undefined;
        parentId?: string | undefined;
        tags?: string[] | undefined;
    } | undefined;
}, {
    type: "error" | "response" | "event" | "request" | "handshake" | "heartbeat";
    source: {
        agentId: string;
        capability: string;
        sessionId?: string | undefined;
    };
    id: string;
    target: {
        agentId: string;
        capability?: string | undefined;
    };
    version: "1.0";
    timestamp: string;
    payload: {
        action: string;
        data?: unknown;
        parameters?: Record<string, unknown> | undefined;
        context?: Record<string, unknown> | undefined;
    };
    signature?: {
        value: string;
        algorithm: "ed25519" | "secp256k1";
        publicKey: string;
    } | undefined;
    metadata?: {
        priority?: "low" | "high" | "normal" | "critical" | undefined;
        ttl?: number | undefined;
        correlationId?: string | undefined;
        parentId?: string | undefined;
        tags?: string[] | undefined;
    } | undefined;
}>;
/**
 * ACP Tool Schema
 * Tool definition for capability exposure
 */
export declare const ACPToolSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodString;
    version: z.ZodString;
    parameters: z.ZodObject<{
        type: z.ZodLiteral<"object">;
        properties: z.ZodRecord<z.ZodString, z.ZodObject<{
            type: z.ZodEnum<["string", "number", "integer", "boolean", "array", "object"]>;
            description: z.ZodString;
            enum: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            items: z.ZodOptional<z.ZodUnknown>;
            required: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            type: "string" | "number" | "boolean" | "object" | "array" | "integer";
            description: string;
            required?: boolean | undefined;
            items?: unknown;
            enum?: string[] | undefined;
        }, {
            type: "string" | "number" | "boolean" | "object" | "array" | "integer";
            description: string;
            required?: boolean | undefined;
            items?: unknown;
            enum?: string[] | undefined;
        }>>;
        required: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        type: "object";
        properties: Record<string, {
            type: "string" | "number" | "boolean" | "object" | "array" | "integer";
            description: string;
            required?: boolean | undefined;
            items?: unknown;
            enum?: string[] | undefined;
        }>;
        required?: string[] | undefined;
    }, {
        type: "object";
        properties: Record<string, {
            type: "string" | "number" | "boolean" | "object" | "array" | "integer";
            description: string;
            required?: boolean | undefined;
            items?: unknown;
            enum?: string[] | undefined;
        }>;
        required?: string[] | undefined;
    }>;
    returns: z.ZodObject<{
        type: z.ZodEnum<["string", "number", "integer", "boolean", "array", "object"]>;
        description: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: "string" | "number" | "boolean" | "object" | "array" | "integer";
        description: string;
    }, {
        type: "string" | "number" | "boolean" | "object" | "array" | "integer";
        description: string;
    }>;
    examples: z.ZodOptional<z.ZodArray<z.ZodObject<{
        input: z.ZodUnknown;
        output: z.ZodUnknown;
        description: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        description?: string | undefined;
        input?: unknown;
        output?: unknown;
    }, {
        description?: string | undefined;
        input?: unknown;
        output?: unknown;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    name: string;
    description: string;
    parameters: {
        type: "object";
        properties: Record<string, {
            type: "string" | "number" | "boolean" | "object" | "array" | "integer";
            description: string;
            required?: boolean | undefined;
            items?: unknown;
            enum?: string[] | undefined;
        }>;
        required?: string[] | undefined;
    };
    version: string;
    returns: {
        type: "string" | "number" | "boolean" | "object" | "array" | "integer";
        description: string;
    };
    examples?: {
        description?: string | undefined;
        input?: unknown;
        output?: unknown;
    }[] | undefined;
}, {
    name: string;
    description: string;
    parameters: {
        type: "object";
        properties: Record<string, {
            type: "string" | "number" | "boolean" | "object" | "array" | "integer";
            description: string;
            required?: boolean | undefined;
            items?: unknown;
            enum?: string[] | undefined;
        }>;
        required?: string[] | undefined;
    };
    version: string;
    returns: {
        type: "string" | "number" | "boolean" | "object" | "array" | "integer";
        description: string;
    };
    examples?: {
        description?: string | undefined;
        input?: unknown;
        output?: unknown;
    }[] | undefined;
}>;
/**
 * ACP Session Schema
 * Session management for agent connections
 */
export declare const ACPSessionSchema: z.ZodObject<{
    id: z.ZodString;
    agentId: z.ZodString;
    status: z.ZodEnum<["initializing", "active", "paused", "terminating", "terminated"]>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    expiresAt: z.ZodOptional<z.ZodString>;
    capabilities: z.ZodArray<z.ZodString, "many">;
    permissions: z.ZodArray<z.ZodEnum<["read", "write", "execute", "admin"]>, "many">;
    context: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    metrics: z.ZodObject<{
        messagesSent: z.ZodNumber;
        messagesReceived: z.ZodNumber;
        errors: z.ZodNumber;
        lastActivity: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        errors: number;
        messagesSent: number;
        messagesReceived: number;
        lastActivity: string;
    }, {
        errors: number;
        messagesSent: number;
        messagesReceived: number;
        lastActivity: string;
    }>;
}, "strip", z.ZodTypeAny, {
    id: string;
    status: "initializing" | "active" | "paused" | "terminating" | "terminated";
    capabilities: string[];
    agentId: string;
    createdAt: string;
    updatedAt: string;
    permissions: ("execute" | "read" | "write" | "admin")[];
    metrics: {
        errors: number;
        messagesSent: number;
        messagesReceived: number;
        lastActivity: string;
    };
    context?: Record<string, unknown> | undefined;
    expiresAt?: string | undefined;
}, {
    id: string;
    status: "initializing" | "active" | "paused" | "terminating" | "terminated";
    capabilities: string[];
    agentId: string;
    createdAt: string;
    updatedAt: string;
    permissions: ("execute" | "read" | "write" | "admin")[];
    metrics: {
        errors: number;
        messagesSent: number;
        messagesReceived: number;
        lastActivity: string;
    };
    context?: Record<string, unknown> | undefined;
    expiresAt?: string | undefined;
}>;
/**
 * ACP Registry Entry Schema
 * Registry entry for capability discovery
 */
export declare const ACPRegistryEntrySchema: z.ZodObject<{
    agentId: z.ZodString;
    name: z.ZodString;
    description: z.ZodString;
    version: z.ZodString;
    capabilities: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        description: z.ZodString;
        version: z.ZodString;
        tools: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            description: z.ZodString;
            version: z.ZodString;
            parameters: z.ZodObject<{
                type: z.ZodLiteral<"object">;
                properties: z.ZodRecord<z.ZodString, z.ZodObject<{
                    type: z.ZodEnum<["string", "number", "integer", "boolean", "array", "object"]>;
                    description: z.ZodString;
                    enum: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    items: z.ZodOptional<z.ZodUnknown>;
                    required: z.ZodOptional<z.ZodBoolean>;
                }, "strip", z.ZodTypeAny, {
                    type: "string" | "number" | "boolean" | "object" | "array" | "integer";
                    description: string;
                    required?: boolean | undefined;
                    items?: unknown;
                    enum?: string[] | undefined;
                }, {
                    type: "string" | "number" | "boolean" | "object" | "array" | "integer";
                    description: string;
                    required?: boolean | undefined;
                    items?: unknown;
                    enum?: string[] | undefined;
                }>>;
                required: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            }, "strip", z.ZodTypeAny, {
                type: "object";
                properties: Record<string, {
                    type: "string" | "number" | "boolean" | "object" | "array" | "integer";
                    description: string;
                    required?: boolean | undefined;
                    items?: unknown;
                    enum?: string[] | undefined;
                }>;
                required?: string[] | undefined;
            }, {
                type: "object";
                properties: Record<string, {
                    type: "string" | "number" | "boolean" | "object" | "array" | "integer";
                    description: string;
                    required?: boolean | undefined;
                    items?: unknown;
                    enum?: string[] | undefined;
                }>;
                required?: string[] | undefined;
            }>;
            returns: z.ZodObject<{
                type: z.ZodEnum<["string", "number", "integer", "boolean", "array", "object"]>;
                description: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                type: "string" | "number" | "boolean" | "object" | "array" | "integer";
                description: string;
            }, {
                type: "string" | "number" | "boolean" | "object" | "array" | "integer";
                description: string;
            }>;
            examples: z.ZodOptional<z.ZodArray<z.ZodObject<{
                input: z.ZodUnknown;
                output: z.ZodUnknown;
                description: z.ZodOptional<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                description?: string | undefined;
                input?: unknown;
                output?: unknown;
            }, {
                description?: string | undefined;
                input?: unknown;
                output?: unknown;
            }>, "many">>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            description: string;
            parameters: {
                type: "object";
                properties: Record<string, {
                    type: "string" | "number" | "boolean" | "object" | "array" | "integer";
                    description: string;
                    required?: boolean | undefined;
                    items?: unknown;
                    enum?: string[] | undefined;
                }>;
                required?: string[] | undefined;
            };
            version: string;
            returns: {
                type: "string" | "number" | "boolean" | "object" | "array" | "integer";
                description: string;
            };
            examples?: {
                description?: string | undefined;
                input?: unknown;
                output?: unknown;
            }[] | undefined;
        }, {
            name: string;
            description: string;
            parameters: {
                type: "object";
                properties: Record<string, {
                    type: "string" | "number" | "boolean" | "object" | "array" | "integer";
                    description: string;
                    required?: boolean | undefined;
                    items?: unknown;
                    enum?: string[] | undefined;
                }>;
                required?: string[] | undefined;
            };
            version: string;
            returns: {
                type: "string" | "number" | "boolean" | "object" | "array" | "integer";
                description: string;
            };
            examples?: {
                description?: string | undefined;
                input?: unknown;
                output?: unknown;
            }[] | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        name: string;
        description: string;
        tools: {
            name: string;
            description: string;
            parameters: {
                type: "object";
                properties: Record<string, {
                    type: "string" | "number" | "boolean" | "object" | "array" | "integer";
                    description: string;
                    required?: boolean | undefined;
                    items?: unknown;
                    enum?: string[] | undefined;
                }>;
                required?: string[] | undefined;
            };
            version: string;
            returns: {
                type: "string" | "number" | "boolean" | "object" | "array" | "integer";
                description: string;
            };
            examples?: {
                description?: string | undefined;
                input?: unknown;
                output?: unknown;
            }[] | undefined;
        }[];
        version: string;
    }, {
        name: string;
        description: string;
        tools: {
            name: string;
            description: string;
            parameters: {
                type: "object";
                properties: Record<string, {
                    type: "string" | "number" | "boolean" | "object" | "array" | "integer";
                    description: string;
                    required?: boolean | undefined;
                    items?: unknown;
                    enum?: string[] | undefined;
                }>;
                required?: string[] | undefined;
            };
            version: string;
            returns: {
                type: "string" | "number" | "boolean" | "object" | "array" | "integer";
                description: string;
            };
            examples?: {
                description?: string | undefined;
                input?: unknown;
                output?: unknown;
            }[] | undefined;
        }[];
        version: string;
    }>, "many">;
    endpoints: z.ZodObject<{
        rest: z.ZodOptional<z.ZodString>;
        websocket: z.ZodOptional<z.ZodString>;
        grpc: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        rest?: string | undefined;
        websocket?: string | undefined;
        grpc?: string | undefined;
    }, {
        rest?: string | undefined;
        websocket?: string | undefined;
        grpc?: string | undefined;
    }>;
    authentication: z.ZodObject<{
        type: z.ZodEnum<["none", "token", "oauth2", "mtls"]>;
        scopes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        type: "none" | "token" | "oauth2" | "mtls";
        scopes?: string[] | undefined;
    }, {
        type: "none" | "token" | "oauth2" | "mtls";
        scopes?: string[] | undefined;
    }>;
    metadata: z.ZodObject<{
        tags: z.ZodArray<z.ZodString, "many">;
        category: z.ZodString;
        author: z.ZodString;
        license: z.ZodString;
        homepage: z.ZodOptional<z.ZodString>;
        repository: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        category: string;
        tags: string[];
        author: string;
        license: string;
        homepage?: string | undefined;
        repository?: string | undefined;
    }, {
        category: string;
        tags: string[];
        author: string;
        license: string;
        homepage?: string | undefined;
        repository?: string | undefined;
    }>;
    status: z.ZodEnum<["active", "deprecated", "experimental", "unavailable"]>;
    registeredAt: z.ZodString;
    lastSeenAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    description: string;
    metadata: {
        category: string;
        tags: string[];
        author: string;
        license: string;
        homepage?: string | undefined;
        repository?: string | undefined;
    };
    status: "active" | "deprecated" | "experimental" | "unavailable";
    capabilities: {
        name: string;
        description: string;
        tools: {
            name: string;
            description: string;
            parameters: {
                type: "object";
                properties: Record<string, {
                    type: "string" | "number" | "boolean" | "object" | "array" | "integer";
                    description: string;
                    required?: boolean | undefined;
                    items?: unknown;
                    enum?: string[] | undefined;
                }>;
                required?: string[] | undefined;
            };
            version: string;
            returns: {
                type: "string" | "number" | "boolean" | "object" | "array" | "integer";
                description: string;
            };
            examples?: {
                description?: string | undefined;
                input?: unknown;
                output?: unknown;
            }[] | undefined;
        }[];
        version: string;
    }[];
    version: string;
    agentId: string;
    endpoints: {
        rest?: string | undefined;
        websocket?: string | undefined;
        grpc?: string | undefined;
    };
    authentication: {
        type: "none" | "token" | "oauth2" | "mtls";
        scopes?: string[] | undefined;
    };
    registeredAt: string;
    lastSeenAt: string;
}, {
    name: string;
    description: string;
    metadata: {
        category: string;
        tags: string[];
        author: string;
        license: string;
        homepage?: string | undefined;
        repository?: string | undefined;
    };
    status: "active" | "deprecated" | "experimental" | "unavailable";
    capabilities: {
        name: string;
        description: string;
        tools: {
            name: string;
            description: string;
            parameters: {
                type: "object";
                properties: Record<string, {
                    type: "string" | "number" | "boolean" | "object" | "array" | "integer";
                    description: string;
                    required?: boolean | undefined;
                    items?: unknown;
                    enum?: string[] | undefined;
                }>;
                required?: string[] | undefined;
            };
            version: string;
            returns: {
                type: "string" | "number" | "boolean" | "object" | "array" | "integer";
                description: string;
            };
            examples?: {
                description?: string | undefined;
                input?: unknown;
                output?: unknown;
            }[] | undefined;
        }[];
        version: string;
    }[];
    version: string;
    agentId: string;
    endpoints: {
        rest?: string | undefined;
        websocket?: string | undefined;
        grpc?: string | undefined;
    };
    authentication: {
        type: "none" | "token" | "oauth2" | "mtls";
        scopes?: string[] | undefined;
    };
    registeredAt: string;
    lastSeenAt: string;
}>;
/**
 * Type definitions inferred from schemas
 */
export type ACPMessage = z.infer<typeof ACPMessageSchema>;
export type ACPTool = z.infer<typeof ACPToolSchema>;
export type ACPSession = z.infer<typeof ACPSessionSchema>;
export type ACPRegistryEntry = z.infer<typeof ACPRegistryEntrySchema>;
/**
 * ACP Error Types
 */
export type ACPErrorCode = 'INVALID_MESSAGE' | 'INVALID_SIGNATURE' | 'AGENT_NOT_FOUND' | 'CAPABILITY_NOT_FOUND' | 'SESSION_EXPIRED' | 'PERMISSION_DENIED' | 'RATE_LIMITED' | 'INTERNAL_ERROR';
export interface ACPError {
    code: ACPErrorCode;
    message: string;
    details?: Record<string, unknown>;
}
/**
 * ACP Event Types
 */
export type ACPEventType = 'message.received' | 'message.sent' | 'session.created' | 'session.terminated' | 'capability.registered' | 'capability.invoked' | 'error.occurred';
export interface ACPEvent {
    type: ACPEventType;
    timestamp: string;
    data: unknown;
}
