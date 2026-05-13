'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, CheckCircle } from 'lucide-react';
import { GlassSurfaceBase } from '@/design/glass/GlassSurface';
import { Text } from '@/components/typography/Text';

const ACCENT = 'var(--accent-primary)';
const TEXT_PRIMARY = 'var(--ui-text-primary)';
const TEXT_SECONDARY = 'var(--ui-text-secondary)';
const TEXT_MUTED = 'var(--ui-text-muted)';
const STATUS_SUCCESS = 'var(--status-success)';
const BORDER_SUBTLE = 'var(--ui-border-muted)';

interface VideoSceneProps {
  title: string;
  videoUrl: string;
  description?: string;
  onComplete?: () => void;
}

export function VideoScene({ title, videoUrl, description, onComplete }: VideoSceneProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [watchedEnough, setWatchedEnough] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);

  const handleTimeUpdate = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    setProgress(v.currentTime);
    // Mark as "watched enough" at 90% or 30 seconds, whichever comes first
    const threshold = Math.min(v.duration * 0.9, v.duration - 1, 30);
    if (v.currentTime >= threshold && !watchedEnough) {
      setWatchedEnough(true);
    }
  }, [watchedEnough]);

  const handleLoadedMetadata = useCallback(() => {
    const v = videoRef.current;
    if (v) setDuration(v.duration);
  }, []);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    setWatchedEnough(true);
    if (!hasCompleted) {
      setHasCompleted(true);
      onComplete?.();
    }
  }, [hasCompleted, onComplete]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
      setIsPlaying(true);
    } else {
      v.pause();
      setIsPlaying(false);
    }
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setIsMuted(v.muted);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      v.requestFullscreen().catch(() => {});
    }
  }, []);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v) return;
    const time = parseFloat(e.target.value);
    v.currentTime = time;
    setProgress(time);
  }, []);

  const handleManualComplete = useCallback(() => {
    if (!hasCompleted) {
      setHasCompleted(true);
      onComplete?.();
    }
  }, [hasCompleted, onComplete]);

  const formatTime = (s: number) => {
    if (!isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <GlassSurfaceBase
      blur="md"
      border="subtle"
      style={{ maxWidth: 800, margin: '0 auto', padding: '32px 32px 24px' }}
    >
      <Text variant="subheading" style={{ fontSize: 14, fontWeight: 700, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
        Video Lesson
      </Text>

      <Text variant="heading" as="h3" style={{ fontSize: 22, fontWeight: 600, margin: '0 0 12px', color: TEXT_PRIMARY, lineHeight: 1.3 }}>
        {title}
      </Text>

      {description && (
        <Text variant="body" style={{ fontSize: 14, color: TEXT_SECONDARY, margin: '0 0 20px', lineHeight: 1.6 }}>
          {description}
        </Text>
      )}

      {/* Video Player */}
      <div style={{
        position: 'relative',
        borderRadius: 12,
        overflow: 'hidden',
        background: '#000',
        aspectRatio: '16 / 9',
      }}>
        <video
          ref={videoRef}
          src={videoUrl}
          style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain' }}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          playsInline
        />

        {/* Center play button overlay */}
        {!isPlaying && (
          <button
            onClick={togglePlay}
            style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0.35)',
              border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: ACCENT,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'transform .15s',
            }}>
              <Play size={28} color="var(--surface-canvas)" fill="var(--surface-canvas)" />
            </div>
          </button>
        )}

        {/* Bottom controls */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
          padding: '24px 12px 8px',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <button onClick={togglePlay} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 4 }}>
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          </button>

          <button onClick={toggleMute} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 4 }}>
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>

          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', fontVariantNumeric: 'tabular-nums', minWidth: 60 }}>
            {formatTime(progress)} / {formatTime(duration)}
          </span>

          <input
            type="range"
            min={0}
            max={duration || 100}
            value={progress}
            onChange={handleSeek}
            style={{
              flex: 1,
              height: 4,
              appearance: 'none',
              background: 'rgba(255,255,255,0.25)',
              borderRadius: 2,
              cursor: 'pointer',
            }}
          />

          <button onClick={toggleFullscreen} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 4 }}>
            <Maximize size={18} />
          </button>
        </div>
      </div>

      {/* Completion CTA */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
        <button
          onClick={handleManualComplete}
          disabled={hasCompleted}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '10px 20px',
            background: hasCompleted ? `${STATUS_SUCCESS}20` : ACCENT,
            border: hasCompleted ? `1.5px solid ${STATUS_SUCCESS}` : 'none',
            borderRadius: 10,
            color: hasCompleted ? STATUS_SUCCESS : 'var(--surface-canvas)',
            fontWeight: 600, fontSize: 14,
            cursor: hasCompleted ? 'default' : 'pointer',
            transition: 'all .18s',
          }}
        >
          {hasCompleted ? <CheckCircle size={16} /> : null}
          {hasCompleted ? 'Completed' : watchedEnough ? 'Mark as Complete' : 'Continue'}
        </button>
      </div>
    </GlassSurfaceBase>
  );
}
