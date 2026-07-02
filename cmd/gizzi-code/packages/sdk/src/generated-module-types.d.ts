/**
 * Ambient type declarations for the generated Allternit HTTP client.
 *
 * The runtime modules live in packages/sdk/dist/gen and are produced by
 * packages/sdk/js/script/build.ts. These declarations let the SDK source
 * import them with full type safety without requiring the generated .ts
 * source files to be part of the type-check.
 */

declare module '../../dist/gen/allternit-client.js' {
  export declare class AllternitClient {
    static readonly __registry: {
      get(key?: string): AllternitClient;
      set(value: AllternitClient, key?: string): void;
    };
    constructor(args?: { client?: unknown; key?: string });
    events(options?: { signal?: AbortSignal }): AsyncIterableIterator<import('../../dist/gen/entity-types.js').Event>;
    globalEvents(options?: { signal?: AbortSignal }): AsyncIterableIterator<import('../../dist/gen/entity-types.js').Event>;
    on<T extends string>(
      type: T,
      options?: { signal?: AbortSignal }
    ): AsyncIterableIterator<unknown>;
    [key: string]: unknown;
  }

  export declare function createAllternitClient(config?: {
    baseUrl?: string;
    fetch?: typeof fetch;
    headers?: Record<string, string>;
    directory?: string;
    signal?: AbortSignal;
  }): AllternitClient;
}

declare module '../../dist/gen/entity-types.js' {
  export interface Event {
    type: string;
    [key: string]: unknown;
  }
}
