/**
 * Avatar Adapters - Pluggable avatar rendering system.
 * Extracted from the private @allternit/avatar-adapters package.
 */

import type { VisualState, AvatarSize } from '@/types/visual-state';
import type { ReactNode } from 'react';
import { getMoodColor } from '@/types/visual-state';

export interface AdapterSettings {
  adapter: string;
  animate: boolean;
  showConfidence: boolean;
  showReliability: boolean;
  animationSpeed: number;
}

export interface AvatarAdapter {
  name: string;
  displayName: string;
  description: string;
  render(state: VisualState, size: AvatarSize): ReactNode;
}

const adapterRegistry = new Map<string, AvatarAdapter>();
let currentAdapterName = 'default';
let settings: AdapterSettings = {
  adapter: 'default',
  animate: true,
  showConfidence: true,
  showReliability: false,
  animationSpeed: 1.0,
};

// Default adapter - simple colored circle
const defaultAdapter: AvatarAdapter = {
  name: 'default',
  displayName: 'Default',
  description: 'Simple colored circle based on mood',
  render: (state: VisualState, size: AvatarSize): ReactNode => {
    const sizePx = typeof size === 'number' ? size : { xs: 24, sm: 32, md: 48, lg: 64, xl: 96 }[size] ?? 48;
    const color = getMoodColor(state.mood);
    return {
      type: 'div',
      props: {
        style: {
          width: sizePx,
          height: sizePx,
          borderRadius: '50%',
          backgroundColor: color,
          opacity: 0.5 + state.confidence * 0.5,
        },
      },
    };
  },
};

adapterRegistry.set('default', defaultAdapter);

export function getAdapterRegistry(): Map<string, AvatarAdapter> {
  return adapterRegistry;
}

export function loadAdapterSettings(): AdapterSettings {
  return { ...settings };
}

export function saveAdapterSettings(newSettings: Partial<AdapterSettings>): void {
  settings = { ...settings, ...newSettings };
}

export function getCurrentAdapter(): AvatarAdapter {
  return adapterRegistry.get(settings.adapter) ?? defaultAdapter;
}

export function registerAdapter(adapter: AvatarAdapter): void {
  adapterRegistry.set(adapter.name, adapter);
}
