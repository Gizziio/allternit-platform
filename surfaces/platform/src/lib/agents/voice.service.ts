/**
 * Voice Service Client
 * 
 * Interacts with the Voice Service API (port 8001) for:
 * - Listing available voice presets
 * - Previewing voices
 * - TTS generation
 */

import { VoicePreset, VoicesResponse } from './agent.types';

const VOICE_SERVICE_BASE_URL = process.env.NEXT_PUBLIC_VOICE_SERVICE_URL || 'http://127.0.0.1:8001';

/**
 * Fetch available voice presets from the voice service
 */
export async function listVoices(): Promise<VoicePreset[]> {
  try {
    const response = await fetch(`${VOICE_SERVICE_BASE_URL}/v1/voice/voices`);
    
    if (!response.ok) {
      throw new Error(`Voice service error: ${response.status}`);
    }
    
    const data: VoicesResponse = await response.json();
    return data.voices;
  } catch (error) {
    console.error('[VoiceService] Failed to fetch voices:', error);
    // Return default voices as fallback
    return getDefaultVoices();
  }
}

/**
 * Generate TTS audio for preview
 */
export async function previewVoice(voiceId: string, text: string = "Hello, I'm your AI assistant."): Promise<string | null> {
  try {
    const response = await fetch(`${VOICE_SERVICE_BASE_URL}/v1/voice/tts`, {
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
    
    const data = await response.json();
    return `${VOICE_SERVICE_BASE_URL}${data.audio_url}`;
  } catch (error) {
    console.error('[VoiceService] TTS preview failed:', error);
    return null;
  }
}

/**
 * Check voice service health
 */
export async function checkVoiceServiceHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${VOICE_SERVICE_BASE_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Default voice presets when service is unavailable
 */
function getDefaultVoices(): VoicePreset[] {
  return [
    { id: 'default', label: 'Default', engine: 'chatterbox', assetReady: true },
    { id: 'neutral', label: 'Neutral', engine: 'chatterbox', assetReady: true },
    { id: 'calm', label: 'Calm', engine: 'chatterbox', assetReady: true },
    { id: 'xtts-aura', label: 'Aura (XTTS)', engine: 'xtts_v2', assetReady: false },
    { id: 'xtts-claire', label: 'Claire (XTTS)', engine: 'xtts_v2', assetReady: false },
    { id: 'piper-amy', label: 'Amy (Piper)', engine: 'piper', assetReady: false },
    { id: 'piper-ryan', label: 'Ryan (Piper)', engine: 'piper', assetReady: false },
  ];
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
      return { color: 'bg-gray-500', label: engine };
  }
}
