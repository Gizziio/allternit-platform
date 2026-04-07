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
export class MirrorSync extends EventEmitter {
    apiBaseUrl;
    sessions = new Map();
    webSockets = new Map();
    constructor(apiBaseUrl = 'http://localhost:3001') {
        super();
        this.apiBaseUrl = apiBaseUrl;
    }
    /**
     * Create mirror session when Cowork session starts
     */
    async onSessionStart(sessionId, runId) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/v1/mirror`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    run_id: runId,
                    ttl_minutes: 60,
                }),
            });
            if (!response.ok) {
                throw new Error(`Failed to create mirror session: ${response.status}`);
            }
            const mirrorSession = await response.json();
            this.sessions.set(sessionId, mirrorSession);
            console.log(`[MirrorSync] Created mirror session ${mirrorSession.id} for run ${runId}`);
            this.emit('session-created', { sessionId, mirrorSession });
            return mirrorSession;
        }
        catch (error) {
            console.error('[MirrorSync] Failed to create mirror session:', error);
            return null;
        }
    }
    /**
     * Forward terminal output to mirror WebSocket
     */
    onTerminalOutput(sessionId, output) {
        const mirrorSession = this.sessions.get(sessionId);
        if (!mirrorSession)
            return;
        const ws = this.getWebSocket(mirrorSession.id);
        if (ws && ws.readyState === WebSocket.OPEN) {
            const message = {
                type: 'output',
                content: output,
                timestamp: Date.now(),
            };
            ws.send(JSON.stringify(message));
        }
    }
    /**
     * Forward file diff to mirror WebSocket for approval
     */
    onFileDiff(sessionId, diff) {
        const mirrorSession = this.sessions.get(sessionId);
        if (!mirrorSession)
            return;
        const ws = this.getWebSocket(mirrorSession.id);
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(diff));
        }
    }
    /**
     * Handle approval from mobile
     */
    onApproval(sessionId, diffId, approved) {
        console.log(`[MirrorSync] Approval for ${diffId} in session ${sessionId}: ${approved ? 'approved' : 'rejected'}`);
        this.emit('approval', { sessionId, diffId, approved });
    }
    /**
     * Handle command from mobile
     */
    onCommand(sessionId, content) {
        console.log(`[MirrorSync] Command from mobile for session ${sessionId}: ${content}`);
        this.emit('command', { sessionId, content });
    }
    /**
     * Get or create WebSocket for mirror session
     */
    getWebSocket(mirrorSessionId) {
        // Check if we already have a WebSocket
        let ws = this.webSockets.get(mirrorSessionId);
        if (ws && ws.readyState === WebSocket.OPEN) {
            return ws;
        }
        // Create new WebSocket connection
        const mirrorSession = this.sessions.get(mirrorSessionId);
        if (!mirrorSession)
            return null;
        const wsUrl = `ws://localhost:3001/api/v1/mirror/${mirrorSessionId}/stream?token=${mirrorSession.access_token}`;
        ws = new WebSocket(wsUrl);
        ws.onopen = () => {
            console.log(`[MirrorSync] WebSocket connected for session ${mirrorSessionId}`);
            this.webSockets.set(mirrorSessionId, ws);
        };
        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                switch (message.type) {
                    case 'command':
                        this.onCommand(mirrorSessionId, message.content);
                        break;
                    case 'approval':
                        this.onApproval(mirrorSessionId, message.diff_id, message.approved);
                        break;
                }
            }
            catch (error) {
                console.error('[MirrorSync] Failed to parse WebSocket message:', error);
            }
        };
        ws.onclose = () => {
            console.log(`[MirrorSync] WebSocket closed for session ${mirrorSessionId}`);
            this.webSockets.delete(mirrorSessionId);
        };
        ws.onerror = (error) => {
            console.error('[MirrorSync] WebSocket error:', error);
        };
        return ws;
    }
    /**
     * Clean up session
     */
    async onSessionEnd(sessionId) {
        const mirrorSession = this.sessions.get(sessionId);
        if (!mirrorSession)
            return;
        try {
            // Close WebSocket
            const ws = this.webSockets.get(mirrorSession.id);
            if (ws) {
                ws.close();
                this.webSockets.delete(mirrorSession.id);
            }
            // End mirror session via API
            await fetch(`${this.apiBaseUrl}/api/v1/mirror/${mirrorSession.id}`, {
                method: 'DELETE',
            });
            this.sessions.delete(sessionId);
            console.log(`[MirrorSync] Ended mirror session ${mirrorSession.id}`);
        }
        catch (error) {
            console.error('[MirrorSync] Failed to end mirror session:', error);
        }
    }
}
// Export singleton instance
export const mirrorSync = new MirrorSync();
export default mirrorSync;
