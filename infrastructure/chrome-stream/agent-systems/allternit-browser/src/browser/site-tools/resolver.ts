import type { SiteToolDescriptor } from '@allternit/computer-use-protocol';
import { originMatches, type SiteTool } from './registry.js';

export type ResolutionTier = 'site-tool' | 'dom-refs' | 'vision';

export interface ResolutionPlan {
  /** Preference order for the model/action resolver. */
  order: ResolutionTier[];
  /** Site tool descriptors available for the active origin, if any. */
  tools: SiteToolDescriptor[];
}

/**
 * Action resolution preference:
 *   origin matches a registered site tool → site tool first, then DOM refs, then vision
 *   otherwise                              → DOM refs first, then vision
 * Site tools are a preference, never a hard gate: the existing ref-based
 * action path remains the fallback when a tool does not apply or fails.
 */
export function planResolution(tools: SiteTool[], origin: string | null | undefined): ResolutionPlan {
  const matched = origin ? tools.filter((tool) => originMatches(origin, tool.allowedDomains)) : [];
  if (matched.length > 0) {
    return { order: ['site-tool', 'dom-refs', 'vision'], tools: matched.map((tool) => tool.descriptor) };
  }
  return { order: ['dom-refs', 'vision'], tools: [] };
}
