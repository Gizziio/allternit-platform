// Re-export AllternitClient declarations from client.d.ts
// This file exists so index.d.ts can resolve './allternit-client.js' to proper types.
export { AllternitClient, createAllternitClient } from './client.js';
export type { Client, ClientOptions } from './client/index.js';
