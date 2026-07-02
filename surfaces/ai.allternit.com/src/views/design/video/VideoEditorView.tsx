import React, { useState, useEffect } from 'react';
import { Play, Pause, FastForward, Rewind, CheckCircle, VideoCamera, SpeakerHigh, Cursor, TextT, MonitorPlay, Sparkle, DownloadSimple, Code, CircleNotch } from '@phosphor-icons/react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface TrackItem {
  id: string;
  type: 'ui_render' | 'typing' | 'cursor' | 'voiceover' | 'transition';
  start: number;
  duration: number;
  label: string;
  color: string;
}

export function VideoEditorView() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isRendering, setIsRendering] = useState(false);
  const [renderDone, setRenderDone] = useState(false);

  const totalDuration = 30;
  const progress = (currentTime / totalDuration) * 100;

  const tracks: { id: string; name: string; icon: React.ReactNode; items: TrackItem[] }[] = [
    {
      id: 'ui',
      name: 'UI Manifestation',
      icon: <MonitorPlay size={16} />,
      items: [
        { id: '1', type: 'ui_render', start: 5, duration: 10, label: 'Render Banking Dashboard', color: 'var(--status-info)' },
        { id: '2', type: 'transition', start: 15, duration: 2, label: 'Glass Morph Transition', color: '#8b5cf6' },
        { id: '3', type: 'ui_render', start: 17, duration: 10, label: 'Apply Dark Mode Tokens', color: 'var(--status-info)' },
      ],
    },
    {
      id: 'agent',
      name: 'Agent Typing',
      icon: <TextT size={16} />,
      items: [
        { id: '4', type: 'typing', start: 1, duration: 4, label: '"Mock up a banking dashboard..."', color: 'var(--accent-primary)' },
        { id: '5', type: 'typing', start: 15, duration: 2, label: '"Make it dark mode"', color: 'var(--accent-primary)' },
      ],
    },
    {
      id: 'cursor',
      name: 'Cursor Movement',
      icon: <Cursor size={16} />,
      items: [
        { id: '6', type: 'cursor', start: 4, duration: 1, label: 'Click Send', color: 'var(--status-success)' },
        { id: '7', type: 'cursor', start: 20, duration: 3, label: 'Interact with Chart', color: 'var(--status-success)' },
      ],
    },
    {
      id: 'audio',
      name: 'AI Voiceover',
      icon: <SpeakerHigh size={16} />,
      items: [
        { id: '8', type: 'voiceover', start: 0, duration: 5, label: 'Welcome to the new studio...', color: 'var(--status-warning)' },
        { id: '9', type: 'voiceover', start: 6, duration: 8, label: 'Instantly generate high-fidelity UI...', color: 'var(--status-warning)' },
      ],
    },
  ];

  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime((t) => {
          if (t >= totalDuration) {
            setIsPlaying(false);
            return totalDuration;
          }
          return t + 0.1;
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  const handleRender = async () => {
    setIsRendering(true);
    setRenderDone(false);
    setTimeout(() => {
      setIsRendering(false);
      setRenderDone(true);
    }, 3000);
  };

  return (
    <div className="flex flex-col size-full bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans overflow-hidden rounded-3xl border border-solid border-[var(--border-subtle)] shadow-[0_25px_50px_rgba(0,0,0,0.25)]">

      {/* Top Header */}
      <div className="h-14 border-b border-solid border-[var(--border-subtle)] flex items-center justify-between px-6 bg-[var(--bg-secondary)] shrink-0">
        <div className="flex items-center gap-3">
          <VideoCamera size={20} className="text-[var(--accent-primary)]" weight="fill" />
          <span className="font-bold text-[14px] tracking-[0.08em] uppercase text-[var(--text-primary)]">Cutscene Studio</span>
          <span className="px-2 py-0.5 rounded border border-solid border-[color-mix(in_srgb,var(--accent-primary)_20%,transparent)] bg-[color-mix(in_srgb,var(--accent-primary)_10%,transparent)] text-[12px] font-bold text-[var(--accent-primary)] ml-2 uppercase tracking-[0.12em]">
            Programmatic Engine
          </span>
        </div>
        <div className="flex gap-3">
          <button type="button" className="px-4 py-1.5 rounded-lg bg-[var(--surface-hover)] border border-solid border-[var(--border-subtle)] text-[12px] font-bold text-[var(--text-secondary)] cursor-pointer flex items-center gap-2 transition-colors hover:bg-[var(--surface-active)]">
            <CheckCircle size={14} /> Sync UI State
          </button>
          <button type="button"
            onClick={handleRender}
            disabled={isRendering}
            className={cn(
              "px-4 py-1.5 rounded-lg border-none text-white text-[12px] font-bold flex items-center gap-2 transition-opacity",
              isRendering ? "cursor-not-allowed opacity-60 bg-[var(--accent-primary)]" : "cursor-pointer bg-[var(--accent-primary)] hover:opacity-90"
            )}
          >
            {isRendering ? <CircleNotch size={14} className="animate-spin" /> : <DownloadSimple size={14} weight="bold" />}
            {isRendering ? 'Rendering...' : 'Render MP4'}
          </button>
          {renderDone && (
            <span className="flex items-center gap-1.5 text-[12px] font-bold text-[var(--status-success)] animate-fade-in">
              <CheckCircle size={14} weight="fill" /> Render complete
            </span>
          )}
        </div>
      </div>

      {/* Main Workspace Split */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left Asset Panel */}
        <div className="w-64 border-r border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4 flex flex-col gap-6 overflow-y-auto shrink-0">
          <div>
            <h3 className="text-[12px] font-extrabold text-[var(--text-tertiary)] uppercase tracking-[0.12em] mb-3 mt-0">Project Assets</h3>
            <div className="flex flex-col gap-2">
              <AssetItem icon={<Code size={16} />} title="Design.md Tokens" type="Data" />
              <AssetItem icon={<MonitorPlay size={16} />} title="Banking Dashboard" type="UI Block" />
              <AssetItem icon={<MonitorPlay size={16} />} title="Analytics Chart" type="UI Block" />
            </div>
          </div>

          <div>
            <h3 className="text-[12px] font-extrabold text-[var(--text-tertiary)] uppercase tracking-[0.12em] mb-3 mt-0">Generative Effects</h3>
            <div className="flex flex-col gap-2">
              <AssetItem icon={<TextT size={16} />} title="Auto-Type Prompt" type="Animation" color="var(--accent-primary)" />
              <AssetItem icon={<Cursor size={16} />} title="Smooth Cursor" type="Animation" color="#10b981" />
              <AssetItem icon={<Sparkle size={16} />} title="Glass Morph" type="Transition" color="#8b5cf6" />
            </div>
          </div>
        </div>

        {/* Center Preview Player */}
        <div className="flex-1 flex flex-col bg-[var(--bg-primary)] relative">
          <div className="flex-1 flex items-center justify-center p-8">
            {/* Video Frame — intentionally black canvas as video preview surface */}
            <div className="w-full max-w-3xl aspect-video bg-black rounded-2xl border border-solid border-white/10 shadow-[0_25px_50px_rgba(0,0,0,0.4)] relative overflow-hidden flex items-center justify-center">

              {currentTime < 5 ? (
                <div className="w-2/3 h-12 bg-white/5 border border-solid border-white/10 rounded-xl flex items-center px-4">
                  <span className="font-mono text-[14px] text-white/80 border-r-2 border-solid border-[var(--accent-primary)] pr-1">
                    Mock up a banking dashboard...
                  </span>
                </div>
              ) : currentTime < 15 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className="w-3/4 h-3/4 bg-white/10 backdrop-blur-xl border border-solid border-white/20 rounded-2xl p-6"
                >
                  <div className="w-1/3 h-4 bg-white/20 rounded mb-6" />
                  <div className="grid grid-cols-3 gap-4">
                    <div className="h-20 bg-white/10 rounded-xl border border-solid border-white/5" />
                    <div className="h-20 bg-white/10 rounded-xl border border-solid border-white/5" />
                    <div className="h-20 bg-white/10 rounded-xl border border-solid border-white/5" />
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ backgroundColor: 'rgba(60,60,60,0.4)' }}
                  animate={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
                  className="w-3/4 h-3/4 backdrop-blur-xl border border-solid border-white/10 rounded-2xl p-6"
                >
                  <div className="w-1/3 h-4 bg-white/10 rounded mb-6" />
                  <div className="grid grid-cols-3 gap-4">
                    <div className="h-20 bg-white/5 rounded-xl border border-solid border-white/5" />
                    <div className="h-20 bg-white/5 rounded-xl border border-solid border-white/5" />
                    <div className="h-20 bg-white/5 rounded-xl border border-solid border-white/5" />
                  </div>
                </motion.div>
              )}

              <div className="absolute bottom-4 right-4 text-[12px] font-mono text-white/30 tracking-[0.1em]">
                [ REMOTION_ENGINE : {currentTime.toFixed(2)}s ]
              </div>
            </div>
          </div>

          {/* Playback Controls */}
          <div className="h-12 bg-[var(--bg-secondary)] border-t border-solid border-[var(--border-subtle)] flex items-center justify-center gap-6 shrink-0">
            <button type="button" onClick={() => setCurrentTime(0)} className="bg-transparent border-none cursor-pointer text-[var(--text-tertiary)] flex items-center hover:text-[var(--text-secondary)] transition-colors">
              <Rewind size={20} weight="fill" />
            </button>
            <button type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className="size-8 rounded-full bg-[var(--text-primary)] border-none flex items-center justify-center cursor-pointer text-[var(--bg-primary)] hover:opacity-90 transition-opacity"
            >
              {isPlaying ? <Pause size={16} weight="fill" /> : <Play size={16} weight="fill" />}
            </button>
            <button type="button" onClick={() => setCurrentTime(totalDuration)} className="bg-transparent border-none cursor-pointer text-[var(--text-tertiary)] flex items-center hover:text-[var(--text-secondary)] transition-colors">
              <FastForward size={20} weight="fill" />
            </button>

            <div className="w-px h-4 bg-[var(--border-default)] mx-4" />
            <span className="font-mono text-[12px] text-[var(--text-secondary)] w-24">
              00:{(currentTime < 10 ? '0' : '') + currentTime.toFixed(1)} / 00:{totalDuration}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Timeline */}
      <div className="h-72 bg-[var(--bg-secondary)] border-t border-solid border-[var(--border-subtle)] flex flex-col relative select-none shrink-0">
        {/* Ruler */}
        <div className="h-8 border-b border-solid border-[var(--border-subtle)] flex shrink-0">
          <div className="w-48 border-r border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] shrink-0" />
          <div className="flex-1 relative bg-[var(--bg-primary)]">
            {Array.from({ length: totalDuration + 1 }).map((_, i) => (
              <div
                key={`ruler-${i}`}
                className="absolute top-0 bottom-0 border-l border-solid border-[var(--border-subtle)] flex flex-col justify-end pb-1"
                style={{ left: `${(i / totalDuration) * 100}%` }}
              >
                {i % 5 === 0 && <span className="text-[12px] text-[var(--text-tertiary)] ml-1">{i}s</span>}
              </div>
            ))}
            {/* Playhead */}
            <div className="absolute top-0 bottom-0 w-px bg-[var(--accent-primary)] z-50 pointer-events-none" style={{ left: `${progress}%` }}>
              <div className="absolute -top-2 -left-1.5 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-[var(--accent-primary)]" />
            </div>
          </div>
        </div>

        {/* Tracks */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col relative">
          {tracks.map((track) => (
            <div key={track.id} className="h-14 border-b border-solid border-[var(--border-subtle)] flex">
              <div className="w-48 bg-[var(--bg-secondary)] border-r border-solid border-[var(--border-subtle)] px-4 flex items-center gap-3 shrink-0">
                <div className="text-[var(--text-tertiary)]">{track.icon}</div>
                <span className="text-[12px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.08em] truncate">{track.name}</span>
              </div>
              <div className="flex-1 relative bg-[var(--bg-primary)]">
                {track.items.map((item) => (
                  <div
                    key={item.id}
                    className="absolute top-2 bottom-2 rounded-lg border border-solid flex items-center px-3 overflow-hidden shadow-md cursor-pointer"
                    style={{
                      left: `${(item.start / totalDuration) * 100}%`,
                      width: `${(item.duration / totalDuration) * 100}%`,
                      backgroundColor: `${item.color}25`,
                      borderColor: `${item.color}50`,
                    }}
                  >
                    <span className="text-[12px] font-black uppercase tracking-[0.1em] truncate" style={{ color: item.color }}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AssetItem({ icon, title, type, color = 'var(--text-primary)' }: any) {
  return (
    <div className="p-3 rounded-2xl bg-[var(--surface-hover)] border border-solid border-[var(--border-subtle)] flex items-center gap-3 cursor-grab hover:border-[var(--ui-border-default)] transition-colors">
      <div className="size-8 rounded-lg bg-[var(--bg-primary)] flex items-center justify-center shrink-0" style={{ color }}>
        {icon}
      </div>
      <div>
        <div className="text-[12px] font-bold text-[var(--text-primary)]">{title}</div>
        <div className="text-[12px] font-bold text-[var(--text-tertiary)] uppercase tracking-[0.08em] mt-0.5">{type}</div>
      </div>
    </div>
  );
}
