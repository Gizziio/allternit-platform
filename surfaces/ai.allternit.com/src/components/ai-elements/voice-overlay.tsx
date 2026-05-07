"use client";

import React, { useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import {
  SpeakerHigh,
  SpeakerSlash,
  GearSix,
  Play,
  Warning,
  Headphones,
  Microphone,
  UserCircle,
} from '@phosphor-icons/react';
import { useVoice } from '@/providers/voice-provider';
import { speechToText } from '@/services/voice';
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

export interface VoiceOverlayProps {
  className?: string;
}

/**
 * Voice Overlay with Integrated Persona
 * 
 * Click the Persona avatar to record voice input
 * Settings popover for voice configuration
 */
export function VoiceOverlay({ className }: VoiceOverlayProps) {
  const {
    isRecording,
    serviceAvailable,
    currentVoice,
    autoPlay,
    availableVoices,
    setVoice,
    setAutoPlay,
    checkHealth,
    personaState,
    startRecording,
    stopRecording,
  } = useVoice();

  // Handle persona click for recording
  const handlePersonaClick = useCallback(async () => {
    if (!serviceAvailable) {
      await checkHealth();
      return;
    }
    
    if (isRecording) {
      stopRecording();
    } else {
      await startRecording();
    }
  }, [isRecording, serviceAvailable, startRecording, stopRecording, checkHealth]);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Voice Presence - Clickable Persona Avatar */}
      <button
        onClick={handlePersonaClick}
        disabled={!serviceAvailable && personaState === 'idle'}
        className={cn(
          "relative rounded-full transition-all duration-200",
          "hover:scale-105 active:scale-95",
          isRecording && "ring-2 ring-primary ring-offset-2 ring-offset-background",
          !serviceAvailable && "opacity-50 cursor-not-allowed"
        )}
        title={isRecording ? "Stop recording" : "Click to speak"}
      >
        <Persona 
          state={isRecording ? "listening" : "auto"}
          variant="obsidian" 
          className="size-9"
          animateWithEnergy
        />
        
        {/* Status indicator dot */}
        <span className={cn(
          "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background",
          !serviceAvailable && "bg-red-500",
          serviceAvailable && personaState === 'idle' && !isRecording && "bg-muted-foreground",
          isRecording && "bg-blue-500 animate-pulse",
          personaState === 'thinking' && "bg-amber-500 animate-pulse",
          personaState === 'speaking' && "bg-green-500 animate-pulse"
        )} />
        
        {/* Recording overlay icon */}
        {isRecording && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/30 rounded-full">
            <Microphone className="w-4 h-4 text-white drop-shadow-md" />
          </div>
        )}
      </button>

      {/* Voice Settings Popover */}
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
            <GearSix className="h-3.5 w-3.5" />
            {!serviceAvailable && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-500 rounded-full" />
            )}
          </Button>
        </PopoverTrigger>
        
        <PopoverContent align="end" className="w-64 p-3" sideOffset={4}>
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
                <Warning className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
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
          
          {/* Mic Selector */}
          <div className="space-y-1.5 mb-3">
            <label className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
              <UserCircle size={12} />
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
            <label className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
              <GearSix size={12} />
              Voice
            </label>
            <VoiceSelector>
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
                      <VoiceSelectorName>Default</VoiceSelectorName>
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
                <><SpeakerHigh className="h-3 w-3 mr-1" /> On</>
              ) : (
                <><SpeakerSlash className="h-3 w-3 mr-1" /> Off</>
              )}
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Recording Indicator */}
      {isRecording && (
        <Badge variant="destructive" className="text-[10px] h-5 animate-pulse">
          <span className="w-1.5 h-1.5 bg-white rounded-full mr-1" />
          Rec
        </Badge>
      )}
    </div>
  );
}

export default VoiceOverlay;
