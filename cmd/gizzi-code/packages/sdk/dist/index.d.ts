// Hand-authored public SDK facade.
// The root package stays stable even as the generated transport evolves underneath it.
import type { Event } from "./gen/entity-types";

export * from "./gen/entity-types";
export * from "./gen/types.gen";
export * from "./tools";

export type AssetRef = string | { asset_id: string };

export interface CreateAllternitClientConfig {
  baseUrl?: string;
  fetch?: typeof fetch;
  headers?: Record<string, string>;
  directory?: string;
  signal?: AbortSignal;
  responseTransformer?: (value: unknown) => unknown | Promise<unknown>;
  [key: string]: unknown;
}

export declare class AllternitClient {
  static readonly __registry: {
    get(key?: string): AllternitClient;
    set(value: AllternitClient, key?: string): void;
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

export declare function createAllternitClient(config?: CreateAllternitClientConfig): AllternitClient;
export declare const createAllternit: typeof createAllternitClient;
