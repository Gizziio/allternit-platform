/**
 * Voice Provider - Global Voice State Management
 * 
 * Provides voice context to all components:
 * - Selected voice persistence
 * - Auto-play settings
 * - Service health monitoring
 * - Audio energy for Persona animation
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { 
  voiceService, 
  speechToText, 
  type VoicePreset, 
  type VoiceModel,
  type TTSResponse 
} from '@/services/voice';

// Default settings
const DEFAULT_SETTINGS = {
  currentVoice: 'default',
  sttLanguage: 'en-US',
  autoPlay: true,
  energyVisualization: true,
};

// Interaction mode type
export type VoiceInteractionMode = 'text' | 'voice';

// Context state interface
interface VoiceContextState {
  // Settings
  currentVoice: string;
  sttLanguage: string;
  autoPlay: boolean;
  energyVisualization: boolean;
  
  // Interaction mode
  interactionMode: VoiceInteractionMode;
  setInteractionMode: (mode: VoiceInteractionMode) => void;
  
  // Service status
  serviceAvailable: boolean | null;
  isCheckingHealth: boolean;
  error: string | null;
  
  // Available options
  availableVoices: VoicePreset[];
  availableModels: VoiceModel[];
  isLoadingVoices: boolean;
  
  // Playback state
  isPlaying: boolean;
  isRecording: boolean;
  audioLevel: number; // 0-1 for Persona animation
  currentAudioUrl: string | null;
  
  // STT transcript (streaming + final)
  interimTranscript: string | null;
  transcript: string | null;
  clearTranscript: () => void;
  
  // Actions
  setVoice: (voice: string) => void;
  setLanguage: (lang: string) => void;
  setAutoPlay: (autoPlay: boolean) => void;
  setEnergyVisualization: (enabled: boolean) => void;
  
  // Service actions
  speak: (text: string, voiceOverride?: string) => Promise<{ success: boolean; error?: string }>;
  stopAudio: () => void;
  checkHealth: () => Promise<boolean>;
  refreshVoices: () => Promise<void>;
  
  // STT actions  
  startRecording: () => Promise<boolean>;
  stopRecording: () => void;
  
  // Persona state for animation
  personaState: 'idle' | 'listening' | 'thinking' | 'speaking';
}

// Create context
const VoiceContext = createContext<VoiceContextState | null>(null);

// Provider props
interface VoiceProviderProps {
  children: React.ReactNode;
}

/**
 * Voice Provider Component
 */
export function VoiceProvider({ children }: VoiceProviderProps) {
  // Settings (persisted to localStorage)
  const [settings, setSettings] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_SETTINGS;
    
    const saved = localStorage.getItem('a2r_voice_settings');
    if (saved) {
      try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      } catch {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });

  // Service status
  const [serviceAvailable, setServiceAvailable] = useState<boolean | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Available options
  const [availableVoices, setAvailableVoices] = useState<VoicePreset[]>([]);
  const [availableModels, setAvailableModels] = useState<VoiceModel[]>([]);
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  
  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  
  // Persona state
  const [personaState, setPersonaState] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  
  // STT transcript (interim = streaming, transcript = final)
  const [interimTranscript, setInterimTranscript] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  
  // Interaction mode (text = just record-to-text, voice = full voice assistant)
  const [interactionMode, setInteractionModeState] = useState<VoiceInteractionMode>('text');
  
  // Refs for managing subscriptions
  const recordingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Persist settings
  useEffect(() => {
    localStorage.setItem('a2r_voice_settings', JSON.stringify(settings));
  }, [settings]);

  // Subscribe to voice service events
  useEffect(() => {
    // Subscribe to playback events
    const unsubscribePlayback = voiceService.onPlayback((event) => {
      if (event.type === 'play') {
        setIsPlaying(true);
        setPersonaState('speaking');
        if (event.url) setCurrentAudioUrl(event.url);
      } else if (event.type === 'end' || event.type === 'error') {
        setIsPlaying(false);
        setPersonaState('idle');
      }
    });

    // Subscribe to energy events for Persona
    const unsubscribeEnergy = voiceService.onEnergy((energy) => {
      setAudioLevel(energy);
    });

    // Subscribe to service state changes
    const unsubscribeService = voiceService.subscribe((event) => {
      if (event.type === 'state') {
        if (event.state.serviceAvailable !== undefined) {
          setServiceAvailable(event.state.serviceAvailable);
        }
        if (event.state.isPlaying !== undefined) {
          setIsPlaying(event.state.isPlaying);
        }
        if (event.state.error !== undefined) {
          setError(event.state.error);
        }
      }
      if (event.type === 'error') {
        setError(event.error);
      }
    });

    // Initial health check and voice loading
    voiceService.checkHealth({ quiet: true, force: true }).then(available => {
      setServiceAvailable(available);
      if (available) {
        refreshVoices().catch((refreshError) => {
          const message = refreshError instanceof Error ? refreshError.message : 'Failed to load voices';
          setError(message);
        });
      }
    });

    return () => {
      unsubscribePlayback();
      unsubscribeEnergy();
      unsubscribeService();
    };
  }, []);

  // Subscribe to STT events
  useEffect(() => {
    const unsubscribe = speechToText.on((event) => {
      switch (event.type) {
        case 'start':
          setIsRecording(true);
          setPersonaState('listening');
          break;
        case 'end':
          setIsRecording(false);
          setPersonaState('idle');
          break;
        case 'error':
          setIsRecording(false);
          setPersonaState('idle');
          break;
        case 'processing':
          setPersonaState('thinking');
          break;
        case 'result':
          if (event.result?.transcript) {
            if (event.result.isFinal) {
              // Final result - commit to transcript and clear interim
              setTranscript(event.result.transcript);
              setInterimTranscript(null);
            } else {
              // Streaming interim result
              setInterimTranscript(event.result.transcript);
            }
          }
          break;
      }
    });

    return unsubscribe;
  }, []);

  // Actions
  const setVoice = useCallback((voice: string) => {
    setSettings((prev: typeof DEFAULT_SETTINGS) => ({ ...prev, currentVoice: voice }));
  }, []);

  const setLanguage = useCallback((lang: string) => {
    setSettings((prev: typeof DEFAULT_SETTINGS) => ({ ...prev, sttLanguage: lang }));
    speechToText.setLanguage(lang);
  }, []);

  const setAutoPlay = useCallback((autoPlay: boolean) => {
    setSettings((prev: typeof DEFAULT_SETTINGS) => ({ ...prev, autoPlay }));
  }, []);

  const setEnergyVisualization = useCallback((enabled: boolean) => {
    setSettings((prev: typeof DEFAULT_SETTINGS) => ({ ...prev, energyVisualization: enabled }));
  }, []);
  
  const setInteractionMode = useCallback((mode: VoiceInteractionMode) => {
    setInteractionModeState(mode);
  }, []);

  const speak = useCallback(async (text: string, voiceOverride?: string) => {
    setPersonaState('thinking');
    
    const result = await voiceService.speak(text, {
      voice: voiceOverride || settings.currentVoice,
      autoPlay: settings.autoPlay,
    });

    if (!result.success) {
      setPersonaState('idle');
    }
    
    return result;
  }, [settings.currentVoice, settings.autoPlay]);

  const stopAudio = useCallback(() => {
    voiceService.stopAudio();
    setIsPlaying(false);
    setPersonaState('idle');
  }, []);

  const checkHealth = useCallback(async () => {
    setIsCheckingHealth(true);
    const available = await voiceService.checkHealth({ force: true });
    setServiceAvailable(available);
    setIsCheckingHealth(false);
    return available;
  }, []);

  const refreshVoices = useCallback(async () => {
    setIsLoadingVoices(true);

    try {
      const [voices, models] = await Promise.all([
        voiceService.listVoices(),
        voiceService.listModels(),
      ]);

      setAvailableVoices(voices);
      setAvailableModels(models);
    } catch (refreshError) {
      const message = refreshError instanceof Error ? refreshError.message : 'Failed to load voice metadata';
      setError(message);
    } finally {
      setIsLoadingVoices(false);
    }
  }, []);
  
  // Load voices when service becomes available
  useEffect(() => {
    if (serviceAvailable && availableVoices.length === 0 && !isLoadingVoices) {
      refreshVoices();
    }
  }, [serviceAvailable, availableVoices.length, isLoadingVoices, refreshVoices]);

  const startRecording = useCallback(async () => {
    const started = await speechToText.start();
    return started;
  }, []);

  const stopRecording = useCallback(() => {
    speechToText.stop();
  }, []);
  
  const clearTranscript = useCallback(() => {
    setTranscript(null);
    setInterimTranscript(null);
  }, []);

  const value: VoiceContextState = {
    // Settings
    currentVoice: settings.currentVoice,
    sttLanguage: settings.sttLanguage,
    autoPlay: settings.autoPlay,
    energyVisualization: settings.energyVisualization,
    
    // Interaction mode
    interactionMode,
    setInteractionMode,
    
    // Service status
    serviceAvailable,
    isCheckingHealth,
    error,
    
    // Available options
    availableVoices,
    availableModels,
    isLoadingVoices,
    
    // Playback state
    isPlaying,
    isRecording,
    audioLevel,
    currentAudioUrl,
    
    // STT transcript
    interimTranscript,
    transcript,
    clearTranscript,
    
    // Persona state
    personaState,
    
    // Actions
    setVoice,
    setLanguage,
    setAutoPlay,
    setEnergyVisualization,
    
    // Service actions
    speak,
    stopAudio,
    checkHealth,
    refreshVoices,
    
    // STT actions
    startRecording,
    stopRecording,
  };

  return (
    <VoiceContext.Provider value={value}>
      {children}
    </VoiceContext.Provider>
  );
}

/**
 * Hook to use voice context
 */
export function useVoice(): VoiceContextState {
  const context = useContext(VoiceContext);
  if (!context) {
    throw new Error('useVoice must be used within VoiceProvider');
  }
  return context;
}

/**
 * Hook for Persona animation state
 */
export function usePersonaState() {
  const { personaState, audioLevel, isRecording, isPlaying } = useVoice();
  
  return {
    state: personaState,
    audioLevel,
    isActive: isRecording || isPlaying,
  };
}

/**
 * Hook for voice settings only (lighter weight)
 */
export function useVoiceSettings() {
  const {
    currentVoice,
    sttLanguage,
    autoPlay,
    energyVisualization,
    availableVoices,
    setVoice,
    setLanguage,
    setAutoPlay,
    setEnergyVisualization,
  } = useVoice();

  return {
    currentVoice,
    sttLanguage,
    autoPlay,
    energyVisualization,
    availableVoices,
    setVoice,
    setLanguage,
    setAutoPlay,
    setEnergyVisualization,
  };
}

/**
 * Hook for TTS operations
 */
export function useTTS() {
  const {
    speak,
    stopAudio,
    isPlaying,
    currentAudioUrl,
    serviceAvailable,
  } = useVoice();

  return {
    speak,
    stopAudio,
    isPlaying,
    currentAudioUrl,
    serviceAvailable,
  };
}

/**
 * Hook for STT operations
 */
export function useSTT() {
  const {
    startRecording,
    stopRecording,
    isRecording,
    sttLanguage,
    setLanguage,
  } = useVoice();

  return {
    startRecording,
    stopRecording,
    isRecording,
    language: sttLanguage,
    setLanguage,
    isSupported: speechToText.isSupported(),
    isNativeSupported: speechToText.isNativeSupported(),
  };
}

export { VoiceContext };
export type { VoiceContextState, VoiceProviderProps };
