/**
 * Voice Service Client
 * 
 * Interacts with the Voice Service API (port 8001) for:
 * - Listing available voice presets
 * - Previewing voices
 * - TTS generation
 */

import { VoicePreset, VoicesResponse } from './agent.types';

const VOICE_SERVICE_API_BASE = '/api/v1/voice';

function resolveVoiceAssetUrl(audioUrl: string): string {
  if (/^https?:\/\//i.test(audioUrl)) {
    return audioUrl;
  }

  if (audioUrl.startsWith('/v1/voice/')) {
    return `/api${audioUrl}`;
  }

  if (audioUrl.startsWith('/')) {
    return audioUrl;
  }

  return `${VOICE_SERVICE_API_BASE}/${audioUrl.replace(/^\/+/, '')}`;
}

/**
 * Fetch available voice presets from the voice service
 */
export async function listVoices(): Promise<VoicePreset[]> {
  const response = await fetch(`${VOICE_SERVICE_API_BASE}/voices`);

  if (!response.ok) {
    throw new Error(`Voice service error: ${response.status}`);
  }

  const data: VoicesResponse = await response.json();
  if (!Array.isArray(data.voices)) {
    throw new Error('Voice service returned an invalid voice list.');
  }

  return data.voices;
}

/**
 * Generate TTS audio for preview
 */
export async function previewVoice(voiceId: string, text: string = "Hello, I'm your AI assistant."): Promise<string> {
  const response = await fetch(`${VOICE_SERVICE_API_BASE}/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      voice: voiceId,
      format: 'wav',
      use_paralinguistic: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`TTS generation failed: ${response.status}`);
  }

  const data = await response.json() as { audio_url?: string };
  if (!data.audio_url) {
    throw new Error('Voice service returned no preview audio.');
  }

  return resolveVoiceAssetUrl(data.audio_url);
}

/**
 * Check voice service health
 */
export async function checkVoiceServiceHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${VOICE_SERVICE_API_BASE}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get voice engine icon/color mapping
 */
export function getVoiceEngineStyle(engine: string): { color: string; label: string } {
  switch (engine) {
    case 'chatterbox':
      return { color: 'bg-blue-500', label: 'Chatterbox' };
    case 'xtts_v2':
      return { color: 'bg-purple-500', label: 'XTTS' };
    case 'piper':
      return { color: 'bg-green-500', label: 'Piper' };
    default:
      return { color: 'bg-zinc-500', label: engine };
  }
}
