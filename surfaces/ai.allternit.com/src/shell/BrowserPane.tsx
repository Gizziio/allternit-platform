"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useBrowserStore } from '../capsules/browser';
import { useBrowserShortcutsStore, getFaviconUrl } from '../capsules/browser/browserShortcuts.store';
import { useBrowserAgentStore } from '../capsules/browser/browserAgent.store';
import { GizziMascot, type GizziEmotion } from '../components/ai-elements/GizziMascot';
import { Globe, MagnifyingGlass, X, Plus, Clock, PuzzlePiece } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

const lazy = <T extends React.ComponentType<any>>(
  factory: () => Promise<any>,
  key?: string
) => React.lazy(
  key
    ? () => factory().then(m => ({ default: m[key] }))
    : factory as () => Promise<{ default: T }>
);

const BrowserCapsuleEnhanced = lazy(() => import('../capsules/browser/BrowserCapsuleEnhanced'), 'BrowserCapsuleEnhanced');

// ── Browser Landing Animations ──
const browserLandingAnimations = `
@keyframes browserFadeSlideUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
@keyframes browserBlurIn { from { opacity: 0; filter: blur(12px); transform: scale(1.1); } to { opacity: 1; filter: blur(0); transform: scale(1); } }
@keyframes browserClipReveal { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
@keyframes browserLetterSpacingIn { from { opacity: 0; letter-spacing: 0.3em; } to { opacity: 1; letter-spacing: -0.01em; } }
@keyframes browserScaleIn { from { opacity: 0; transform: scale(0.7); } to { opacity: 1; transform: scale(1); } }
@keyframes browserSlideFromLeft { from { opacity: 0; transform: translateX(-60px) skewX(-8deg); } to { opacity: 1; transform: translateX(0) skewX(0); } }
@keyframes browserLandingFadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
@keyframes browserLandingFadeOut { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(0.97); } }
@keyframes browserCardSlideUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
`;

const BROWSER_ANIM_NAMES = [
  'browserFadeSlideUp',
  'browserBlurIn',
  'browserClipReveal',
  'browserLetterSpacingIn',
  'browserScaleIn',
  'browserSlideFromLeft',
];

const BROWSER_TITLES = [
  "Navigator's Deck",
  'Browse & Build',
  'The Web Layer',
  'Allternit Explorer',
  'Portal Online',
  'Web Surface',
];
const BROWSER_TAGLINES = [
  'AI-Powered Browsing',
  'Navigate with Intelligence',
  'Your Web, Amplified',
  'Explore Fearlessly',
  'Browse. Automate. Build.',
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const browserTokens = {
  accent: 'var(--accent-primary)',
  glow: 'color-mix(in srgb, var(--accent-primary) 26%, transparent)',
  soft: 'color-mix(in srgb, var(--accent-primary) 14%, transparent)',
  border: 'color-mix(in srgb, var(--accent-primary) 16%, transparent)',
  wash: 'color-mix(in srgb, var(--accent-primary) 18%, transparent)',
  fog: 'color-mix(in srgb, var(--accent-primary) 20%, transparent)',
  edge: 'color-mix(in srgb, var(--accent-primary) 16%, transparent)',
  panelTint: 'color-mix(in srgb, var(--accent-primary) 8%, transparent)',
  shadow: 'color-mix(in srgb, var(--accent-primary) 14%, transparent)',
  base: 'var(--bg-primary)',
};

const BACKGROUND = {
  secondary: 'var(--bg-secondary)',
};

const BORDER = {
  subtle: 'var(--border-subtle)',
};

const TEXT = {
  secondary: 'var(--text-secondary)',
  primary: 'var(--text-primary)',
};

export function BrowserPaneWrapper({ children }: { children: React.ReactNode }): React.ReactNode {
  const { tabs, addTab, recentVisits } = useBrowserStore();
  const { shortcuts, addShortcut, removeShortcut, reorderShortcuts } = useBrowserShortcutsStore();
  const { mode: agentMode, setMode: setAgentMode } = useBrowserAgentStore();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [topOffset, setTopOffset] = useState(0);
  const isDragging = useRef(false);
  const dragStartY = useRef(0);
  const dragStartOffset = useRef(0);
  const hasTabs = tabs.length > 0;

  // Smooth transition state
  const [showLanding, setShowLanding] = useState(!hasTabs);
  const [landingAnim, setLandingAnim] = useState<'in' | 'out' | null>(null);
  const prevHadTabs = useRef(hasTabs);

  useEffect(() => {
    if (hasTabs && !prevHadTabs.current) {
      // Tabs appeared
    } else if (!hasTabs && prevHadTabs.current) {
      setShowLanding(true);
      setLandingAnim('in');
    } else if (!hasTabs) {
      setShowLanding(true);
    }

    if (hasTabs) {
      setLandingAnim('out');
      const timer = setTimeout(() => setShowLanding(false), 250);
      prevHadTabs.current = hasTabs;
      return () => clearTimeout(timer);
    }

    prevHadTabs.current = hasTabs;
  }, [hasTabs]);

  const [mascotEmotion, setMascotEmotion] = useState<GizziEmotion>('steady');
  const [isHovering, setIsHovering] = useState(false);

  const [greeting, setGreeting] = useState({
    title: BROWSER_TITLES[0],
    tagline: BROWSER_TAGLINES[0],
    titleAnim: BROWSER_ANIM_NAMES[0],
    taglineAnim: BROWSER_ANIM_NAMES[0],
  });

  useEffect(() => {
    setGreeting({
      title: pickRandom(BROWSER_TITLES),
      tagline: pickRandom(BROWSER_TAGLINES),
      titleAnim: pickRandom(BROWSER_ANIM_NAMES),
      taglineAnim: pickRandom(BROWSER_ANIM_NAMES),
    });
  }, []);

  const [editMode, setEditMode] = useState(false);
  const [addingShortcut, setAddingShortcut] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newIcon, setNewIcon] = useState('');
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [faviconErrors, setFaviconErrors] = useState<Set<string>>(new Set());

  const agentActive = agentMode !== 'Human';

  const pulseMascot = useCallback((emotion: GizziEmotion) => {
    setMascotEmotion(emotion);
    setTimeout(() => setMascotEmotion('steady'), 640);
  }, []);

  useEffect(() => {
    const card = wrapperRef.current?.closest('[data-shell-card]') as HTMLElement | null;
    if (!card) return;
    if (hasTabs) {
      card.style.marginTop = '0';
      card.style.height = '100%';
      card.style.background = 'var(--shell-view-bg)';
      card.style.border = 'none';
      card.style.boxShadow = 'none';
    } else {
      card.style.marginTop = '0';
      card.style.height = '100%';
      card.style.background = 'transparent';
      card.style.border = 'none';
      card.style.boxShadow = 'none';
    }
    return () => {
      card.style.marginTop = '';
      card.style.height = '100%';
      card.style.background = '';
      card.style.border = '';
      card.style.boxShadow = '';
    };
  }, [topOffset, hasTabs]);

  const handleDragStart = useCallback((e: React.MouseEvent<HTMLDivElement>): void => {
    e.preventDefault();
    isDragging.current = true;
    dragStartY.current = e.clientY;
    dragStartOffset.current = topOffset;

    const handleMove = (ev: MouseEvent): void => {
      if (!isDragging.current) return;
      const delta = ev.clientY - dragStartY.current;
      const next = Math.max(0, Math.min(600, dragStartOffset.current + delta));
      setTopOffset(next);
    };
    const handleUp = (): void => {
      isDragging.current = false;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ns-resize';
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, [topOffset]);

  const handleAddShortcut = (): void => {
    if (!newLabel.trim() || !newUrl.trim()) return;
    let url = newUrl.trim();
    if (!url.match(/^https?:\/\//)) url = `https://${url}`;
    addShortcut({ label: newLabel.trim(), url, icon: newIcon || '' });
    setNewLabel('');
    setNewUrl('');
    setNewIcon('');
    setAddingShortcut(false);
  };

  return (
    <>
      <style>{browserLandingAnimations}</style>
      {showLanding && (
        <div
          className={cn(
            "w-full h-full flex flex-col items-center justify-center bg-[var(--view-browser-bg,var(--surface-canvas))] text-[var(--text-primary)] font-sans relative overflow-hidden",
            landingAnim === 'out' ? "animate-[browserLandingFadeOut_0.25s_ease-out_forwards]" : 
            landingAnim === 'in' ? "animate-[browserLandingFadeIn_0.35s_ease-out_forwards]" : ""
          )}
        >
          <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: `radial-gradient(circle, color-mix(in srgb, ${browserTokens.accent} 30%, transparent) 1px, transparent 1px)`, backgroundSize: '22px 22px', backgroundPosition: '11px 11px' }} />
          <div className="relative z-[1] flex flex-col items-center max-w-[640px] w-full px-6">
            <div className="mb-6 relative cursor-pointer" onMouseEnter={() => { setIsHovering(true); pulseMascot('pleased'); }} onMouseLeave={() => { setIsHovering(false); setMascotEmotion('steady'); }}>
              <div className={cn("absolute -inset-6 rounded-full blur-[10px] pointer-events-none transition-all duration-400 ease", isHovering ? "scale-110 opacity-100" : "scale-80 opacity-0")} style={{ background: browserTokens.soft }} />
              <div className={cn("transition-transform duration-300 ease", isHovering ? "scale-110" : "scale-100")}>
                <GizziMascot size={76} emotion={mascotEmotion} />
              </div>
            </div>
            <h1 className="text-[32px] font-medium text-[var(--text-primary)] mb-2 font-[var(--font-research)]" style={{ animation: `${greeting.titleAnim} 0.6s ease-out 100ms both` }}>{greeting.title}</h1>
            <div className="flex items-center gap-3 mb-8" style={{ animation: `${greeting.taglineAnim} 0.6s ease-out 350ms both` }}>
              <div className="w-8 h-px" style={{ background: browserTokens.border }} />
              <p className="text-[var(--text-secondary)] text-[14px] uppercase tracking-[0.08em] m-0">{greeting.tagline}</p>
              <div className="w-8 h-px" style={{ background: browserTokens.border }} />
            </div>
            <div className="w-full max-w-[560px] mb-6">
              <form onSubmit={(e) => {
                e.preventDefault();
                const input = e.currentTarget.querySelector('input') as HTMLInputElement;
                if (input?.value.trim()) {
                  const v = input.value.trim();
                  if (v.match(/^https?:\/\//) || (v.includes('.') && !v.includes(' '))) {
                    addTab(v.match(/^https?:\/\//) ? v : `https://${v}`);
                  } else {
                    addTab(`https://www.google.com/search?q=${encodeURIComponent(v)}`);
                  }
                  input.value = '';
                }
              }} className="relative">
                <input aria-label="Search the web or enter a URL…" type="text" placeholder="Search the web or enter a URL…" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} className="w-full h-14 pl-6 pr-14 bg-[var(--bg-secondary)] border border-solid border-[var(--border-subtle)] rounded-xl text-[var(--text-primary)] text-[18px] outline-none box-border transition-all duration-200" onFocus={(e) => { e.currentTarget.style.borderColor = browserTokens.accent; e.currentTarget.style.boxShadow = `0 0 0 3px ${browserTokens.soft}`; }} onBlur={(e) => { e.currentTarget.style.borderColor = BORDER.subtle; e.currentTarget.style.boxShadow = 'none'; }} />
                <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 p-2 border-none rounded-lg cursor-pointer" style={{ background: browserTokens.accent }}>
                  <MagnifyingGlass className="w-5 h-5 text-[var(--bg-primary)]" />
                </button>
              </form>
            </div>
            <button type="button" onClick={() => setAgentMode(agentActive ? 'Human' : 'Assist')} className={cn("inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-solid text-[12px] cursor-pointer mb-8 transition-all duration-200", agentActive ? "text-[var(--accent-primary)]" : "bg-[var(--bg-secondary)] border-[var(--border-subtle)] text-[var(--text-secondary)]")} style={agentActive ? { background: browserTokens.panelTint, borderColor: browserTokens.border, color: browserTokens.accent } : undefined}>
              <PuzzlePiece className="w-3.5 h-3.5" weight="fill" />
              <span>Allternit Computer Agent: {agentActive ? 'Active' : 'Off'}</span>
            </button>
            <div className="w-full max-w-[560px]">
              <div className="flex justify-end mb-2">
                <button type="button" onClick={() => setEditMode(!editMode)} className="bg-transparent border-none text-[12px] cursor-pointer underline px-1 py-0.5" style={{ color: editMode ? browserTokens.accent : TEXT.secondary }}>{editMode ? 'Done' : 'Customize'}</button>
              </div>
              <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(shortcuts.length + 1, 4)}, 1fr)` }}>
                {shortcuts.map((item, idx) => {
                  const faviconSrc = getFaviconUrl(item.url, 64);
                  const useFavicon = faviconSrc && !faviconErrors.has(item.id);
                  return (
                  <button type="button" key={item.id} draggable={editMode} onDragStart={() => setDragIdx(idx)} onDragOver={(e) => { e.preventDefault(); setDragOverIdx(idx); }} onDragLeave={() => setDragOverIdx(null)} onDrop={(e) => { e.preventDefault(); if (dragIdx !== null && dragIdx !== idx) reorderShortcuts(dragIdx, idx); setDragIdx(null); setDragOverIdx(null); }} onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }} onClick={() => !editMode && addTab(item.url)} className={cn("flex flex-col items-center gap-2 p-[16px_12px] rounded-xl relative border border-solid text-[12px] transition-all duration-200", editMode ? "cursor-grab" : "cursor-pointer")} style={{ background: dragOverIdx === idx ? browserTokens.panelTint : BACKGROUND.secondary, borderColor: dragOverIdx === idx ? browserTokens.accent : BORDER.subtle, color: TEXT.secondary, opacity: dragIdx === idx ? 0.4 : 1 }} onMouseEnter={(e) => { if (!editMode) { e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.color = 'var(--accent-primary)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; } }} onMouseLeave={(e) => { if (dragOverIdx !== idx) e.currentTarget.style.borderColor = BORDER.subtle; e.currentTarget.style.color = TEXT.secondary; e.currentTarget.style.boxShadow = 'none'; }}>
                    {editMode && <div role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); removeShortcut(item.id); }} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[var(--status-error)] text-[var(--bg-primary)] flex items-center justify-center cursor-pointer text-[12px] leading-none z-[2]"><X className="w-3 h-3" /></div>}
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-[22px] overflow-hidden" style={{ background: browserTokens.panelTint }}>{useFavicon ? <img src={faviconSrc} alt="" className="w-7 h-7 object-contain" onError={() => setFaviconErrors((prev) => new Set(prev).add(item.id))} /> : <Globe className="w-5 h-5 opacity-50" />}</div>
                    <span>{item.label}</span>
                  </button>
                  );
                })}
                {!addingShortcut ? (
                  <button type="button" onClick={() => setAddingShortcut(true)} className="flex flex-col items-center justify-center gap-2 p-[16px_12px] rounded-xl bg-transparent border border-dashed border-[var(--border-subtle)] cursor-pointer text-[var(--text-tertiary)] text-[12px] transition-colors duration-200" onMouseEnter={(e) => { e.currentTarget.style.borderColor = browserTokens.accent; e.currentTarget.style.color = browserTokens.accent; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = BORDER.subtle; e.currentTarget.style.color = TEXT.secondary; }}>
                    <Plus className="w-5 h-5" />
                    <span>Add</span>
                  </button>
                ) : (
                  <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-[var(--bg-secondary)] border border-solid border-[var(--border-subtle)] col-span-2">
                    <input aria-label="Shortcut label" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Label" className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] rounded-md px-2 py-1 text-[var(--text-primary)] text-[12px] outline-none" />
                    <input aria-label="Shortcut URL" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="URL" className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] rounded-md px-2 py-1 text-[var(--text-primary)] text-[12px] outline-none" />
                    <div className="flex gap-1.5">
                      <input aria-label="Shortcut icon" value={newIcon} onChange={(e) => setNewIcon(e.target.value)} placeholder="Emoji" className="w-10 bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] rounded-md px-1.5 py-1 text-[var(--text-primary)] text-[12px] outline-none text-center" />
                      <button type="button" onClick={handleAddShortcut} className="flex-1 px-2 py-1 rounded-md border-none text-[var(--bg-primary)] text-[12px] font-semibold cursor-pointer" style={{ background: browserTokens.accent }}>Save</button>
                      <button type="button" onClick={() => setAddingShortcut(false)} className="px-2 py-1 rounded-md bg-[var(--bg-primary)] border-none text-[var(--text-secondary)] text-[12px] cursor-pointer">Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            {recentVisits.length > 0 && (
              <div className="w-full max-w-[560px] mt-8">
                <div className="flex items-center gap-1.5 mb-2.5 text-[var(--text-tertiary)] text-[12px] uppercase tracking-[0.06em]">
                  <Clock className="w-3 h-3" />
                  <span>Recently Visited</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  {recentVisits.slice(0, 6).map((visit) => {
                    const visitFavicon = getFaviconUrl(visit.url, 32);
                    return (
                      <button type="button" key={visit.url + visit.visitedAt} onClick={() => addTab(visit.url)} className="flex items-center gap-2.5 px-3 py-2 rounded-md bg-transparent border-none cursor-pointer text-[var(--text-secondary)] text-[12px] text-left w-full transition-colors duration-150" onMouseEnter={(e) => { e.currentTarget.style.background = browserTokens.panelTint; e.currentTarget.style.color = TEXT.primary; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = TEXT.secondary; }}>
                        <div className="w-6 h-6 rounded bg-transparent flex items-center justify-center shrink-0 overflow-hidden" style={{ background: browserTokens.panelTint }}>{visitFavicon ? <img src={visitFavicon} alt="" className="w-4 h-4 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /> : <Globe className="w-3 h-3 opacity-40" />}</div>
                        <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{visit.title}</span>
                        <span className="text-[12px] text-[var(--text-tertiary)] shrink-0">{new URL(visit.url).hostname}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      <div ref={wrapperRef} className={cn("w-full h-full flex-col bg-[var(--view-browser-bg,#f6f8fc)]", hasTabs ? "flex animate-[browserCardSlideUp_0.3s_ease-out]" : "hidden")}>
        <div onMouseDown={handleDragStart} className="hidden">
          <div className="w-10 h-1 rounded-full bg-[var(--border-subtle)] transition-colors duration-150" onMouseEnter={(e) => { e.currentTarget.style.background = browserTokens.accent; }} onMouseLeave={(e) => { e.currentTarget.style.background = BORDER.subtle; }} />
        </div>
        <div className="flex-1 min-h-0 flex overflow-hidden">{children}</div>
      </div>
    </>
  );
}

export function BrowserSurfaceFrame({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }): React.ReactNode {
  return (
    <div className="w-full h-full flex flex-col bg-[var(--view-browser-bg,#f6f8fc)]">
      <div className="flex items-center gap-2.5 p-[18px_24px_14px] border-b border-solid border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--surface-floating)_86%,transparent)] backdrop-blur-md shrink-0">
        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: browserTokens.accent, boxShadow: `0 0 0 6px ${browserTokens.soft}` }} />
        <div>
          <div className="text-[18px] font-semibold text-[var(--text-primary)] font-sans">{title}</div>
          {subtitle && <div className="text-[12px] text-[var(--text-secondary)] mt-0.5">{subtitle}</div>}
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}
