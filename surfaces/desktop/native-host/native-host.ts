#!/usr/bin/env ts-node
/**
 * Native Messaging Host
 * 
 * Standalone process that bridges Chrome Extension and A2R Desktop.
 * Communicates via stdin/stdout using Chrome's native messaging protocol.
 */

import * as fs from 'fs';
import * as net from 'net';

// Protocol: Each message is preceded by a 32-bit length in native byte order
interface NativeMessage {
  id: string;
  type: string;
  payload?: unknown;
  timestamp: number;
}

// Connect to Desktop app via TCP socket
const DESKTOP_PORT = 3011;
const DESKTOP_HOST = '127.0.0.1';

class NativeMessagingHost {
  private desktopSocket: net.Socket | null = null;
  private messageQueue: NativeMessage[] = [];
  private connected = false;

  constructor() {
    this.connectToDesktop();
  }

  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimer: NodeJS.Timeout | null = null;

  private connectToDesktop(): void {
    console.error('[NativeHost] Connecting to Desktop on port', DESKTOP_PORT);
    
    // Clear any pending reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    this.desktopSocket = new net.Socket();
    
    this.desktopSocket.connect(DESKTOP_PORT, DESKTOP_HOST, () => {
      console.error('[NativeHost] Connected to Desktop');
      this.connected = true;
      this.reconnectAttempts = 0;
      this.flushQueue();
      
      // Send registration message
      this.sendToDesktop({
        id: `reg-${Date.now()}`,
        type: 'register',
        payload: { clientType: 'chrome-extension' },
        timestamp: Date.now(),
      });
    });

    this.desktopSocket.on('data', (data) => {
      // Handle line-delimited JSON messages from Desktop
      const lines = data.toString().split('\n').filter(line => line.trim());
      for (const line of lines) {
        try {
          const message = JSON.parse(line);
          this.sendToChrome(message);
        } catch (error) {
          console.error('[NativeHost] Failed to parse Desktop message:', error);
        }
      }
    });

    this.desktopSocket.on('close', () => {
      console.error('[NativeHost] Desktop connection closed');
      this.connected = false;
      this.scheduleReconnect();
    });

    this.desktopSocket.on('error', (error) => {
      console.error('[NativeHost] Desktop socket error:', error);
      this.connected = false;
      // Don't schedule reconnect here, let 'close' event handle it
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    
    this.reconnectAttempts++;
    if (this.reconnectAttempts > this.maxReconnectAttempts) {
      console.error('[NativeHost] Max reconnect attempts reached, exiting');
      process.exit(1);
    }
    
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts - 1), 30000);
    console.error(`[NativeHost] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connectToDesktop();
    }, delay);
  }

  private sendToDesktop(message: NativeMessage): void {
    if (this.connected && this.desktopSocket) {
      this.desktopSocket.write(JSON.stringify(message) + '\n');
    } else {
      this.messageQueue.push(message);
    }
  }

  private flushQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()!;
      this.sendToDesktop(message);
    }
  }

  private sendToChrome(message: NativeMessage): void {
    const messageBuffer = Buffer.from(JSON.stringify(message));
    const lengthBuffer = Buffer.allocUnsafe(4);
    lengthBuffer.writeUInt32LE(messageBuffer.length, 0);
    
    process.stdout.write(lengthBuffer);
    process.stdout.write(messageBuffer);
  }

  start(): void {
    console.error('[NativeHost] Starting native messaging host');

    let buffer = Buffer.alloc(0);
    let messageLength = 0;

    process.stdin.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);

      // Process complete messages
      while (buffer.length >= 4) {
        if (messageLength === 0) {
          messageLength = buffer.readUInt32LE(0);
        }

        if (buffer.length >= 4 + messageLength) {
          // Extract message
          const messageBuffer = buffer.slice(4, 4 + messageLength);
          buffer = buffer.slice(4 + messageLength);
          messageLength = 0;

          try {
            const message = JSON.parse(messageBuffer.toString()) as NativeMessage;
            console.error('[NativeHost] Received from Chrome:', message.type);
            
            // Forward to Desktop
            this.sendToDesktop(message);
          } catch (error) {
            console.error('[NativeHost] Failed to parse Chrome message:', error);
          }
        } else {
          // Wait for more data
          break;
        }
      }
    });

    process.stdin.on('end', () => {
      console.error('[NativeHost] Chrome disconnected');
      process.exit(0);
    });

    // Keep process alive
    setInterval(() => {}, 1000);
  }
}

// Start the host
const host = new NativeMessagingHost();
host.start();
