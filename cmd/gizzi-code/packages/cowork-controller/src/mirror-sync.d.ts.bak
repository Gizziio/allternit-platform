/**
 * Mirror Sync - Sync Cowork Controller sessions with Mirror API
 *
 * This module:
 * 1. Listens for session creation events
 * 2. Creates mirror sessions via API
 * 3. Forwards terminal output to WebSocket
 * 4. Handles mobile commands (approve/reject)
 */
import { EventEmitter } from 'events';
interface MirrorSession {
    id: string;
    run_id: string;
    access_token: string;
    pairing_code: string;
    pairing_url: string;
    expires_at: string;
}
interface FileDiff {
    type: 'diff';
    diff_id: string;
    file_path: string;
    changes: Array<{
        type: string;
        content: string;
        line_number?: number;
    }>;
    timestamp: number;
}
export declare class MirrorSync extends EventEmitter {
    private apiBaseUrl;
    private sessions;
    private webSockets;
    constructor(apiBaseUrl?: string);
    /**
     * Create mirror session when Cowork session starts
     */
    onSessionStart(sessionId: string, runId: string): Promise<MirrorSession | null>;
    /**
     * Forward terminal output to mirror WebSocket
     */
    onTerminalOutput(sessionId: string, output: string): void;
    /**
     * Forward file diff to mirror WebSocket for approval
     */
    onFileDiff(sessionId: string, diff: FileDiff): void;
    /**
     * Handle approval from mobile
     */
    onApproval(sessionId: string, diffId: string, approved: boolean): void;
    /**
     * Handle command from mobile
     */
    onCommand(sessionId: string, content: string): void;
    /**
     * Get or create WebSocket for mirror session
     */
    private getWebSocket;
    /**
     * Clean up session
     */
    onSessionEnd(sessionId: string): Promise<void>;
}
export declare const mirrorSync: MirrorSync;
export default mirrorSync;
//# sourceMappingURL=mirror-sync.d.ts.map