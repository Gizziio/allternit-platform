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
    }, z.core.$strip>;
    target: z.ZodObject<{
        agentId: z.ZodString;
        capability: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    type: z.ZodEnum<{
        error: "error";
        request: "request";
        response: "response";
        event: "event";
        handshake: "handshake";
        heartbeat: "heartbeat";
    }>;
    payload: z.ZodObject<{
        action: z.ZodString;
        parameters: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        data: z.ZodOptional<z.ZodUnknown>;
        context: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>;
    metadata: z.ZodOptional<z.ZodObject<{
        priority: z.ZodDefault<z.ZodEnum<{
            low: "low";
            normal: "normal";
            high: "high";
            critical: "critical";
        }>>;
        ttl: z.ZodOptional<z.ZodNumber>;
        correlationId: z.ZodOptional<z.ZodString>;
        parentId: z.ZodOptional<z.ZodString>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>;
    signature: z.ZodOptional<z.ZodObject<{
        algorithm: z.ZodEnum<{
            ed25519: "ed25519";
            secp256k1: "secp256k1";
        }>;
        publicKey: z.ZodString;
        value: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
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
            type: z.ZodEnum<{
                string: "string";
                number: "number";
                boolean: "boolean";
                object: "object";
                array: "array";
                integer: "integer";
            }>;
            description: z.ZodString;
            enum: z.ZodOptional<z.ZodArray<z.ZodString>>;
            items: z.ZodOptional<z.ZodUnknown>;
            required: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>>;
        required: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>;
    returns: z.ZodObject<{
        type: z.ZodEnum<{
            string: "string";
            number: "number";
            boolean: "boolean";
            object: "object";
            array: "array";
            integer: "integer";
        }>;
        description: z.ZodString;
    }, z.core.$strip>;
    examples: z.ZodOptional<z.ZodArray<z.ZodObject<{
        input: z.ZodUnknown;
        output: z.ZodUnknown;
        description: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
/**
 * ACP Session Schema
 * Session management for agent connections
 */
export declare const ACPSessionSchema: z.ZodObject<{
    id: z.ZodString;
    agentId: z.ZodString;
    status: z.ZodEnum<{
        initializing: "initializing";
        active: "active";
        paused: "paused";
        terminating: "terminating";
        terminated: "terminated";
    }>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    expiresAt: z.ZodOptional<z.ZodString>;
    capabilities: z.ZodArray<z.ZodString>;
    permissions: z.ZodArray<z.ZodEnum<{
        read: "read";
        write: "write";
        execute: "execute";
        admin: "admin";
    }>>;
    context: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    metrics: z.ZodObject<{
        messagesSent: z.ZodNumber;
        messagesReceived: z.ZodNumber;
        errors: z.ZodNumber;
        lastActivity: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
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
                    type: z.ZodEnum<{
                        string: "string";
                        number: "number";
                        boolean: "boolean";
                        object: "object";
                        array: "array";
                        integer: "integer";
                    }>;
                    description: z.ZodString;
                    enum: z.ZodOptional<z.ZodArray<z.ZodString>>;
                    items: z.ZodOptional<z.ZodUnknown>;
                    required: z.ZodOptional<z.ZodBoolean>;
                }, z.core.$strip>>;
                required: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>;
            returns: z.ZodObject<{
                type: z.ZodEnum<{
                    string: "string";
                    number: "number";
                    boolean: "boolean";
                    object: "object";
                    array: "array";
                    integer: "integer";
                }>;
                description: z.ZodString;
            }, z.core.$strip>;
            examples: z.ZodOptional<z.ZodArray<z.ZodObject<{
                input: z.ZodUnknown;
                output: z.ZodUnknown;
                description: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    endpoints: z.ZodObject<{
        rest: z.ZodOptional<z.ZodString>;
        websocket: z.ZodOptional<z.ZodString>;
        grpc: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    authentication: z.ZodObject<{
        type: z.ZodEnum<{
            none: "none";
            token: "token";
            oauth2: "oauth2";
            mtls: "mtls";
        }>;
        scopes: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>;
    metadata: z.ZodObject<{
        tags: z.ZodArray<z.ZodString>;
        category: z.ZodString;
        author: z.ZodString;
        license: z.ZodString;
        homepage: z.ZodOptional<z.ZodString>;
        repository: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    status: z.ZodEnum<{
        active: "active";
        deprecated: "deprecated";
        experimental: "experimental";
        unavailable: "unavailable";
    }>;
    registeredAt: z.ZodString;
    lastSeenAt: z.ZodString;
}, z.core.$strip>;
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
