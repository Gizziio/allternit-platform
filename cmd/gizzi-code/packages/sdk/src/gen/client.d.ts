import { type Client, type ClientOptions } from "./client/index.js";
import type { Event } from "./entity-types.js";

export declare class AllternitClient {
  static readonly __registry: {
    get(key?: string): AllternitClient;
    set(value: AllternitClient, key?: string): void;
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

export declare function createAllternitClient(config?: {
  baseUrl?: string;
  fetch?: typeof fetch;
  headers?: Record<string, string>;
  directory?: string;
  signal?: AbortSignal;
}): AllternitClient;

export * from "./types.gen.js";
export type { Client, ClientOptions };
