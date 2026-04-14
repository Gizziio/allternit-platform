// Re-export A2RClient declarations from client.d.ts
// This file exists so index.d.ts can resolve './a2r-client.js' to proper types.
export { A2RClient, createA2RClient } from './client.js';
export type { Client, ClientOptions } from './client/index.js';
