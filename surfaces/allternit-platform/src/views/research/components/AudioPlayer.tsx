'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, Download } from 'lucide-react';

interface AudioPlayerProps {
  src: string;
  title?: string;
}

export function AudioPlayer({ src, title = 'Audio Overview' }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoaded = () => {
      setDuration(audio.duration);
      setIsLoaded(true);
    };
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, [src]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{
      background: 'var(--bg-tertiary, #18181b)',
      borderRadius: 10,
      padding: 14,
    }}>
      <audio ref={audioRef} src={src} preload="metadata" />
      
      {/* Title */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <span style={{
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--text-primary, #e5e5e5)',
        }}>
          {title}
        </span>
        <a
          href={src}
          download
          style={{
            color: 'var(--text-muted, #a1a1aa)',
            textDecoration: 'none',
          }}
          title="Download audio"
        >
          <Download size={14} />
        </a>
      </div>

      {/* Progress */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted, #a1a1aa)', minWidth: 32 }}>
          {formatTime(currentTime)}
        </span>
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={currentTime}
          onChange={seek}
          disabled={!isLoaded}
          style={{
            flex: 1,
            height: 4,
            accentColor: '#a78bfa',
            cursor: isLoaded ? 'pointer' : 'not-allowed',
          }}
        />
        <span style={{ fontSize: 10, color: 'var(--text-muted, #a1a1aa)', minWidth: 32, textAlign: 'right' }}>
          {formatTime(duration)}
        </span>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <button
          onClick={() => {
            if (audioRef.current) {
              audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10);
            }
          }}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted, #a1a1aa)',
            cursor: 'pointer',
            padding: 4,
          }}
        >
          <SkipBack size={16} />
        </button>

        <button
          onClick={togglePlay}
          disabled={!isLoaded}
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: isLoaded ? 'linear-gradient(135deg, #7c3aed, #a78bfa)' : 'var(--bg-secondary, #111113)',
            border: 'none',
            color: '#fff',
            cursor: isLoaded ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: isLoaded ? 1 : 0.5,
          }}
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
        </button>

        <button
          onClick={() => {
            if (audioRef.current) {
              audioRef.current.currentTime = Math.min(duration, audioRef.current.currentTime + 10);
            }
          }}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted, #a1a1aa)',
            cursor: 'pointer',
            padding: 4,
          }}
        >
          <SkipForward size={16} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
          <Volume2 size={14} color="var(--text-muted, #a1a1aa)" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={volume}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setVolume(v);
              if (audioRef.current) audioRef.current.volume = v;
            }}
            style={{ width: 60, height: 3, accentColor: '#a78bfa' }}
          />
        </div>
      </div>
    </div>
  );
}
