import React, { useState, useEffect } from 'react';
import { Play, Pause, FastForward, Rewind, CheckCircle, VideoCamera, SpeakerHigh, Cursor, TextT, MonitorPlay, Sparkle, DownloadSimple, Code, CircleNotch } from '@phosphor-icons/react';
import { motion } from 'framer-motion';

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

  const totalDuration = 30;
  const progress = (currentTime / totalDuration) * 100;

  const [tracks] = useState<{ id: string; name: string; icon: React.ReactNode; items: TrackItem[] }[]>([
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
  ]);

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
    setTimeout(() => {
      setIsRendering(false);
      alert('Render Complete! File saved to /Users/macbook/Desktop/allternit-studio/exports/campaign_reel.mp4');
    }, 3000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'sans-serif', overflow: 'hidden', borderRadius: '24px', border: '1px solid var(--border-subtle)', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}>

      {/* Top Header */}
      <div style={{ height: 56, borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', background: 'var(--bg-secondary)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <VideoCamera size={20} color="var(--accent-primary)" weight="fill" />
          <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>Cutscene Studio</span>
          <span style={{ padding: '2px 8px', borderRadius: 4, background: 'color-mix(in srgb, var(--accent-primary) 10%, transparent)', fontSize: 10, fontWeight: 700, color: 'var(--accent-primary)', marginLeft: 8, textTransform: 'uppercase', letterSpacing: '0.12em', border: '1px solid color-mix(in srgb, var(--accent-primary) 20%, transparent)' }}>
            Programmatic Engine
          </span>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button style={{ padding: '6px 16px', borderRadius: 8, background: 'var(--surface-hover)', border: '1px solid var(--border-subtle)', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle size={14} /> Sync UI State
          </button>
          <button
            onClick={handleRender}
            disabled={isRendering}
            style={{ padding: '6px 16px', borderRadius: 8, background: 'var(--accent-primary)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: isRendering ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: isRendering ? 0.6 : 1 }}
          >
            {isRendering ? <CircleNotch size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <DownloadSimple size={14} weight="bold" />}
            {isRendering ? 'Rendering...' : 'Render MP4'}
          </button>
        </div>
      </div>

      {/* Main Workspace Split */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Left Asset Panel */}
        <div style={{ width: 256, borderRight: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', padding: 16, display: 'flex', flexDirection: 'column', gap: 24, overflowY: 'auto', flexShrink: 0 }}>
          <div>
            <h3 style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12, margin: '0 0 12px' }}>Project Assets</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <AssetItem icon={<Code size={16} />} title="Design.md Tokens" type="Data" />
              <AssetItem icon={<MonitorPlay size={16} />} title="Banking Dashboard" type="UI Block" />
              <AssetItem icon={<MonitorPlay size={16} />} title="Analytics Chart" type="UI Block" />
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12, margin: '0 0 12px' }}>Generative Effects</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <AssetItem icon={<TextT size={16} />} title="Auto-Type Prompt" type="Animation" color="var(--accent-primary)" />
              <AssetItem icon={<Cursor size={16} />} title="Smooth Cursor" type="Animation" color="#10b981" />
              <AssetItem icon={<Sparkle size={16} />} title="Glass Morph" type="Transition" color="#8b5cf6" />
            </div>
          </div>
        </div>

        {/* Center Preview Player */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', position: 'relative' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
            {/* Video Frame — intentionally black canvas as video preview surface */}
            <div style={{ width: '100%', maxWidth: 768, aspectRatio: '16/9', background: '#000', borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 25px 50px rgba(0,0,0,0.4)', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

              {currentTime < 5 ? (
                <div style={{ width: '66%', height: 48, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, display: 'flex', alignItems: 'center', padding: '0 16px' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 14, color: 'rgba(255,255,255,0.8)', borderRight: '2px solid var(--accent-primary)', paddingRight: 4 }}>
                    Mock up a banking dashboard...
                  </span>
                </div>
              ) : currentTime < 15 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  style={{ width: '75%', height: '75%', background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 16, padding: 24 }}
                >
                  <div style={{ width: '33%', height: 16, background: 'rgba(255,255,255,0.2)', borderRadius: 4, marginBottom: 24 }} />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                    <div style={{ height: 80, background: 'rgba(255,255,255,0.1)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }} />
                    <div style={{ height: 80, background: 'rgba(255,255,255,0.1)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }} />
                    <div style={{ height: 80, background: 'rgba(255,255,255,0.1)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }} />
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ backgroundColor: 'rgba(60,60,60,0.4)' }}
                  animate={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
                  style={{ width: '75%', height: '75%', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 24 }}
                >
                  <div style={{ width: '33%', height: 16, background: 'rgba(255,255,255,0.1)', borderRadius: 4, marginBottom: 24 }} />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                    <div style={{ height: 80, background: 'rgba(255,255,255,0.05)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }} />
                    <div style={{ height: 80, background: 'rgba(255,255,255,0.05)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }} />
                    <div style={{ height: 80, background: 'rgba(255,255,255,0.05)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }} />
                  </div>
                </motion.div>
              )}

              <div style={{ position: 'absolute', bottom: 16, right: 16, fontSize: 10, fontFamily: 'monospace', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em' }}>
                [ REMOTION_ENGINE : {currentTime.toFixed(2)}s ]
              </div>
            </div>
          </div>

          {/* Playback Controls */}
          <div style={{ height: 48, background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, flexShrink: 0 }}>
            <button onClick={() => setCurrentTime(0)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center' }}>
              <Rewind size={20} weight="fill" />
            </button>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--text-primary)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--bg-primary)' }}
            >
              {isPlaying ? <Pause size={16} weight="fill" /> : <Play size={16} weight="fill" />}
            </button>
            <button onClick={() => setCurrentTime(totalDuration)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center' }}>
              <FastForward size={20} weight="fill" />
            </button>

            <div style={{ width: 1, height: 16, background: 'var(--border-default)', margin: '0 16px' }} />
            <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-secondary)', width: 96 }}>
              00:{(currentTime < 10 ? '0' : '') + currentTime.toFixed(1)} / 00:{totalDuration}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Timeline */}
      <div style={{ height: 288, background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', position: 'relative', userSelect: 'none', flexShrink: 0 }}>
        {/* Ruler */}
        <div style={{ height: 32, borderBottom: '1px solid var(--border-subtle)', display: 'flex', flexShrink: 0 }}>
          <div style={{ width: 192, borderRight: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', flexShrink: 0 }} />
          <div style={{ flex: 1, position: 'relative', background: 'var(--bg-primary)' }}>
            {Array.from({ length: totalDuration + 1 }).map((_, i) => (
              <div
                key={i}
                style={{ position: 'absolute', top: 0, bottom: 0, borderLeft: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: 4, left: `${(i / totalDuration) * 100}%` }}
              >
                {i % 5 === 0 && <span style={{ fontSize: 9, color: 'var(--text-tertiary)', marginLeft: 4 }}>{i}s</span>}
              </div>
            ))}
            {/* Playhead */}
            <div style={{ position: 'absolute', top: 0, bottom: 0, width: 1, background: 'var(--accent-primary)', zIndex: 50, pointerEvents: 'none', left: `${progress}%` }}>
              <div style={{ position: 'absolute', top: -8, left: -6, width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '8px solid var(--accent-primary)' }} />
            </div>
          </div>
        </div>

        {/* Tracks */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
          {tracks.map((track) => (
            <div key={track.id} style={{ height: 56, borderBottom: '1px solid var(--border-subtle)', display: 'flex' }}>
              <div style={{ width: 192, background: 'var(--bg-secondary)', borderRight: '1px solid var(--border-subtle)', padding: '0 16px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                <div style={{ color: 'var(--text-tertiary)' }}>{track.icon}</div>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.name}</span>
              </div>
              <div style={{ flex: 1, position: 'relative', background: 'var(--bg-primary)' }}>
                {track.items.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      position: 'absolute',
                      top: 8,
                      bottom: 8,
                      borderRadius: 8,
                      border: `1px solid ${item.color}50`,
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0 12px',
                      overflow: 'hidden',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                      cursor: 'pointer',
                      left: `${(item.start / totalDuration) * 100}%`,
                      width: `${(item.duration / totalDuration) * 100}%`,
                      backgroundColor: `${item.color}25`,
                    }}
                  >
                    <span style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: item.color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
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
    <div style={{ padding: 12, borderRadius: 16, background: 'var(--surface-hover)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12, cursor: 'grab' }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</div>
        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>{type}</div>
      </div>
    </div>
  );
}
