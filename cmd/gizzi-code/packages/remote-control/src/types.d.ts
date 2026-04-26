/**
 * Allternit Remote Control Types
 * Shared types for remote control of Allternit components
 */
export interface VM {
    id: string;
    name: string;
    status: "running" | "stopped" | "starting" | "stopping" | "error";
    ip?: string;
    cpus: number;
    memory: string;
    image?: string;
    createdAt?: Date;
}
export interface Capsule {
    id: string;
    name: string;
    status: "running" | "stopped" | "starting" | "stopping" | "error";
    image?: string;
    ports?: number[];
    createdAt?: Date;
}
export interface Plugin {
    id: string;
    name: string;
    version: string;
    enabled: boolean;
    description?: string;
    author?: string;
}
export interface RemoteSession {
    id: string;
    name: string;
    type: "vm" | "capsule" | "plugin" | "ssh" | "vnc";
    status: "connected" | "disconnected" | "connecting" | "error";
    host?: string;
    port?: number;
    metadata?: Record<string, unknown>;
}
export interface SystemStatus {
    healthy: boolean;
    uptime: number;
    version: string;
    cpu: {
        usage: number;
        perCore: number[];
    };
    memory: {
        used: number;
        total: number;
        swapUsed: number;
        swapTotal: number;
    };
    components: {
        runners: number;
        capsules: number;
        plugins: number;
        vms: number;
    };
}
export interface RemoteControlOptions {
    apiBaseUrl?: string;
    authToken?: string;
    wsUrl?: string;
}
//# sourceMappingURL=types.d.ts.map