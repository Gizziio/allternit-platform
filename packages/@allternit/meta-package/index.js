/**
 * Allternit SDK
 * 
 * Complete AI platform SDK for building intelligent applications.
 * 
 * @example
 * ```javascript
 * import { AllternitClient } from '@allternit/sdk';
 * 
 * const client = new AllternitClient({ apiKey: 'xxx' });
 * const workspaces = await client.workspaces.list();
 * ```
 */

// Re-export from api-client
export { AllternitClient, AllternitApiError, createClient } from '@allternit/api-client';

// Re-export types
export * from '@allternit/types';

// Re-export adapters
export * from '@allternit/adapters';

// Re-export workflow engine
export * from '@allternit/workflow-engine';

// Re-export executor core
export * from '@allternit/executor-core';

// Re-export form surfaces
export * from '@allternit/form-surfaces';

// Re-export visual state
export * from '@allternit/visual-state';

// Re-export viz
export * from '@allternit/viz';

// Re-export browser tools
export * from '@allternit/browser-tools';

// Re-export parallel run
export * from '@allternit/parallel-run';

// Re-export ix
export * from '@allternit/ix';

// Re-export plugin SDK
export * from '@allternit/plugin-sdk';

// Version
export const VERSION = '1.0.0';
