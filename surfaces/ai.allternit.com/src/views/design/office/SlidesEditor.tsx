"use client";
import React, { useState, useRef } from 'react';
import { Plus, Trash, DownloadSimple, TextT, Image, Table, CircleNotch, CheckCircle } from '@phosphor-icons/react';

// ── Types ─────────────────────────────────────────────────────────────────────

type BlockType = 'title' | 'body' | 'subtitle' | 'bullet';

interface TextBlock {
  id: string;
  type: BlockType;
  text: string;
  x: number; y: number; w: number; h: number;
}

interface Slide {
  id: string;
  bg: string;
  blocks: TextBlock[];
}

const BG_PRESETS = ['#ffffff', '#f8f7f4', '#1a1a2e', '#0f172a', '#111827', '#fdf4e7'];

function makeId() { return Math.random().toString(36).slice(2, 9); }

function defaultSlide(title: string): Slide {
  return {
    id: makeId(),
    bg: '#ffffff',
    blocks: [
      { id: makeId(), type: 'title',    text: title, x: 8, y: 28, w: 84, h: 20 },
      { id: makeId(), type: 'subtitle', text: 'Click to add a subtitle', x: 8, y: 54, w: 65, h: 12 },
    ],
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SlidesEditor({ projectName }: { projectName: string }) {
  const [slides, setSlides] = useState<Slide[]>([defaultSlide(projectName)]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [editingBlock, setEditingBlock] = useState<string | null>(null);
  const [exportState, setExportState] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const editRef = useRef<HTMLTextAreaElement>(null);

  const activeSlide = slides[activeIdx] ?? slides[0];

  // ── Slide mutations ────────────────────────────────────────────────────────

  function addSlide() {
    const newSlide: Slide = {
      id: makeId(),
      bg: '#ffffff',
      blocks: [
        { id: makeId(), type: 'title', text: 'New slide', x: 8, y: 28, w: 84, h: 18 },
      ],
    };
    setSlides(s => [...s, newSlide]);
    setActiveIdx(slides.length);
    setEditingBlock(null);
  }

  function deleteSlide(idx: number) {
    if (slides.length <= 1) return;
    setSlides(s => s.filter((_, i) => i !== idx));
    setActiveIdx(Math.max(0, idx - 1));
    setEditingBlock(null);
  }

  function updateBlock(slideId: string, blockId: string, text: string) {
    setSlides(s => s.map(sl =>
      sl.id !== slideId ? sl : { ...sl, blocks: sl.blocks.map(b => b.id !== blockId ? b : { ...b, text }) }
    ));
  }

  function addBlock(type: BlockType) {
    const block: TextBlock = {
      id: makeId(), type,
      text: type === 'title' ? 'Title' : type === 'bullet' ? '• Bullet point' : 'Text block',
      x: 8, y: 70, w: 84, h: 12,
    };
    setSlides(s => s.map((sl, i) => i !== activeIdx ? sl : { ...sl, blocks: [...sl.blocks, block] }));
    setEditingBlock(block.id);
  }

  function setBg(bg: string) {
    setSlides(s => s.map((sl, i) => i !== activeIdx ? sl : { ...sl, bg }));
  }

  // ── Export via pptxgenjs ───────────────────────────────────────────────────

  async function exportPptx() {
    setExportState('working');
    try {
      const PptxGenJS = (await import(/* webpackIgnore: true */ 'pptxgenjs')).default;
      const pptx = new PptxGenJS();
      pptx.title = projectName;
      pptx.author = 'Allternit Design';

      for (const slide of slides) {
        const pSlide = pptx.addSlide();

        // Background
        const bg = slide.bg.replace('#', '');
        pSlide.background = { fill: bg.length === 6 ? bg : 'FFFFFF' };

        for (const block of slide.blocks) {
          const isDark = isDarkBg(slide.bg);
          const baseColor = isDark ? 'FFFFFF' : '111111';

          const fontSize = block.type === 'title' ? 28 : block.type === 'subtitle' ? 18 : 14;
          const bold = block.type === 'title';

          pSlide.addText(block.text, {
            x: `${block.x}%`, y: `${block.y}%`,
            w: `${block.w}%`, h: `${block.h}%`,
            fontSize, bold,
            color: baseColor,
            fontFace: 'Allternit Sans',
            wrap: true,
          });
        }
      }

      await pptx.writeFile({ fileName: `${projectName.replace(/\s+/g, '_')}.pptx` });
      setExportState('done');
      setTimeout(() => setExportState('idle'), 3000);
    } catch (err) {
      console.error('[SlidesEditor] export failed', err);
      setExportState('error');
      setTimeout(() => setExportState('idle'), 3000);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%', gap: 0 }}>

      {/* Slide thumbnail strip */}
      <div style={{ width: 130, background: 'var(--bg-primary)', borderRight: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: '10px 8px', gap: 6, flexShrink: 0 }}>
        {slides.map((sl, i) => (
          <div key={sl.id} style={{ position: 'relative' }}>
            <button
              onClick={() => { setActiveIdx(i); setEditingBlock(null); }}
              style={{
                width: '100%', aspectRatio: '16/9', borderRadius: 6, overflow: 'hidden', cursor: 'pointer',
                border: `2px solid ${activeIdx === i ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                background: sl.bg,
                display: 'flex', flexDirection: 'column', padding: 6, textAlign: 'left',
                boxShadow: activeIdx === i ? '0 0 0 3px color-mix(in srgb, var(--accent-primary) 18%, transparent)' : 'none',
                transition: 'all 0.12s',
              }}
            >
              {sl.blocks.slice(0, 2).map(b => (
                <div key={b.id} style={{
                  fontSize: b.type === 'title' ? 7 : 5,
                  fontWeight: b.type === 'title' ? 700 : 400,
                  color: isDarkBg(sl.bg) ? '#fff' : '#111',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  marginBottom: 2,
                }}>{b.text}</div>
              ))}
            </button>
            {slides.length > 1 && (
              <button
                onClick={e => { e.stopPropagation(); deleteSlide(i); }}
                style={{ position: 'absolute', top: 3, right: 3, width: 16, height: 16, borderRadius: 4, background: 'rgba(239,68,68,0.85)', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: 0, transition: 'opacity 0.1s' }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '0'; }}
              >
                <Trash size={9} weight="bold" />
              </button>
            )}
            <div style={{ fontSize: 8, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 2 }}>{i + 1}</div>
          </div>
        ))}
        <button
          onClick={addSlide}
          style={{ width: '100%', aspectRatio: '16/9', borderRadius: 6, border: '1px dashed var(--border-default)', background: 'transparent', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Main canvas */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--surface-hover, rgba(0,0,0,0.04))' }}>
        {/* Toolbar */}
        <div style={{ height: 40, background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 4, marginRight: 8 }}>
            {BG_PRESETS.map(bg => (
              <button key={bg} onClick={() => setBg(bg)} style={{ width: 16, height: 16, borderRadius: 3, background: bg, border: `2px solid ${activeSlide?.bg === bg ? 'var(--accent-primary)' : 'var(--border-default)'}`, cursor: 'pointer' }} title="Slide background" />
            ))}
          </div>
          <div style={{ width: 1, height: 20, background: 'var(--border-subtle)' }} />
          <ToolBtn icon={<TextT size={13} weight="bold" />} label="Add text" onClick={() => addBlock('body')} />
          <ToolBtn icon={<TextT size={13} weight="bold" />} label="Add bullet" onClick={() => addBlock('bullet')} />
          <div style={{ flex: 1 }} />
          <button
            onClick={exportPptx}
            disabled={exportState === 'working'}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 8, border: 'none', background: exportState === 'done' ? '#22c55e' : exportState === 'error' ? 'var(--surface-hover)' : 'var(--accent-primary)', color: exportState === 'error' ? 'var(--text-secondary)' : '#fff', fontSize: 11, fontWeight: 700, cursor: exportState === 'working' ? 'default' : 'pointer', opacity: exportState === 'working' ? 0.7 : 1 }}
          >
            {exportState === 'working' && <CircleNotch size={12} style={{ animation: 'spin 1s linear infinite' }} />}
            {exportState === 'done' && <CheckCircle size={12} weight="fill" />}
            {(exportState === 'idle' || exportState === 'error') && <DownloadSimple size={12} weight="bold" />}
            {exportState === 'working' ? 'Exporting…' : exportState === 'done' ? 'Saved!' : exportState === 'error' ? 'Export failed' : 'Export .pptx'}
          </button>
        </div>

        {/* Slide canvas */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, overflow: 'hidden' }}>
          <div
            style={{
              width: '100%', maxWidth: 800, aspectRatio: '16/9',
              background: activeSlide?.bg ?? '#fff',
              borderRadius: 4, boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
              position: 'relative', overflow: 'hidden',
            }}
            onClick={() => setEditingBlock(null)}
          >
            {/* Slide number */}
            <div style={{ position: 'absolute', bottom: 8, right: 12, fontSize: 9, color: isDarkBg(activeSlide?.bg) ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)', fontWeight: 600 }}>
              {activeIdx + 1} / {slides.length}
            </div>

            {activeSlide?.blocks.map(block => (
              <div
                key={block.id}
                style={{
                  position: 'absolute',
                  left: `${block.x}%`, top: `${block.y}%`,
                  width: `${block.w}%`,
                  outline: editingBlock === block.id ? '2px solid var(--accent-primary)' : '1px dashed transparent',
                  borderRadius: 3, padding: '2px 4px', cursor: 'text',
                  minHeight: `${block.h}%`,
                }}
                onClick={e => { e.stopPropagation(); setEditingBlock(block.id); setTimeout(() => editRef.current?.focus(), 30); }}
              >
                {editingBlock === block.id ? (
                  <textarea
                    ref={editRef}
                    value={block.text}
                    onChange={e => updateBlock(activeSlide.id, block.id, e.target.value)}
                    onBlur={() => setEditingBlock(null)}
                    style={{
                      width: '100%', background: 'transparent', border: 'none', outline: 'none', resize: 'none',
                      fontSize: block.type === 'title' ? 'clamp(18px, 4.5vw, 36px)' : block.type === 'subtitle' ? 'clamp(12px, 2.2vw, 20px)' : 'clamp(10px, 1.8vw, 16px)',
                      fontWeight: block.type === 'title' ? 800 : block.type === 'subtitle' ? 400 : 400,
                      color: isDarkBg(activeSlide.bg) ? '#fff' : '#111',
                      lineHeight: 1.25, fontFamily: 'inherit', overflow: 'hidden',
                    }}
                    rows={block.type === 'title' ? 2 : 3}
                  />
                ) : (
                  <div style={{
                    fontSize: block.type === 'title' ? 'clamp(18px, 4.5vw, 36px)' : block.type === 'subtitle' ? 'clamp(12px, 2.2vw, 20px)' : 'clamp(10px, 1.8vw, 16px)',
                    fontWeight: block.type === 'title' ? 800 : 400,
                    color: isDarkBg(activeSlide.bg) ? (block.text === 'Click to add a subtitle' ? 'rgba(255,255,255,0.4)' : '#fff') : (block.text === 'Click to add a subtitle' ? 'rgba(0,0,0,0.3)' : '#111'),
                    lineHeight: 1.25, letterSpacing: block.type === 'title' ? '-0.02em' : 'normal',
                    fontStyle: block.text.includes('Click to add') ? 'italic' : 'normal',
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  }}>
                    {block.text}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isDarkBg(hex: string): boolean {
  if (!hex || !hex.startsWith('#')) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}

function ToolBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={label}
      style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.1s' }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-hover, rgba(0,0,0,0.06))'; e.currentTarget.style.color = 'var(--text-primary)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
    >
      {icon}
    </button>
  );
}
