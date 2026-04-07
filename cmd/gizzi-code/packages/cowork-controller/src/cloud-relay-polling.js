/**
 * Cloud Relay Client - Polling Architecture
 *
 * HTTP-based cloud relay for enterprise scalability.
 * No WebSockets, works through any firewall/proxy.
 *
 * Pattern:
 * Desktop: POST /poll → "any messages for me?"
 * Desktop: POST /send → "here's my output"
 * Mobile:  POST /send → "here's my command"
 * Mobile:  GET  /stream (SSE) → receives terminal output
 */
import { Log } from '@/runtime/util/log';
const log = Log.create({ service: 'cowork.cloud-relay-polling' });
/**
 * Polling-based Cloud Relay Client
 *
 * Uses HTTP POST for sending, HTTP GET/POST for receiving.
 * No persistent connections = firewall friendly.
 */
export class PollingCloudRelayClient {
    options;
    pollTimer = null;
    isRunning = false;
    lastPollTime = 0;
    messageQueue = [];
    pendingMessages = new Map();
    onMessageCallback = null;
    onErrorCallback = null;
    retryCount = 0;
    constructor(options) {
        this.options = {
            pollInterval: 500,
            maxRetries: 5,
            authToken: '',
            ...options,
        };
    }
    /**
     * Start the polling loop
     */
    async start() {
        if (this.isRunning)
            return;
        this.isRunning = true;
        log.info('Starting polling relay', {
            sessionId: this.options.sessionId,
            relayUrl: this.options.relayUrl,
            interval: this.options.pollInterval
        });
        // Register session with relay
        await this.registerSession();
        // Start polling loop
        this.schedulePoll();
    }
    /**
     * Stop the polling loop
     */
    stop() {
        this.isRunning = false;
        if (this.pollTimer) {
            clearTimeout(this.pollTimer);
            this.pollTimer = null;
        }
        log.info('Stopped polling relay');
    }
    /**
     * Send a message to the relay
     */
    async sendMessage(message) {
        const fullMessage = {
            ...message,
            timestamp: Date.now(),
            messageId: this.generateMessageId(),
        };
        const url = `${this.options.relayUrl}/api/v1/relay/${this.options.sessionId}/messages`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.options.authToken}`,
                    'X-Session-ID': this.options.sessionId,
                },
                body: JSON.stringify(fullMessage),
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const result = await response.json();
            this.retryCount = 0; // Reset on success
            return result;
        }
        catch (error) {
            log.error('Failed to send message', { error, messageType: message.type });
            // Queue for retry
            this.messageQueue.push(fullMessage);
            return {
                success: false,
                messageId: fullMessage.messageId,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
    /**
     * Send terminal output to relay
     */
    async sendOutput(output, metadata) {
        await this.sendMessage({
            type: 'output',
            payload: { output, metadata },
            sender: 'desktop',
        });
    }
    /**
     * Send approval request to relay
     */
    async sendApprovalRequest(request) {
        await this.sendMessage({
            type: 'approval_request',
            payload: request,
            sender: 'desktop',
        });
    }
    /**
     * Send approval response to relay
     */
    async sendApprovalResponse(approvalId, approved, reason) {
        await this.sendMessage({
            type: 'approval_response',
            payload: { approvalId, approved, reason },
            sender: 'desktop',
        });
    }
    /**
     * Set callback for received messages
     */
    onMessage(callback) {
        this.onMessageCallback = callback;
    }
    /**
     * Set callback for errors
     */
    onError(callback) {
        this.onErrorCallback = callback;
    }
    /**
     * Check if client is running
     */
    isActive() {
        return this.isRunning;
    }
    /**
     * Get connection status
     */
    getStatus() {
        return {
            running: this.isRunning,
            lastPollTime: this.lastPollTime,
            queuedMessages: this.messageQueue.length,
            retryCount: this.retryCount,
        };
    }
    async registerSession() {
        const url = `${this.options.relayUrl}/api/v1/relay/${this.options.sessionId}/register`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.options.authToken}`,
                },
                body: JSON.stringify({
                    sessionId: this.options.sessionId,
                    clientType: 'desktop',
                    timestamp: Date.now(),
                }),
            });
            if (!response.ok) {
                throw new Error(`Registration failed: ${response.status}`);
            }
            log.info('Session registered with relay');
        }
        catch (error) {
            log.error('Failed to register session', { error });
            throw error;
        }
    }
    async poll() {
        if (!this.isRunning)
            return;
        const url = `${this.options.relayUrl}/api/v1/relay/${this.options.sessionId}/poll`;
        try {
            // First, send any queued messages
            await this.flushQueue();
            // Then poll for new messages
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.options.authToken}`,
                    'X-Session-ID': this.options.sessionId,
                },
                body: JSON.stringify({
                    lastPollTime: this.lastPollTime,
                    clientType: 'desktop',
                }),
            });
            if (!response.ok) {
                throw new Error(`Poll failed: ${response.status}`);
            }
            const data = await response.json();
            this.lastPollTime = Date.now();
            this.retryCount = 0;
            // Process received messages
            if (data.messages && data.messages.length > 0) {
                log.debug('Received messages', { count: data.messages.length });
                for (const message of data.messages) {
                    if (this.onMessageCallback) {
                        this.onMessageCallback(message);
                    }
                }
            }
            // If there are more messages, poll immediately
            if (data.hasMore) {
                this.schedulePoll(0);
                return;
            }
        }
        catch (error) {
            log.error('Poll error', { error });
            this.retryCount++;
            if (this.retryCount >= this.options.maxRetries) {
                log.error('Max retries reached, stopping relay');
                this.stop();
                if (this.onErrorCallback) {
                    this.onErrorCallback(error instanceof Error ? error : new Error(String(error)));
                }
                return;
            }
            // Exponential backoff
            const backoffDelay = Math.min(1000 * Math.pow(2, this.retryCount), 30000);
            this.schedulePoll(backoffDelay);
            return;
        }
        // Schedule next poll
        this.schedulePoll(this.options.pollInterval);
    }
    async flushQueue() {
        if (this.messageQueue.length === 0)
            return;
        const messages = [...this.messageQueue];
        this.messageQueue = [];
        for (const message of messages) {
            try {
                await this.sendMessage(message);
            }
            catch (error) {
                // Put back in queue for retry
                this.messageQueue.unshift(message);
                break;
            }
        }
    }
    schedulePoll(delay) {
        if (!this.isRunning)
            return;
        const actualDelay = delay ?? this.options.pollInterval;
        if (this.pollTimer) {
            clearTimeout(this.pollTimer);
        }
        this.pollTimer = setTimeout(() => {
            this.poll().catch(() => {
                // Error handled in poll()
            });
        }, actualDelay);
    }
    generateMessageId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}
/**
 * Create a polling cloud relay client
 */
export function createPollingCloudRelayClient(options) {
    return new PollingCloudRelayClient(options);
}
// Default relay URL
export const DEFAULT_POLLING_RELAY_URL = 'https://cowork.a2r.com';
export default PollingCloudRelayClient;
