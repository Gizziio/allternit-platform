/**
 * Remote Session Management
 * Manages remote control sessions to VMs, capsules, and other resources
 */
import type { RemoteSession, RemoteControlOptions } from "./types";
export declare class SessionManager {
    private apiBaseUrl;
    private authToken?;
    private wsUrl?;
    private activeSessions;
    private wsConnections;
    constructor(options?: RemoteControlOptions);
    list(): Promise<RemoteSession[]>;
    connect(session: {
        type: "vm" | "capsule" | "plugin" | "ssh";
        id: string;
        protocol?: "ssh" | "vnc" | "serial" | "tcp";
    }): Promise<RemoteSession>;
    disconnect(sessionId: string): Promise<void>;
    disconnectAll(): Promise<void>;
    getActiveSessions(): RemoteSession[];
    attachShell(sessionId: string): Promise<{
        wsUrl: string;
        token: string;
    }>;
    streamLogs(sessionId: string, onLog: (data: string) => void, onError?: (error: Error) => void): Promise<() => void>;
}
export declare function createSessionManager(options?: RemoteControlOptions): SessionManager;
//# sourceMappingURL=sessions.d.ts.map