/**
 * Renderer Controller
 *
 * Manages renderer mode (stream vs GPU) per tab.
 */

import type { TabId } from '../core/ids.js';
import {
  createEventBus,
  EVENT_RENDERER_CHANGED,
  createEvent,
} from '../core/index.js';

// ============================================================================
// Renderer Types
// ============================================================================

export type RendererMode = 'stream' | 'gpu';
export type RendererReason = 'user' | 'suggested' | 'policy';

export interface RendererState {
  mode: RendererMode;
  reason?: RendererReason;
}

// ============================================================================
// Renderer Controller Interface
// ============================================================================

export interface RendererController {
  get(tabId: TabId): RendererState;
  set(tabId: TabId, mode: RendererMode, reason?: RendererReason): void;
  suggest(tabId: TabId, mode: RendererMode): void;
}

// ============================================================================
// Renderer Controller Implementation
// ============================================================================

export function createRendererController(
  spaceId: string,
  eventBus?: ReturnType<typeof createEventBus>
): RendererController {
  const bus = eventBus || createEventBus(spaceId as any);
  const states = new Map<TabId, RendererState>();

  return {
    get(tabId: TabId): RendererState {
      return states.get(tabId) || { mode: 'stream' };
    },

    set(tabId: TabId, mode: RendererMode, reason: RendererReason = 'user'): void {
      const current = states.get(tabId);
      if (current?.mode === mode) return;

      states.set(tabId, { mode, reason });

      bus.emit(
        createEvent(
          EVENT_RENDERER_CHANGED,
          { tabId, mode, reason },
          { spaceId: spaceId as any, tabId }
        )
      );
    },

    suggest(tabId: TabId, mode: RendererMode): void {
      const current = states.get(tabId);
      // Only auto-switch if user hasn't explicitly chosen
      if (current?.reason !== 'user') {
        this.set(tabId, mode, 'suggested');
      }
    },
  };
}

// ============================================================================
// Renderer Suggestions (for video/WebGL domains)
// ============================================================================

const VIDEO_DOMAINS = ['youtube.com', 'vimeo.com', 'netflix.com', 'twitch.tv', 'disneyplus.com'];
const GPU_DOMAINS = ['codepen.io', 'jsfiddle.net', 'threejs.org', 'playground.cloud.tencent.com'];

/**
 * Suggest renderer mode based on URL
 */
export function suggestRendererForUrl(url: string): RendererMode {
  try {
    const hostname = new URL(url).hostname;

    if (VIDEO_DOMAINS.some((d) => hostname.includes(d))) {
      return 'gpu';
    }

    if (GPU_DOMAINS.some((d) => hostname.includes(d))) {
      return 'gpu';
    }

    return 'stream';
  } catch {
    return 'stream';
  }
}
