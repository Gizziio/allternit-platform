/**
 * Svelte Renderer
 * 
 * Generates Svelte component code from A2R-IX UI IR.
 * 
 * @example
 * ```typescript
 * import { createSvelteRenderer, compileToSvelte } from '@allternit/ix/svelte';
 * 
 * const svelteCode = compileToSvelte(uiDefinition);
 * // Use with Svelte compiler
 * ```
 */

export {
  createSvelteRenderer,
  compileToSvelte,
  type SvelteRenderer,
  type SvelteRendererConfig,
} from './renderer';
