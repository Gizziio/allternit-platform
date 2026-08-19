/**
 * Ambient type declarations for the generated Allternit HTTP client.
 *
 * The generated client source lives in packages/sdk/src/gen and is emitted to
 * packages/sdk/dist/gen by the build. These declarations let the SDK source
 * import them with full type safety.
 */

declare module './gen/allternit-client.js' {
  export declare class AllternitClient {
    static readonly __registry: {
      get(key?: string): AllternitClient;
      set(value: AllternitClient, key?: string): void;
    };
    constructor(args?: { client?: unknown; key?: string });
    events(options?: { signal?: AbortSignal }): AsyncIterableIterator<import('./gen/entity-types.js').Event>;
    globalEvents(options?: { signal?: AbortSignal }): AsyncIterableIterator<import('./gen/entity-types.js').Event>;
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

declare module './gen/entity-types.js' {
  export interface Event {
    type: string;
    [key: string]: unknown;
  }
}
