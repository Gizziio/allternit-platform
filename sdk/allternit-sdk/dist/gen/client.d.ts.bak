import { type Client, type ClientOptions } from "./client/index.js";
import type { Event } from "./entity-types.js";

export declare class A2RClient {
  static readonly __registry: {
    get(key?: string): A2RClient;
    set(value: A2RClient, key?: string): void;
  };
  protected client: Client;
  constructor(args?: { client?: Client; key?: string });
  [key: string]: any;
  events(options?: { signal?: AbortSignal }): AsyncIterableIterator<Event>;
  globalEvents(options?: { signal?: AbortSignal }): AsyncIterableIterator<Event>;
  on<T extends Event["type"]>(
    type: T,
    options?: { signal?: AbortSignal },
  ): AsyncIterableIterator<Extract<Event, { type: T }>>;
}

export declare function createA2RClient(config?: {
  baseUrl?: string;
  fetch?: typeof fetch;
  headers?: Record<string, string>;
  directory?: string;
  signal?: AbortSignal;
}): A2RClient;

export * from "./types.gen.js";
export type { Client, ClientOptions };
