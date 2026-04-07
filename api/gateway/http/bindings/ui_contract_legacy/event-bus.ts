import { EventEmitter } from "node:events";

export interface CanonicalEvent {
  directory: string;
  type: string;
  properties?: Record<string, unknown>;
}

export interface OpenCodeStreamEvent {
  directory: string;
  payload: {
    type: string;
    properties: Record<string, unknown>;
  };
}

export interface CanonicalEventSource {
  onCanonicalEvent(listener: (event: CanonicalEvent) => void): () => void;
}

export function mapCanonicalEventToOpenCode(event: CanonicalEvent): OpenCodeStreamEvent {
  return {
    directory: event.directory || "global",
    payload: {
      type: event.type,
      properties: event.properties ?? {},
    },
  };
}

export class OpenCodeEventBus {
  private readonly emitter = new EventEmitter();
  private readonly unsubscribeSource: () => void;

  constructor(source: CanonicalEventSource) {
    this.unsubscribeSource = source.onCanonicalEvent((event) => {
      this.emitCanonical(event);
    });
  }

  emitCanonical(event: CanonicalEvent): void {
    this.emitter.emit("event", mapCanonicalEventToOpenCode(event));
  }

  subscribe(listener: (event: OpenCodeStreamEvent) => void): () => void {
    this.emitter.on("event", listener);
    return () => {
      this.emitter.off("event", listener);
    };
  }

  dispose(): void {
    this.unsubscribeSource();
    this.emitter.removeAllListeners();
  }
}
