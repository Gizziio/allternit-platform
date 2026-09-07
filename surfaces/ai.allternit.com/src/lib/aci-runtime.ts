/**
 * Shared ACI / Gizzi brain resolver.
 *
 * ACI sessions, the browser extension, and the computer-use engine all read
 * the same persisted Gizzi model selection. They must not invent a second
 * API-key brain.
 */

import {
  MODEL_SELECTION_STORAGE_KEY,
  persistModelSelection,
  readPersistedModelSelection,
} from "@/lib/default-brain";
import type { ModelSelection } from "@/components/model-picker";

export const GIZZI_BRAIN_CHANGED_EVENT = "allternit:gizzi-brain-changed";

export type AciEngine = "allternit" | "page-agent" | "sub-agent";

export interface GizziBrainRef {
  providerId: string;
  modelId: string;
  profileId: string;
  modelName: string;
  /** `provider/model` — what /api/aci/run and computer-use expect. */
  aciModel: string;
  /** Gizzi `/v1/session/.../message` body. */
  gizziModel: { providerID: string; modelID: string };
  label: string;
}

export function selectionToGizziBrain(selection: ModelSelection | null | undefined): GizziBrainRef | null {
  if (!selection?.providerId || !selection?.modelId) return null;
  const providerId = selection.providerId;
  const modelId = selection.modelId;
  const modelName = selection.modelName || modelId;
  return {
    providerId,
    modelId,
    profileId: selection.profileId || providerId,
    modelName,
    aciModel: `${providerId}/${modelId}`,
    gizziModel: { providerID: providerId, modelID: modelId },
    label: modelName.includes("/") ? modelName : `${providerId} · ${modelName}`,
  };
}

export function resolveGizziBrain(): GizziBrainRef | null {
  return selectionToGizziBrain(readPersistedModelSelection());
}

export function resolveAciModel(fallback?: string): string {
  return resolveGizziBrain()?.aciModel ?? fallback ?? "";
}

export function writeGizziBrain(selection: ModelSelection): GizziBrainRef | null {
  persistModelSelection(selection);
  notifyGizziBrainChanged(selection);
  return selectionToGizziBrain(selection);
}

export function notifyGizziBrainChanged(selection: ModelSelection | null = readPersistedModelSelection()): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(GIZZI_BRAIN_CHANGED_EVENT, {
      detail: selectionToGizziBrain(selection),
    }),
  );
}

export function subscribeGizziBrain(listener: (brain: GizziBrainRef | null) => void): () => void {
  if (typeof window === "undefined") return () => undefined;

  const emit = () => listener(resolveGizziBrain());
  const onCustom = () => emit();
  const onStorage = (event: StorageEvent) => {
    if (event.key === MODEL_SELECTION_STORAGE_KEY) emit();
  };

  window.addEventListener(GIZZI_BRAIN_CHANGED_EVENT, onCustom);
  window.addEventListener("storage", onStorage);
  emit();
  return () => {
    window.removeEventListener(GIZZI_BRAIN_CHANGED_EVENT, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}

export const ACI_ENGINE_LABEL: Record<AciEngine, string> = {
  allternit: "Allternit computer-use",
  "page-agent": "Attached tab (page-agent)",
  "sub-agent": "Sub-agent",
};
