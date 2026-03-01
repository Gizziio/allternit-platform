/**
 * useVoiceSettings Hook - Manage voice preferences globally
 */

import { useState, useCallback, useEffect } from 'react';
import { voiceService } from '../../runtime/VoiceService';

interface VoiceSettingsState {
  currentVoice: string;
  sttLanguage: string;
  autoPlay: boolean;
  energyVisualization: boolean;
}

const DEFAULT_SETTINGS: VoiceSettingsState = {
  currentVoice: 'default',
  sttLanguage: 'en-US',
  autoPlay: true,
  energyVisualization: true,
};

export function useVoiceSettings() {
  const [settings, setSettings] = useState<VoiceSettingsState>(() => {
    // Load from localStorage or use defaults
    const saved = localStorage.getItem('voice_settings');
    if (saved) {
      try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      } catch {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });

  // Save settings to localStorage on change
  useEffect(() => {
    localStorage.setItem('voice_settings', JSON.stringify(settings));
  }, [settings]);

  // Update voice service when voice changes
  useEffect(() => {
    // Voice service uses voice parameter per call, not global state
  }, [settings.currentVoice]);

  // Update STT language
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        // Will be picked up by next recognition start
      }
    }
  }, [settings.sttLanguage]);

  const setVoice = useCallback((voice: string) => {
    setSettings(prev => ({ ...prev, currentVoice: voice }));
  }, []);

  const setLanguage = useCallback((lang: string) => {
    setSettings(prev => ({ ...prev, sttLanguage: lang }));
  }, []);

  const setAutoPlay = useCallback((autoPlay: boolean) => {
    setSettings(prev => ({ ...prev, autoPlay }));
  }, []);

  const setEnergyVisualization = useCallback((enabled: boolean) => {
    setSettings(prev => ({ ...prev, energyVisualization: enabled }));
  }, []);

  const speak = useCallback(async (text: string, voiceOverride?: string) => {
    const voice = voiceOverride || settings.currentVoice;
    return voiceService.speak(text, {
      voice,
      autoPlay: settings.autoPlay,
    });
  }, [settings.currentVoice, settings.autoPlay]);

  const speakWithClonedVoice = useCallback(async (text: string, audioUrl: string) => {
    return voiceService.speakWithVoice(text, audioUrl, settings.autoPlay);
  }, [settings.autoPlay]);

  return {
    settings,
    setVoice,
    setLanguage,
    setAutoPlay,
    setEnergyVisualization,
    speak,
    speakWithClonedVoice,
  };
}

// Singleton hook for apps that need a single voice settings instance
let globalSettings: ReturnType<typeof useVoiceSettings> | null = null;

export function useGlobalVoiceSettings() {
  if (!globalSettings) {
    globalSettings = useVoiceSettings();
  }
  return globalSettings;
}

export type { VoiceSettingsState };
