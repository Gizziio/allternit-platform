"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Import VoiceInteractionMode type
import type { VoiceInteractionMode } from '@/providers/voice-provider';
// Re-export for convenience
export type { VoiceInteractionMode } from '@/providers/voice-provider';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import {
  Volume2,
  VolumeX,
  Settings,
  Play,
  AlertCircle,
  Headphones,
  Mic,
  X,
  UserCircle,
} from 'lucide-react';
import { useVoice } from '@/providers/voice-provider';
import { Persona } from './persona';
import {
  MicSelector,
  MicSelectorTrigger,
  MicSelectorContent,
  MicSelectorInput,
  MicSelectorList,
  MicSelectorItem,
  MicSelectorLabel,
  MicSelectorEmpty,
} from './mic-selector';
import {
  VoiceSelector,
  VoiceSelectorTrigger,
  VoiceSelectorContent,
  VoiceSelectorList,
  VoiceSelectorItem,
  VoiceSelectorName,
  VoiceSelectorPreview,
} from './voice-selector';

export interface VoicePresenceProps {
  className?: string;
  /** When true, shows in compact mode (input bar), false = global overlay mode */
  compact?: boolean;
}

/**
 * Voice Presence Component
 * 
 * Transforms between compact (input bar) and expanded (global overlay) states.
 * 
 * UX Flow:
 * 1. Idle: Small Persona avatar on input bar
 * 2. Recording: Expanded slightly with ring
 * 3. Thinking/Speaking: Full global overlay with large Persona
 * 4. Click to dismiss overlay and return to idle
 */
export function VoicePresence({ className, compact = true }: VoicePresenceProps) {
  const {
    isRecording,
    serviceAvailable,
    currentVoice,
    autoPlay,
    availableVoices,
    setVoice,
    setAutoPlay,
    checkHealth,
    refreshVoices,
    personaState,
    startRecording,
    stopRecording,
    interimTranscript,
    interactionMode,
    setInteractionMode,
  } = useVoice();

  // Track if user has manually dismissed the overlay
  const [isDismissed, setIsDismissed] = useState(false);
  
  // Auto-show overlay when in voice mode AND thinking or speaking (unless dismissed)
  // In text mode: no overlay, just the avatar
  const shouldShowOverlay = interactionMode === 'voice' && !compact && !isDismissed && (personaState === 'thinking' || personaState === 'speaking');
  
  // Reset dismissed state when returning to idle
  useEffect(() => {
    if (personaState === 'idle') {
      setIsDismissed(false);
    }
  }, [personaState]);

  // Local connection state for feedback
  const [isConnecting, setIsConnecting] = useState(false);
  
  // Handle persona click
  const handlePersonaClick = useCallback(async () => {
    if (!serviceAvailable) {
      setIsConnecting(true);
      try {
        await checkHealth();
      } catch {
        // checkHealth already updates provider error state
      } finally {
        setIsConnecting(false);
      }
      return;
    }
    
    if (isRecording) {
      stopRecording();
    } else {
      await startRecording();
    }
  }, [isRecording, serviceAvailable, startRecording, stopRecording, checkHealth]);

  // Handle dismiss overlay
  const handleDismiss = useCallback(() => {
    setIsDismissed(true);
    // Stop any playing audio when dismissed
    if (personaState === 'speaking') {
      stopRecording();
    }
  }, [personaState, stopRecording]);

  // Compact mode (input bar)
  if (compact) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        {/* Compact Persona Avatar - Clickable */}
        <motion.button
          onClick={handlePersonaClick}
          disabled={isConnecting}
          className={cn(
            "relative rounded-full",
            (isConnecting || !serviceAvailable) && "opacity-70"
          )}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          animate={isRecording ? {
            boxShadow: [
              '0 0 0 0px rgba(59, 130, 246, 0)',
              '0 0 0 4px rgba(59, 130, 246, 0.3)',
              '0 0 0 0px rgba(59, 130, 246, 0)',
            ]
          } : {}}
          transition={isRecording ? {
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut"
          } : {}}
          title={isRecording ? "Stop recording" : isConnecting ? "Connecting..." : serviceAvailable ? "Click to speak" : "Click to connect"}
        >
          <Persona 
            state={isRecording ? "listening" : "auto"}
            variant="obsidian" 
            className="size-9"
            animateWithEnergy
          />
          
          {/* Status indicator dot */}
          <motion.span 
            className={cn(
              "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background",
              isConnecting && "bg-yellow-400",
              !isConnecting && !serviceAvailable && "bg-red-500",
              !isConnecting && serviceAvailable && personaState === 'idle' && !isRecording && "bg-muted-foreground",
              isRecording && interimTranscript && "bg-cyan-400", // Streaming state
              isRecording && !interimTranscript && "bg-blue-500",
              personaState === 'thinking' && "bg-amber-500",
              personaState === 'speaking' && "bg-green-500"
            )}
            animate={isRecording || isConnecting ? {
              scale: [1, 1.3, 1],
            } : {}}
            transition={{
              duration: interimTranscript ? 0.2 : 0.5, // Faster pulse when streaming
              repeat: Infinity,
            }}
          />
          
          {/* Recording Stop Button Overlay */}
          <AnimatePresence>
            {isRecording && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="absolute -top-1 -right-1 z-20"
              >
                <div className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-lg border-2 border-background">
                  STOP
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Recording icon overlay */}
          <AnimatePresence>
            {isRecording && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                className="absolute inset-0 flex items-center justify-center bg-background/40 rounded-full backdrop-blur-sm"
              >
                <Mic className="w-4 h-4 text-white drop-shadow-md" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
        
        {/* Streaming indicator */}
        {interimTranscript && (
          <motion.span 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-xs text-cyan-400 font-medium whitespace-nowrap"
          >
            Streaming...
          </motion.span>
        )}

        {/* Settings Popover - Mode toggle is inside here */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7 relative",
                isRecording && "text-primary",
                !serviceAvailable && "text-muted-foreground"
              )}
            >
              <Settings className="h-3.5 w-3.5" />
              {!serviceAvailable && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-500 rounded-full" />
              )}
            </Button>
          </PopoverTrigger>
          
          <PopoverContent align="end" className="w-64 p-3" sideOffset={4}>
            <VoiceSettingsContent 
              serviceAvailable={serviceAvailable ?? false}
              personaState={personaState}
              currentVoice={currentVoice}
              availableVoices={availableVoices}
              setVoice={setVoice}
              autoPlay={autoPlay}
              setAutoPlay={setAutoPlay}
              checkHealth={checkHealth}
              refreshVoices={refreshVoices}
              interactionMode={interactionMode}
              setInteractionMode={setInteractionMode}
            />
          </PopoverContent>
        </Popover>

        {/* Recording Badge */}
        <AnimatePresence>
          {isRecording && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
            >
              <Badge variant="destructive" className="text-[10px] h-5 animate-pulse">
                <span className="w-1.5 h-1.5 bg-white rounded-full mr-1" />
                Rec
              </Badge>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Global overlay mode (thinking/speaking)
  return (
    <AnimatePresence>
      {shouldShowOverlay && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          onClick={handleDismiss}
        >
          {/* Large Persona Container */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative flex flex-col items-center gap-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute -top-16 right-0 rounded-full bg-background/50 hover:bg-background/80"
              onClick={handleDismiss}
            >
              <X className="w-5 h-5" />
            </Button>

            {/* Large Animated Persona */}
            <motion.div
              animate={{
                scale: personaState === 'speaking' ? [1, 1.05, 1] : 1,
              }}
              transition={{
                duration: 0.5,
                repeat: personaState === 'speaking' ? Infinity : 0,
              }}
              className="relative"
            >
              {/* Glow effect */}
              <motion.div
                className={cn(
                  "absolute inset-0 rounded-full blur-3xl",
                  personaState === 'thinking' && "bg-amber-500/30",
                  personaState === 'speaking' && "bg-green-500/30"
                )}
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.5, 0.8, 0.5],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                }}
              />
              
              <Persona 
                state={personaState}
                variant="obsidian" 
                className="size-48 relative z-10"
                animateWithEnergy
              />
            </motion.div>

            {/* Status Text */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-center space-y-2"
            >
              <h3 className={cn(
                "text-2xl font-semibold",
                personaState === 'thinking' && "text-amber-500",
                personaState === 'speaking' && "text-green-500"
              )}>
                {personaState === 'thinking' ? "Thinking..." : "Speaking..."}
              </h3>
              <p className="text-muted-foreground text-sm">
                Click anywhere to dismiss
              </p>
            </motion.div>

            {/* Waveform visualization (decorative) */}
            <div className="flex items-center gap-1 h-12">
              {[...Array(20)].map((_, i) => (
                <motion.div
                  key={i}
                  className={cn(
                    "w-1 rounded-full",
                    personaState === 'thinking' && "bg-amber-500/50",
                    personaState === 'speaking' && "bg-green-500/50"
                  )}
                  animate={{
                    height: personaState === 'speaking' 
                      ? [20, Math.random() * 40 + 10, 20]
                      : [10, 15, 10],
                  }}
                  transition={{
                    duration: 0.5,
                    repeat: Infinity,
                    delay: i * 0.05,
                  }}
                />
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Voice Settings Content Component
interface VoiceSettingsContentProps {
  serviceAvailable: boolean;
  personaState: string;
  currentVoice: string;
  availableVoices: Array<{ id: string; label: string }>;
  setVoice: (voice: string) => void;
  autoPlay: boolean;
  setAutoPlay: (autoPlay: boolean) => void;
  checkHealth: () => Promise<boolean>;
  refreshVoices: () => Promise<void>;
  interactionMode: VoiceInteractionMode;
  setInteractionMode: (mode: VoiceInteractionMode) => void;
  autoSend?: boolean;
  setAutoSend?: (autoSend: boolean) => void;
}

function VoiceSettingsContent({
  serviceAvailable,
  personaState,
  currentVoice,
  availableVoices,
  setVoice,
  autoPlay,
  setAutoPlay,
  checkHealth,
  refreshVoices,
  interactionMode,
  setInteractionMode,
  autoSend = false,
  setAutoSend = () => {},
}: VoiceSettingsContentProps) {
  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-3 pb-3 border-b">
        <div className="flex items-center gap-2">
          <Headphones className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">Voice Settings</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-[10px] capitalize",
            personaState === 'idle' && "text-muted-foreground",
            personaState === 'listening' && "text-blue-500",
            personaState === 'thinking' && "text-amber-500",
            personaState === 'speaking' && "text-green-500"
          )}>
            {personaState === 'idle' && serviceAvailable && "Ready"}
            {personaState === 'idle' && !serviceAvailable && "Offline"}
            {personaState === 'listening' && "Listening..."}
            {personaState === 'thinking' && "Thinking..."}
            {personaState === 'speaking' && "Speaking..."}
          </span>
          <Badge variant={serviceAvailable ? "default" : "secondary"} className="text-[10px] h-5">
            {serviceAvailable ? 'Ready' : 'Offline'}
          </Badge>
        </div>
      </div>
      
      {/* Service Offline Message */}
      {!serviceAvailable && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-md p-2 mb-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground">Start voice service:</p>
              <code className="block bg-background px-1.5 py-0.5 rounded text-[9px]">
                python3 launch.py
              </code>
              <Button 
                size="sm" 
                variant="ghost" 
                className="w-full h-6 text-[10px] mt-1"
                onClick={checkHealth}
              >
                <Play className="h-3 w-3 mr-1" />
                Retry
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Interaction Mode Toggle */}
      <div className="space-y-1.5 mb-3">
        <label className="text-[10px] font-medium text-muted-foreground">Interaction Mode</label>
        <div className="flex items-center gap-2 p-1 bg-muted rounded-md">
          <button
            onClick={() => setInteractionMode('text')}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-[10px] font-medium transition-all",
              interactionMode === 'text' 
                ? "bg-background text-foreground shadow-sm" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span className="text-xs">⌨️</span>
            Text
          </button>
          <button
            onClick={() => setInteractionMode('voice')}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-[10px] font-medium transition-all",
              interactionMode === 'voice' 
                ? "bg-background text-foreground shadow-sm" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span className="text-xs">🎙️</span>
            Voice
          </button>
        </div>
        <p className="text-[9px] text-muted-foreground">
          {interactionMode === 'text' 
            ? "Records to text only, no overlay or TTS" 
            : "Full voice assistant with overlay and speech"}
        </p>
      </div>
      
      {/* Mic Selector */}
      <div className="space-y-1.5 mb-3">
        <label className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
          <UserCircle className="h-3 w-3" />
          Microphone
        </label>
        <MicSelector>
          <MicSelectorTrigger className="w-full h-7 text-xs">Select Mic</MicSelectorTrigger>
          <MicSelectorContent>
            <MicSelectorInput />
            <MicSelectorList>
              {(devices) => (
                <>
                  {devices.length === 0 && <MicSelectorEmpty>No microphones</MicSelectorEmpty>}
                  {devices.map((device) => (
                    <MicSelectorItem key={device.deviceId} value={device.deviceId}>
                      <MicSelectorLabel device={device} />
                    </MicSelectorItem>
                  ))}
                </>
              )}
            </MicSelectorList>
          </MicSelectorContent>
        </MicSelector>
      </div>
      
      {/* Voice Selector */}
      <div className="space-y-1.5 mb-3">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
            <Settings className="h-3 w-3" />
            Voice ({availableVoices.length} available)
          </label>
          {availableVoices.length === 0 && serviceAvailable && (
            <button 
              onClick={() => refreshVoices()}
              className="text-[9px] text-primary hover:underline"
            >
              Refresh
            </button>
          )}
        </div>
        <VoiceSelector value={currentVoice} onValueChange={(v) => v && setVoice(v)}>
          <VoiceSelectorTrigger className="w-full h-7 text-xs">
            {currentVoice === 'default' ? 'Select Voice' : currentVoice}
          </VoiceSelectorTrigger>
          <VoiceSelectorContent>
            <VoiceSelectorList>
              {availableVoices.length > 0 ? (
                availableVoices.map((voice) => (
                  <VoiceSelectorItem key={voice.id} value={voice.id}>
                    <VoiceSelectorPreview />
                    <VoiceSelectorName>{voice.label}</VoiceSelectorName>
                  </VoiceSelectorItem>
                ))
              ) : (
                <VoiceSelectorItem value="default">
                  <VoiceSelectorName>Default (no voices loaded)</VoiceSelectorName>
                </VoiceSelectorItem>
              )}
            </VoiceSelectorList>
          </VoiceSelectorContent>
        </VoiceSelector>
      </div>
      
      {/* Auto-play Toggle */}
      <div className="flex items-center justify-between pt-2 border-t">
        <label className="text-[10px] text-muted-foreground">Auto-play TTS</label>
        <Button
          variant={autoPlay ? "default" : "outline"}
          size="sm"
          className="h-6 text-[10px] px-2"
          onClick={() => setAutoPlay(!autoPlay)}
          disabled={!serviceAvailable}
        >
          {autoPlay ? (
            <><Volume2 className="h-3 w-3 mr-1" /> On</>
          ) : (
            <><VolumeX className="h-3 w-3 mr-1" /> Off</>
          )}
        </Button>
      </div>
      
      {/* Auto-send Toggle */}
      <div className="flex items-center justify-between pt-2">
        <label className="text-[10px] text-muted-foreground">Auto-send transcript</label>
        <Button
          variant={autoSend ? "default" : "outline"}
          size="sm"
          className="h-6 text-[10px] px-2"
          onClick={() => setAutoSend(!autoSend)}
        >
          {autoSend ? 'On' : 'Off'}
        </Button>
      </div>
    </>
  );
}

export default VoicePresence;
