/**
 * Message Router
 * 
 * Routes messages between content scripts, native host, and WebSocket.
 */

export class MessageRouter {
  private handlers: Map<string, (message: unknown) => void> = new Map();

  register(type: string, handler: (message: unknown) => void): void {
    this.handlers.set(type, handler);
  }

  route(message: { type: string; [key: string]: unknown }): void {
    const handler = this.handlers.get(message.type);
    if (handler) {
      handler(message);
    }
  }
}
