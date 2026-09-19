import type { AllternitClient } from "@allternit/sdk/client";
import type { z } from "zod/v4";
export interface PluginInput {
    client: AllternitClient;
    project: string;
    worktree: string;
    directory: string;
    serverUrl: string;
    $: typeof Bun.$;
}
/** A plugin module export — a function that receives input and returns hooks */
export type Plugin = (input: PluginInput) => Promise<Hooks>;
export interface Hooks {
    /** Called to set up authentication for a provider */
    auth?: AuthHook;
    /** Called before each chat request to inject/modify headers */
    "chat.headers"?: (input: {
        sessionID: string;
        providerID: string;
        modelID: string;
    }, output: {
        headers: Record<string, string>;
    }) => void | Promise<void>;
    /** Called before a tool executes — can block execution */
    "tool.execute.before"?: (input: {
        tool: string;
        input: Record<string, unknown>;
        sessionID: string;
    }, output: {
        blocked?: boolean;
        blockedReason?: string;
        __blocked?: boolean;
        __blockedReason?: string;
    }) => void | Promise<void>;
    /** Called after a tool executes — can modify output */
    "tool.execute.after"?: (input: {
        tool: string;
        input: Record<string, unknown>;
        output: string;
        sessionID: string;
    }, output: {
        output?: string;
    }) => void | Promise<void>;
    /** Called with full config on startup */
    config?: (config: Record<string, unknown>) => void | Promise<void>;
    /** Called for every bus event emitted */
    event?: (input: {
        event: {
            type: string;
            properties?: unknown;
        };
    }) => void | Promise<void>;
    /** Additional tool definitions contributed by the plugin */
    tool?: Record<string, import("./tool.js").ToolDefinition>;
    /** Called to build the environment for a spawned shell (bash tool, PTY, shell invocation) */
    "shell.env"?: (input: {
        cwd: string;
        sessionID?: string;
        callID?: string;
    }, output: {
        env: Record<string, string>;
    }) => void | Promise<void>;
    /** Called when a tool definition is resolved — plugins may rewrite description/parameters */
    "tool.definition"?: (input: {
        toolID: string;
    }, output: {
        description: string;
        parameters: z.ZodType;
    }) => void | Promise<void>;
    /** Called before a chat request — plugins may transform the system prompt parts */
    "experimental.chat.system.transform"?: (input: {
        sessionID?: string;
        model: {
            providerID: string;
            id: string;
        };
    }, output: {
        system: string[];
    }) => void | Promise<void>;
    /** Called before a chat request — plugins may override generation params */
    "chat.params"?: (input: {
        sessionID: string;
        agent: {
            name: string;
            temperature?: number;
            topP?: number;
            topK?: number;
            options?: Record<string, unknown>;
        };
        model: {
            providerID: string;
            id: string;
        };
        provider: {
            options?: Record<string, unknown>;
        };
        message: {
            id: string;
            variant?: string;
            metadata?: any;
        };
    }, output: {
        temperature?: number;
        topP?: number;
        topK?: number;
        options: Record<string, any>;
    }) => void | Promise<void>;
    /** Called when a text part completes — plugins may rewrite the final text */
    "experimental.text.complete"?: (input: {
        sessionID: string;
        messageID: string;
        partID: string;
    }, output: {
        text: string;
    }) => void | Promise<void>;
}
export interface AuthHook {
    provider: string;
    loader: (input: {
        providerID: string;
    }) => Promise<AuthOuathResult | undefined>;
    methods?: AuthMethod[];
}
export interface AuthMethod {
    id: string;
    name: string;
    type: "oauth" | "api_key";
}
/** OAuth result returned from an auth plugin loader */
export interface AuthOuathResult {
    token: string;
    expiresAt?: number;
    refreshToken?: string;
    providerID?: string;
}
//# sourceMappingURL=index.d.ts.map