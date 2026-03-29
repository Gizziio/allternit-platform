"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Microphone,
  SpeakerHigh,
  SpeakerSlash,
  Radio,
  GearSix,
  Play,
  Square,
  Warning,
  Check,
} from '@phosphor-icons/react';
import { useVoice } from '@/providers/voice-provider';
import { SpeechInput } from './speech-input';

export interface VoiceToolbarProps {
  className?: string;
  variant?: 'compact' | 'full';
}

/**
 * Clean Voice Toolbar
 * 
 * Simple, grouped voice controls:
 * - Speech input button
 * - Settings dropdown (voice selection, auto-play)
 * - Status indicator
 */
export function VoiceToolbar({ className, variant = 'compact' }: VoiceToolbarProps) {
  const {
    isPlaying,
    isRecording,
    serviceAvailable,
    error,
    currentVoice,
    autoPlay,
    availableVoices,
    setVoice,
    setAutoPlay,
    stopAudio,
    checkHealth,
  } = useVoice();

  const isCompact = variant === 'compact';
  
  return (
    <div className={cn(
      "flex items-center gap-1 rounded-lg bg-muted/50",
      isCompact ? "p-0.5" : "p-2",
      className
    )}>
      {/* Speech Input Button */}
      <SpeechInput
        onTranscriptionChange={(text) => {
          // Handled by parent through VoiceProvider
          console.log('Transcribed:', text);
        }}
        className={cn(
          "rounded-md",
          isCompact ? "h-6 w-6" : "h-8 w-8"
        )}
      />

      {/* Voice Settings Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size={isCompact ? "icon" : "sm"}
            disabled={!serviceAvailable}
            className={cn(
              isCompact ? "h-6 w-6" : "h-8 px-2 gap-1.5 text-xs font-normal",
              isPlaying && "text-primary"
            )}
          >
            {isPlaying ? (
              <Square className="h-3 w-3 fill-current" />
            ) : autoPlay ? (
              <SpeakerHigh size={12} />
            ) : (
              <SpeakerSlash size={12} />
            )}
            {!isCompact && (
              <>
                <span className="hidden sm:inline">
                  {serviceAvailable 
                    ? (currentVoice === 'default' ? 'Voice' : currentVoice)
                    : 'Offline'
                  }
                </span>
                <GearSix className="h-3 w-3 opacity-50" />
              </>
            )}
          </Button>
        </DropdownMenuTrigger>
        
        <DropdownMenuContent align="start" className="w-48">
          {/* Status Header */}
          <DropdownMenuLabel className="flex items-center gap-2 text-xs">
            {serviceAvailable ? (
              <>
                <Radio className="h-3 w-3 text-green-500" />
                <span className="text-green-600">Voice Ready</span>
              </>
            ) : (
              <>
                <Warning className="h-3 w-3 text-amber-500" />
                <span className="text-amber-600">Service Offline</span>
              </>
            )}
          </DropdownMenuLabel>
          
          <DropdownMenuSeparator />
          
          {/* Auto-play Toggle */}
          <DropdownMenuItem 
            onClick={() => setAutoPlay(!autoPlay)}
            disabled={!serviceAvailable}
            className="text-xs"
          >
            <div className="flex items-center justify-between w-full">
              <span>Auto-play TTS</span>
              {autoPlay && <Check size={12} />}
            </div>
          </DropdownMenuItem>
          
          {isPlaying && (
            <DropdownMenuItem 
              onClick={stopAudio}
              className="text-xs text-destructive focus:text-destructive"
            >
              <Square className="mr-2 h-3 w-3 fill-current" />
              Stop Playback
            </DropdownMenuItem>
          )}
          
          <DropdownMenuSeparator />
          
          {/* Voice Selection */}
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Select Voice
          </DropdownMenuLabel>
          
          {serviceAvailable && availableVoices.length > 0 ? (
            availableVoices.slice(0, 5).map((voice) => (
              <DropdownMenuItem
                key={voice.id}
                onClick={() => setVoice(voice.id)}
                className="text-xs"
              >
                <div className="flex items-center justify-between w-full">
                  <span className="truncate">{voice.label}</span>
                  {currentVoice === voice.id && (
                    <Check className="h-3 w-3 ml-2" />
                  )}
                </div>
              </DropdownMenuItem>
            ))
          ) : serviceAvailable ? (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              Loading voices...
            </div>
          ) : (
            <>
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                Start voice service:
              </div>
              <code className="mx-2 px-2 py-1 bg-muted rounded text-[10px] block">
                python3 launch.py
              </code>
              <DropdownMenuItem 
                onClick={checkHealth}
                className="text-xs mt-1"
              >
                <Play className="mr-2 h-3 w-3" />
                Retry Connection
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Recording/Playing Indicator */}
      {(isRecording || isPlaying) && (
        <div className="flex items-center gap-1 px-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </span>
          <span className="text-[10px] text-muted-foreground hidden sm:inline">
            {isRecording ? 'Recording' : 'Playing'}
          </span>
        </div>
      )}
    </div>
  );
}

export default VoiceToolbar;
