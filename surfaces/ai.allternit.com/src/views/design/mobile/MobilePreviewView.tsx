"use client";
import React, { useState, useRef } from 'react';
import {
  DeviceMobile, DeviceTablet, ArrowsOut, ArrowsIn, ArrowCounterClockwise,
  Globe, WifiHigh, BatteryFull, DotsThreeCircle,
} from '@phosphor-icons/react';

// ── Device definitions ────────────────────────────────────────────────────────

interface DeviceSpec {
  id: string;
  label: string;
  brand: 'apple' | 'android' | 'tablet';
  frameW: number;
  frameH: number;
  screenW: number;
  screenH: number;
  borderRadius: number;
  borderWidth: number;
  borderColor: string;
  notch: 'dynamic-island' | 'notch' | 'punch' | 'none';
  homeBar: boolean;
}

const DEVICES: DeviceSpec[] = [
  {
    id: 'iphone15',
    label: 'iPhone 15 Pro',
    brand: 'apple',
    frameW: 300, frameH: 620,
    screenW: 284, screenH: 604,
    borderRadius: 46, borderWidth: 8,
    borderColor: '#2a2a2a',
    notch: 'dynamic-island',
    homeBar: true,
  },
  {
    id: 'iphone14',
    label: 'iPhone 14',
    brand: 'apple',
    frameW: 295, frameH: 610,
    screenW: 279, screenH: 594,
    borderRadius: 44, borderWidth: 8,
    borderColor: '#1c1c1e',
    notch: 'notch',
    homeBar: true,
  },
  {
    id: 'pixel8',
    label: 'Pixel 8',
    brand: 'android',
    frameW: 290, frameH: 615,
    screenW: 274, screenH: 599,
    borderRadius: 36, borderWidth: 8,
    borderColor: '#1a1a1a',
    notch: 'punch',
    homeBar: false,
  },
  {
    id: 'ipad',
    label: 'iPad Air',
    brand: 'tablet',
    frameW: 440, frameH: 600,
    screenW: 424, screenH: 584,
    borderRadius: 20, borderWidth: 8,
    borderColor: '#2a2a2a',
    notch: 'none',
    homeBar: true,
  },
];

// ── Device frame ──────────────────────────────────────────────────────────────

function DeviceFrame({ device, children, scale }: { device: DeviceSpec; children: React.ReactNode; scale: number }) {
  const statusBarColor = '#fff';

  return (
    <div style={{
      width: device.frameW, height: device.frameH,
      background: device.borderColor,
      borderRadius: device.borderRadius,
      padding: device.borderWidth,
      boxShadow: '0 40px 100px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06)',
      position: 'relative',
      transform: `scale(${scale})`,
      transformOrigin: 'top center',
      flexShrink: 0,
    }}>
      {/* Screen area */}
      <div style={{
        width: '100%', height: '100%',
        borderRadius: device.borderRadius - device.borderWidth,
        overflow: 'hidden',
        background: '#000',
        position: 'relative',
        display: 'flex', flexDirection: 'column',
      }}>

        {/* Status bar */}
        <div style={{
          height: device.notch === 'dynamic-island' ? 54 : device.notch === 'notch' ? 44 : 36,
          flexShrink: 0,
          background: '#000',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          padding: '0 22px 6px',
          position: 'relative',
        }}>
          {/* Time */}
          <span style={{ fontSize: 12, fontWeight: 700, color: statusBarColor, letterSpacing: '-0.01em' }}>9:41</span>

          {/* Dynamic Island */}
          {device.notch === 'dynamic-island' && (
            <div style={{
              position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
              width: 120, height: 34, background: '#000',
              borderRadius: 20, border: '2px solid #1a1a1a',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 8,
            }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#1a1a1a' }} />
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#1a1a1a' }} />
            </div>
          )}

          {/* Notch */}
          {device.notch === 'notch' && (
            <div style={{
              position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
              width: 130, height: 28, background: '#000',
              borderRadius: '0 0 18px 18px',
            }} />
          )}

          {/* Punch hole */}
          {device.notch === 'punch' && (
            <div style={{
              position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
              width: 12, height: 12, borderRadius: '50%', background: '#111',
              border: '2px solid #222',
            }} />
          )}

          {/* Status icons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <WifiHigh size={11} color={statusBarColor} weight="bold" />
            <BatteryFull size={13} color={statusBarColor} weight="bold" />
          </div>
        </div>

        {/* Screen content */}
        <div style={{ flex: 1, background: '#fff', overflowY: 'auto' }}>
          {children}
        </div>

        {/* Home bar / nav */}
        {device.homeBar ? (
          <div style={{ height: 28, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <div style={{ width: 100, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.25)' }} />
          </div>
        ) : (
          <div style={{ height: 36, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'space-evenly', flexShrink: 0, padding: '0 40px' }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.3)' }} />
            <div style={{ width: 20, height: 20, borderRadius: 3, border: '1.5px solid rgba(255,255,255,0.3)' }} />
            <div style={{ width: 20, height: 20, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.3)' }} />
          </div>
        )}
      </div>

      {/* Side buttons (Apple) */}
      {device.brand === 'apple' && (
        <>
          <div style={{ position: 'absolute', left: -3, top: 90, width: 3, height: 32, background: '#3a3a3a', borderRadius: '2px 0 0 2px' }} />
          <div style={{ position: 'absolute', left: -3, top: 130, width: 3, height: 56, background: '#3a3a3a', borderRadius: '2px 0 0 2px' }} />
          <div style={{ position: 'absolute', left: -3, top: 196, width: 3, height: 56, background: '#3a3a3a', borderRadius: '2px 0 0 2px' }} />
          <div style={{ position: 'absolute', right: -3, top: 130, width: 3, height: 80, background: '#3a3a3a', borderRadius: '0 2px 2px 0' }} />
        </>
      )}
    </div>
  );
}

// ── Preview content placeholder ───────────────────────────────────────────────

function PreviewContent({ url, projectName }: { url: string; projectName: string }) {
  if (url) {
    return (
      <iframe
        src={url}
        style={{ width: '100%', height: '100%', border: 'none' }}
        title="Mobile Preview"
        sandbox="allow-scripts allow-same-origin allow-forms"
      />
    );
  }

  return (
    <div style={{ padding: 20, fontFamily: 'var(--font-sans)', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* App header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#111', letterSpacing: '-0.02em' }}>{projectName}</div>
        <DotsThreeCircle size={22} color="#888" />
      </div>

      {/* Hero card */}
      <div style={{ borderRadius: 16, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', padding: '20px 18px', marginBottom: 14, color: '#fff' }}>
        <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.8, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Overview</div>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 4 }}>Welcome back</div>
        <div style={{ fontSize: 12, opacity: 0.75 }}>Your project is ready to preview.</div>
      </div>

      {/* Stat row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        {[['Screens', '12'], ['Components', '48']].map(([label, val]) => (
          <div key={label} style={{ borderRadius: 12, background: '#f5f5f7', padding: '14px 14px' }}>
            <div style={{ fontSize: 12, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#111' }}>{val}</div>
          </div>
        ))}
      </div>

      {/* List items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {['Dashboard', 'Analytics', 'Settings', 'Profile'].map(item => (
          <div key={item} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 14px', borderRadius: 12, background: '#f5f5f7' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{item}</span>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366f1' }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function MobilePreviewView({ projectName = 'My App' }: { projectName?: string }) {
  const [mode, setMode] = useState<'preview' | 'snack'>('preview');
  const [activeDeviceId, setActiveDeviceId] = useState('iphone15');
  const [url, setUrl] = useState('');
  const [inputUrl, setInputUrl] = useState('');
  const [scale, setScale] = useState(0.85);
  const device = DEVICES.find(d => d.id === activeDeviceId) ?? DEVICES[0];

  const loadUrl = () => {
    let u = inputUrl.trim();
    if (u && !u.startsWith('http')) u = 'https://' + u;
    setUrl(u);
  };

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%', overflow: 'hidden', background: 'var(--bg-secondary)' }}>

      {/* ── Left: device selector + controls ── */}
      <div style={{ width: 200, background: 'var(--bg-primary)', borderRight: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>

        {/* Mode switcher */}
        <div style={{ display: 'flex', padding: '10px 10px 0', gap: 4, flexShrink: 0 }}>
          {(['preview', 'snack'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              style={{ flex: 1, padding: '6px 0', borderRadius: 7, border: `1px solid ${mode === m ? 'var(--accent-primary)' : 'var(--border-subtle)'}`, background: mode === m ? 'color-mix(in srgb, var(--accent-primary) 10%, transparent)' : 'transparent', color: mode === m ? 'var(--accent-primary)' : 'var(--text-tertiary)', fontSize: 12, fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize' }}>
              {m === 'snack' ? 'Expo IDE' : 'Preview'}
            </button>
          ))}
        </div>

        <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid var(--border-subtle)', marginTop: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 8 }}>Device</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {DEVICES.map(d => {
              const active = d.id === activeDeviceId;
              return (
                <button key={d.id} onClick={() => setActiveDeviceId(d.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', borderRadius: 8, border: `1px solid ${active ? 'var(--accent-primary)' : 'transparent'}`, background: active ? 'color-mix(in srgb, var(--accent-primary) 10%, transparent)' : 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                  {d.brand === 'tablet' ? <DeviceTablet size={13} color={active ? 'var(--accent-primary)' : 'var(--text-tertiary)'} /> : <DeviceMobile size={13} color={active ? 'var(--accent-primary)' : 'var(--text-tertiary)'} />}
                  <span style={{ fontSize: 12, fontWeight: active ? 700 : 400, color: active ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>{d.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Scale */}
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 8 }}>Scale</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {[0.7, 0.85, 1.0].map(s => (
              <button key={s} onClick={() => setScale(s)}
                style={{ flex: 1, padding: '5px 0', borderRadius: 6, border: `1px solid ${scale === s ? 'var(--accent-primary)' : 'var(--border-subtle)'}`, background: scale === s ? 'color-mix(in srgb, var(--accent-primary) 10%, transparent)' : 'transparent', color: scale === s ? 'var(--accent-primary)' : 'var(--text-tertiary)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                {Math.round(s * 100)}%
              </button>
            ))}
          </div>
        </div>

        {/* URL input */}
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 8 }}>Preview URL</div>
          <input
            value={inputUrl}
            onChange={e => setInputUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && loadUrl()}
            placeholder="localhost:3000"
            style={{ width: '100%', boxSizing: 'border-box', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border-default)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 12, outline: 'none', marginBottom: 6 }}
          />
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={loadUrl}
              style={{ flex: 1, padding: '5px 0', borderRadius: 6, border: 'none', background: 'var(--accent-primary)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <Globe size={10} /> Load
            </button>
            {url && (
              <button onClick={() => { setUrl(''); setInputUrl(''); }}
                style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-tertiary)', fontSize: 12, cursor: 'pointer' }}>
                <ArrowCounterClockwise size={10} />
              </button>
            )}
          </div>
        </div>

        {/* Dimensions info */}
        <div style={{ padding: '10px 12px', marginTop: 'auto' }}>
          <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 6 }}>Screen</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{device.screenW}×{device.screenH}px</div>
        </div>
      </div>

      {/* ── Center: device preview or Expo Snack IDE ── */}
      {mode === 'preview' ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 32px', overflowY: 'auto', background: 'var(--bg-secondary)' }}>
          <DeviceFrame device={device} scale={scale}>
            <PreviewContent url={url} projectName={projectName} />
          </DeviceFrame>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Expo Snack — React Native IDE</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Write React Native code and preview on iOS, Android, or Web</div>
            <a
              href="https://snack.expo.dev"
              target="_blank"
              rel="noopener noreferrer"
              style={{ marginLeft: 'auto', padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', textDecoration: 'none' }}
            >
              Open full screen ↗
            </a>
          </div>
          <iframe
            src={`https://snack.expo.dev/embedded?name=${encodeURIComponent(projectName)}&platform=ios&theme=dark&preview=true`}
            style={{ flex: 1, border: 'none', display: 'block' }}
            allow="geolocation; microphone; camera"
            title="Expo Snack IDE"
          />
        </div>
      )}
    </div>
  );
}
