import type { ReactNode } from 'react';
import type { OfficeExtensionDescriptor } from '../../bridge/types';
import { AllternitAssistantPanel } from './AllternitAssistantPanel';

export const ALLTERNIT_ASSISTANT_EXTENSION_ID = 'allternit-assistant';

/**
 * First-party extension: a host-AI-backed chat assistant that occupies the
 * per-app AI chat section (via `OfficeAiSlot`) in every office app. The panel
 * inherits the host's AI client (`useOfficeAi`), model catalog, and agent
 * loop, so it works identically on the platform surface, the standalone
 * office surface, and the desktop.
 */
export function createAllternitAssistantExtension(): OfficeExtensionDescriptor {
  return {
    id: ALLTERNIT_ASSISTANT_EXTENSION_ID,
    name: 'Allternit Assistant',
    icon: '✦',
    render: (ctx): ReactNode => <AllternitAssistantPanel ctx={ctx} />,
  };
}
