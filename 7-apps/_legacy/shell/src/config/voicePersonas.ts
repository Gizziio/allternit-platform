export type VoicePersona = {
  id: string;
  label: string;
  referenceAudioUrl?: string;
  sampleName?: string;
};

export const VOICE_PERSONAS_STORAGE_KEY = 'a2rchitech-voice-personas';
export const VOICE_PERSONAS_EVENT = 'a2rchitech:voice-personas';
const VOICE_SERVICE_URL = 'http://localhost:8001';
const VOICE_SERVICE_VOICES_PATH = '/v1/voice/voices';

type VoiceServiceVoice = {
  id?: string;
  label?: string;
};

type VoiceServiceResponse = {
  voices?: VoiceServiceVoice[];
};

const FALLBACK_PERSONAS: VoicePersona[] = [
  { id: 'default', label: 'Default' },
  { id: 'xtts-aura', label: 'Aura (XTTS)' },
  { id: 'xtts-claire', label: 'Claire (XTTS)' },
  { id: 'xtts-zephyr', label: 'Zephyr (XTTS)' },
  { id: 'piper-amy', label: 'Amy (Piper)' },
  { id: 'piper-ryan', label: 'Ryan (Piper)' },
  { id: 'piper-alan', label: 'Alan (Piper)' },
  { id: 'piper-lessac', label: 'Lessac (Piper)' },
  { id: 'piper-joe', label: 'Joe (Piper)' },
  { id: 'piper-kristin', label: 'Kristin (Piper)' },
  { id: 'xtts-luna', label: 'Luna (XTTS - IT)' },
  { id: 'xtts-sol', label: 'Sol (XTTS - ES)' },
  { id: 'xtts-nova', label: 'Nova (XTTS - FR)' },
  { id: 'neutral', label: 'Neutral (CB)' },
  { id: 'calm', label: 'Calm (CB)' },
];

const normalizePersonas = (input: unknown): VoicePersona[] => {
  if (!Array.isArray(input)) return [];
  const entries: VoicePersona[] = [];
  input.forEach((item) => {
    if (!item) return;
    if (typeof item === 'string') {
      const value = item.trim();
      if (!value) return;
      entries.push({ id: value, label: value });
      return;
    }
    if (typeof item === 'object') {
      const raw = item as {
        id?: unknown;
        value?: unknown;
        name?: unknown;
        label?: unknown;
        referenceAudioUrl?: unknown;
        reference_audio_url?: unknown;
        sampleName?: unknown;
        sample_name?: unknown;
      };
      const id = String(raw.id ?? raw.value ?? raw.name ?? '').trim();
      if (!id) return;
      const label = String(raw.label ?? raw.name ?? id).trim();
      const referenceAudioUrl = String(raw.referenceAudioUrl ?? raw.reference_audio_url ?? '').trim();
      const sampleName = String(raw.sampleName ?? raw.sample_name ?? '').trim();
      entries.push({
        id,
        label,
        ...(referenceAudioUrl ? { referenceAudioUrl } : {}),
        ...(sampleName ? { sampleName } : {}),
      });
    }
  });
  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  });
};

const mergePersonas = (serviceList: VoicePersona[], localList: VoicePersona[]): VoicePersona[] => {
  const localMap = new Map(localList.map((persona) => [persona.id, persona]));
  const merged = serviceList.map((persona) => {
    const local = localMap.get(persona.id);
    if (!local) return persona;
    return {
      ...persona,
      ...(local.referenceAudioUrl ? { referenceAudioUrl: local.referenceAudioUrl } : {}),
      ...(local.sampleName ? { sampleName: local.sampleName } : {}),
    };
  });
  const serviceIds = new Set(serviceList.map((persona) => persona.id));
  localList.forEach((persona) => {
    if (!serviceIds.has(persona.id)) {
      merged.push(persona);
    }
  });
  return merged;
};

const personasEqual = (left: VoicePersona[], right: VoicePersona[]): boolean => {
  if (left.length !== right.length) return false;
  return left.every((persona, index) => {
    const other = right[index];
    if (!other) return false;
    return (
      persona.id === other.id
      && persona.label === other.label
      && persona.referenceAudioUrl === other.referenceAudioUrl
      && persona.sampleName === other.sampleName
    );
  });
};

export const getVoicePersonas = (): VoicePersona[] => {
  if (typeof window === 'undefined') return FALLBACK_PERSONAS;

  const override = (window as any).__A2_VOICE_PERSONAS;
  const overrideList = normalizePersonas(override);
  if (overrideList.length) return overrideList;

  const stored = window.localStorage.getItem(VOICE_PERSONAS_STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      const storedList = normalizePersonas(parsed);
      if (storedList.length) {
        if (storedList.length === 1 && storedList[0]?.id === 'default') {
          return FALLBACK_PERSONAS;
        }
        return storedList;
      }
    } catch {
      // Ignore invalid storage.
    }
  }

  return FALLBACK_PERSONAS;
};

export const getDefaultVoiceId = (personas: VoicePersona[]): string => {
  return personas[0]?.id || 'default';
};

export const saveVoicePersonas = (personas: VoicePersona[]): VoicePersona[] => {
  const normalized = normalizePersonas(personas);
  if (typeof window === 'undefined') return normalized;

  window.localStorage.setItem(VOICE_PERSONAS_STORAGE_KEY, JSON.stringify(normalized));
  (window as any).__A2_VOICE_PERSONAS = normalized;
  window.dispatchEvent(new CustomEvent(VOICE_PERSONAS_EVENT, { detail: normalized }));
  return normalized;
};

export const syncVoicePersonasFromService = async (
  signal?: AbortSignal
): Promise<VoicePersona[] | null> => {
  if (typeof window === 'undefined') return null;
  if ((window as any).__A2_VOICE_PERSONAS) return null;
  try {
    const response = await fetch(`${VOICE_SERVICE_URL}${VOICE_SERVICE_VOICES_PATH}`, {
      method: 'GET',
      signal,
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const data = (await response.json()) as VoiceServiceResponse;
    if (!data?.voices?.length) return null;
    const servicePersonas = normalizePersonas(
      data.voices.map((voice) => ({
        id: (voice.id || '').trim(),
        label: (voice.label || voice.id || '').trim(),
      }))
    );
    if (!servicePersonas.length) return null;
    const current = getVoicePersonas();
    const merged = mergePersonas(servicePersonas, current);
    if (!personasEqual(merged, current)) {
      return saveVoicePersonas(merged);
    }
    return merged;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return null;
    }
    console.warn('[voicePersonas] Failed to sync from service:', err);
    return null;
  }
};
