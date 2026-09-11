/**
 * Runtime model ids for POST /api/agent-chat.
 *
 * The agent catalog uses a virtual `allternit/<model>` provider (platform
 * gateway). Local gizzi does not register that provider — it speaks real
 * backends like `kimi-cli/kimi-k3`. Sending the catalog id yields
 * ProviderModelNotFoundError after message_start and an empty reply.
 */
import type { Agent } from './agent.types';
import { resolveModelRef } from '@/lib/bots/bot-runtime-env';

export const MODEL_SELECTION_STORAGE_KEY = 'allternit:model-selection';

/** Last-resort local brain matching gizzi's unpaid default (first CLI). */
export const LOCAL_DEFAULT_RUNTIME_MODEL = 'kimi-cli/kimi-k3';

export function isVirtualPlatformModelRef(ref: string | null | undefined): boolean {
  if (!ref) return false;
  const provider = ref.split('/')[0];
  return provider === 'allternit' || provider === 'auto';
}

/**
 * Composer-persisted `provider/model`. Returns null when unset or malformed.
 */
export function readComposerRuntimeModelId(): string | null {
  try {
    const raw = typeof window !== 'undefined'
      ? window.localStorage.getItem(MODEL_SELECTION_STORAGE_KEY)
      : null;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { providerId?: string; modelId?: string } | null;
    if (!parsed?.providerId || !parsed?.modelId) return null;
    const prefix = `${parsed.providerId}/`;
    const modelId = parsed.modelId.startsWith(prefix)
      ? parsed.modelId.slice(prefix.length)
      : parsed.modelId;
    return `${parsed.providerId}/${modelId}`;
  } catch {
    return null;
  }
}

/**
 * Model id the agent-chat bridge can forward to gizzi.
 *
 * Catalog `allternit/<model>` is a virtual platform gateway id. Local gizzi
 * does not register that provider (ProviderModelNotFoundError). Map those
 * bots onto the local default CLI brain. Real harness/composer refs pass
 * through.
 */
export async function resolveAgentChatRuntimeModelId(agent?: Agent): Promise<string | undefined> {
  const harness = await resolveModelRef(agent);
  if (harness && !isVirtualPlatformModelRef(harness)) return harness;
  if (isVirtualPlatformModelRef(harness)) return LOCAL_DEFAULT_RUNTIME_MODEL;

  const composer = readComposerRuntimeModelId();
  if (composer && !isVirtualPlatformModelRef(composer)) return composer;

  try {
    const res = await fetch('/api/onboarding/config');
    if (res.ok) {
      const data = await res.json() as { user?: { defaultModel?: string } };
      const defaultModel = data.user?.defaultModel;
      if (defaultModel && defaultModel.includes('/') && !isVirtualPlatformModelRef(defaultModel)) {
        return defaultModel;
      }
    }
  } catch {
    // onboarding config unavailable
  }

  return LOCAL_DEFAULT_RUNTIME_MODEL;
}
