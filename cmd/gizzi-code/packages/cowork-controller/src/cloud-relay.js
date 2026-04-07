/**
 * Cloud Relay Client
 *
 * Connects outbound to cloud relay server for remote control from anywhere.
 * This enables Claude Code-style remote access without inbound ports.
 *
 * Architecture:
 * Gizzi-Code TUI → WebSocket (outbound) → Cloud Relay → Mobile/Browser
 *
 * No inbound ports required - firewall friendly.
 */
import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { Log } from '@/runtime/util/log';
const log = Log.create({ service: 'cowork.cloud-relay' });
export class CloudRelayClient extends EventEmitter {
    ws = null;
    options;
    reconnectTimer = null;
    connected = false;
    messageQueue = [];
    constructor(options) {
        super();
        this.options = {
            reconnectInterval: 5000,
            authToken: '',
            debug: false,
            ...options,
        };
    }
    /**
     * Connect to cloud relay
     */
    async connect() {
        if (this.connected || this.ws?.readyState === WebSocket.OPEN) {
            log.info('Already connected to cloud relay');
            return;
        }
        try {
            const url = new URL('/relay', this.options.relayUrl);
            url.searchParams.set('sessionId', this.options.sessionId);
            if (this.options.authToken) {
                url.searchParams.set('token', this.options.authToken);
            }
            log.info('Connecting to cloud relay', { url: url.toString() });
            this.ws = new WebSocket(url.toString(), {
                headers: {
                    'X-Session-ID': this.options.sessionId,
                    'X-Auth-Token': this.options.authToken,
                },
            });
            this.ws.on('open', () => {
                log.info('Connected to cloud relay');
                this.connected = true;
                this.emit('connected');
                this.flushMessageQueue();
            });
            this.ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.handleMessage(message);
                }
                catch (err) {
                    log.error('Failed to parse relay message', { error: err });
                }
            });
            this.ws.on('close', (code, reason) => {
                log.info('Cloud relay connection closed', { code, reason: reason.toString() });
                this.connected = false;
                this.emit('disconnected');
                this.scheduleReconnect();
            });
            this.ws.on('error', (error) => {
                log.error('Cloud relay connection error', { error: error.message });
                this.emit('error', error);
                this.ws?.close();
            });
        }
        catch (error) {
            log.error('Failed to connect to cloud relay', { error });
            this.scheduleReconnect();
        }
    }
    /**
     * Disconnect from cloud relay
     */
    disconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.ws) {
            this.ws.close(1000, 'Client disconnecting');
            this.ws = null;
        }
        this.connected = false;
        log.info('Disconnected from cloud relay');
    }
    /**
     * Send session event to relay
     */
    sendEvent(event) {
        const message = {
            ...event,
            timestamp: Date.now(),
            sessionId: this.options.sessionId,
        };
        if (this.connected && this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
            return true;
        }
        else {
            // Queue message for when connection is ready
            this.messageQueue.push(message);
            return false;
        }
    }
    /**
     * Send terminal output to relay
     */
    sendOutput(output, metadata) {
        this.sendEvent({
            type: 'session_event',
            payload: {
                eventType: 'output',
                data: output,
                metadata,
            },
        });
    }
    /**
     * Send approval request to relay
     */
    sendApprovalRequest(request) {
        this.sendEvent({
            type: 'approval_request',
            payload: request,
        });
    }
    /**
     * Send approval response to relay
     */
    sendApprovalResponse(approvalId, approved, reason) {
        this.sendEvent({
            type: 'approval_response',
            payload: {
                approvalId,
                approved,
                reason,
            },
        });
    }
    /**
     * Check if connected to relay
     */
    isConnected() {
        return this.connected && this.ws?.readyState === WebSocket.OPEN;
    }
    /**
     * Get connection status
     */
    getStatus() {
        return {
            connected: this.isConnected(),
            sessionId: this.options.sessionId,
            relayUrl: this.options.relayUrl,
            queuedMessages: this.messageQueue.length,
        };
    }
    handleMessage(message) {
        if (this.options.debug) {
            log.debug('Received relay message', { type: message.type });
        }
        switch (message.type) {
            case 'command':
                // Command from mobile/browser
                this.emit('command', message.payload);
                break;
            case 'approval_response':
                // Approval response from mobile
                this.emit('approvalResponse', message.payload);
                break;
            case 'status':
                // Status update from relay server
                this.emit('status', message.payload);
                break;
            default:
                this.emit('message', message);
        }
    }
    scheduleReconnect() {
        if (this.reconnectTimer)
            return;
        log.info('Scheduling reconnect', { delay: this.options.reconnectInterval });
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect().catch(() => {
                // Reconnect will be scheduled again on failure
            });
        }, this.options.reconnectInterval);
    }
    flushMessageQueue() {
        if (this.messageQueue.length === 0)
            return;
        log.info('Flushing message queue', { count: this.messageQueue.length });
        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            if (message && this.ws?.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify(message));
            }
        }
    }
}
/**
 * Create a cloud relay client
 */
export function createCloudRelayClient(options) {
    return new CloudRelayClient(options);
}
// Default relay URL (to be replaced with actual deployment)
export const DEFAULT_CLOUD_RELAY_URL = 'wss://cowork.a2r.com';
export default CloudRelayClient;
