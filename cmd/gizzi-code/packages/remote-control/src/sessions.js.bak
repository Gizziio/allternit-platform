/**
 * Remote Session Management
 * Manages remote control sessions to VMs, capsules, and other resources
 */
import WebSocket from "ws";
export class SessionManager {
    apiBaseUrl;
    authToken;
    wsUrl;
    activeSessions = new Map();
    wsConnections = new Map();
    constructor(options = {}) {
        this.apiBaseUrl = options.apiBaseUrl || "http://localhost:3000/api/v1";
        this.authToken = options.authToken;
        this.wsUrl = options.wsUrl;
    }
    async list() {
        const response = await fetch(`${this.apiBaseUrl}/sessions`, {
            headers: this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {},
        });
        if (!response.ok) {
            throw new Error(`Failed to list sessions: ${response.statusText}`);
        }
        return response.json();
    }
    async connect(session) {
        const response = await fetch(`${this.apiBaseUrl}/sessions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {},
            },
            body: JSON.stringify(session),
        });
        if (!response.ok) {
            throw new Error(`Failed to create session: ${response.statusText}`);
        }
        const created = await response.json();
        this.activeSessions.set(created.id, created);
        return created;
    }
    async disconnect(sessionId) {
        const response = await fetch(`${this.apiBaseUrl}/sessions/${sessionId}`, {
            method: "DELETE",
            headers: this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {},
        });
        if (!response.ok) {
            throw new Error(`Failed to disconnect session: ${response.statusText}`);
        }
        this.activeSessions.delete(sessionId);
        const ws = this.wsConnections.get(sessionId);
        if (ws) {
            ws.close();
            this.wsConnections.delete(sessionId);
        }
    }
    async disconnectAll() {
        const sessions = await this.list();
        await Promise.all(sessions.map((s) => this.disconnect(s.id)));
    }
    getActiveSessions() {
        return Array.from(this.activeSessions.values());
    }
    async attachShell(sessionId) {
        const response = await fetch(`${this.apiBaseUrl}/sessions/${sessionId}/shell`, {
            method: "POST",
            headers: this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {},
        });
        if (!response.ok) {
            throw new Error(`Failed to attach shell: ${response.statusText}`);
        }
        return response.json();
    }
    async streamLogs(sessionId, onLog, onError) {
        if (!this.wsUrl) {
            throw new Error("WebSocket URL not configured");
        }
        const ws = new WebSocket(`${this.wsUrl}/sessions/${sessionId}/logs`, {
            headers: this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {},
        });
        ws.on("message", (data) => {
            onLog(data.toString());
        });
        ws.on("error", (error) => {
            onError?.(error);
        });
        this.wsConnections.set(sessionId, ws);
        return () => {
            ws.close();
            this.wsConnections.delete(sessionId);
        };
    }
}
export function createSessionManager(options) {
    return new SessionManager(options);
}
