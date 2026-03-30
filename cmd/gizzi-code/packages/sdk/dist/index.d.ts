// Hand-authored public SDK facade.
// The root package stays stable even as the generated transport evolves underneath it.
import type { Event } from "./gen/entity-types";

export * from "./gen/entity-types";
export * from "./gen/types.gen";
export * from "./tools";

export type AssetRef = string | { asset_id: string };

export interface CreateA2RClientConfig {
  baseUrl?: string;
  fetch?: typeof fetch;
  headers?: Record<string, string>;
  directory?: string;
  signal?: AbortSignal;
  responseTransformer?: (value: unknown) => unknown | Promise<unknown>;
  [key: string]: unknown;
}

export declare class A2RClient {
  static readonly __registry: {
    get(key?: string): A2RClient;
    set(value: A2RClient, key?: string): void;
  };
  constructor(args?: { client?: unknown; key?: string });
  [key: string]: any;
  events(options?: { signal?: AbortSignal }): AsyncIterableIterator<Event>;
  globalEvents(options?: { signal?: AbortSignal }): AsyncIterableIterator<Event>;
  on<T extends Event["type"]>(
    type: T,
    options?: { signal?: AbortSignal },
  ): AsyncIterableIterator<Extract<Event, { type: T }>>;
}

export declare function createA2RClient(config?: CreateA2RClientConfig): A2RClient;
export declare const createA2R: typeof createA2RClient;
