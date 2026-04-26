/**
 * AudioRenderer.tsx
 * 
 * Renders audio artifacts with waveform visualization.
 * Uses Wavesurfer.js-style interface.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  SpeakerHigh,
  SpeakerSlash,
  DownloadSimple,
  ShareNetwork,
  SkipBack,
  SkipForward,
  MusicNote,
  Headphones,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import type { ArtifactUIPart } from '@/lib/ai/ui-parts.types';
import type { MoATask } from '@/lib/api/moa-client';
import { cn } from '@/lib/utils';

interface AudioRendererProps {
  artifact: ArtifactUIPart;
  sessionId?: string;
  onMoATaskUpdate?: (tasks: MoATask[]) => void;
}

export function AudioRenderer({
  artifact,
  sessionId,
  onMoATaskUpdate,
}: AudioRendererProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const waveformRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  // Mock audio URL (in production, use artifact.url)
  const audioUrl = artifact.url || 'https://www.w3schools.com/html/horse.mp3';

  // Draw waveform (simplified visualization)
  useEffect(() => {
    if (!waveformRef.current || !duration) return;

    const canvas = waveformRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw waveform bars
    const barCount = 100;
    const barWidth = width / barCount;
    const progress = currentTime / duration;

    for (let i = 0; i < barCount; i++) {
      const barProgress = i / barCount;
      const isPlayed = barProgress <= progress;
      
      // Generate pseudo-random height for waveform effect
      const randomHeight = Math.sin(i * 0.3) * 0.5 + 0.5;
      const barHeight = height * 0.6 * randomHeight;
      
      ctx.fillStyle = isPlayed ? '#D4956A' : 'rgba(255,255,255,0.2)';
      ctx.fillRect(
        i * barWidth + 1,
        (height - barHeight) / 2,
        barWidth - 2,
        barHeight
      );
    }
  }, [currentTime, duration]);

  // Toggle play/pause
  const togglePlay = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  // Handle time update
  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);
  };

  // Handle loaded metadata
  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    setDuration(audioRef.current.duration);
  };

  // Handle seek
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const time = parseFloat(e.target.value);
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  };

  // Handle volume change
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const vol = parseFloat(e.target.value);
    audioRef.current.volume = vol;
    setVolume(vol);
    setIsMuted(vol === 0);
  };

  // Toggle mute
  const toggleMute = () => {
    if (!audioRef.current) return;
    audioRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  // Skip forward/back
  const skip = (seconds: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime += seconds;
  };

  // Format time
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-full flex flex-col bg-[var(--bg-primary)]">
      {/* Toolbar */}
      <div className="h-12 border-b border-[var(--border-subtle)] flex items-center justify-between px-4 bg-[var(--bg-secondary)]">
        <div className="flex items-center gap-3">
          <Headphones className="w-4 h-4 text-[var(--accent-primary)]" />
          <div>
            <span className="text-sm font-medium text-[var(--text-primary)]">
              {artifact.title}
            </span>
            {(artifact as ArtifactUIPart & { metadata?: { duration?: string } }).metadata?.duration && (
              <span className="text-xs text-[var(--text-tertiary)] ml-2">
                {(artifact as ArtifactUIPart & { metadata?: { duration?: string } }).metadata?.duration}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-[var(--text-tertiary)]">
            <DownloadSimple size={16} />
          </Button>
          <Button variant="ghost" size="sm" className="text-[var(--text-tertiary)]">
            <ShareNetwork size={16} />
          </Button>
        </div>
      </div>

      {/* Audio player */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-2xl space-y-6">
          {/* Album art / visualization */}
          <div className="aspect-square max-w-xs mx-auto rounded-2xl bg-gradient-to-br from-[var(--accent-primary)] to-[var(--bg-secondary)] flex items-center justify-center shadow-2xl">
            <MusicNote className="w-24 h-24 text-white/50" />
          </div>

          {/* Title */}
          <div className="text-center">
            <h2 className="text-xl font-semibold text-[var(--text-primary)]">
              {artifact.title}
            </h2>
            <p className="text-sm text-[var(--text-tertiary)] mt-1">
              AI Generated Audio
            </p>
          </div>

          {/* Waveform */}
          <div className="relative">
            <canvas
              ref={waveformRef}
              width={800}
              height={120}
              className="w-full h-32 rounded-lg bg-[var(--bg-secondary)] cursor-pointer"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const progress = x / rect.width;
                if (audioRef.current) {
                  audioRef.current.currentTime = progress * duration;
                }
              }}
            />
            
            {/* Time labels */}
            <div className="flex justify-between mt-2 text-xs text-[var(--text-tertiary)]">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-4">
            {/* Skip back */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => skip(-10)}
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <SkipBack size={20} />
            </Button>

            {/* Play/Pause */}
            <Button
              variant="default"
              size="lg"
              onClick={togglePlay}
              className="w-16 h-16 rounded-full bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/90"
            >
              {isPlaying ? (
                <Pause size={32} />
              ) : (
                <Play className="w-8 h-8 ml-1" />
              )}
            </Button>

            {/* Skip forward */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => skip(10)}
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <SkipForward size={20} />
            </Button>
          </div>

          {/* Volume */}
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleMute}
              className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            >
              {isMuted ? (
                <SpeakerSlash size={16} />
              ) : (
                <SpeakerHigh size={16} />
              )}
            </Button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-32 h-1 bg-[var(--bg-secondary)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--text-tertiary)]"
            />
          </div>
        </div>
      </div>

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
      />
    </div>
  );
}
