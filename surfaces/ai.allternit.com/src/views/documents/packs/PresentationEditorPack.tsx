import React, { useEffect, useMemo, useRef, useState } from 'react';
import { editorPackStorageKey } from '../editor-packs';
import {
  deckToSlides,
  downloadDocumentFile,
  exportDocumentFile,
  getStoredModel,
  setStoredModel,
  slidesToDeck,
  type EditorSlide,
} from '../file-io';
import type { AllternitDeck, Slide, SlideBlock, TextStyle } from '../office-io/types';
import { registerNativeDocumentSurface } from '../document-surface';

const PX_PER_INCH = 96;
const CANVAS_W = 10 * PX_PER_INCH;
const CANVAS_H = 7.5 * PX_PER_INCH;

type InternalBlock = SlideBlock & { __id: string };

function id() {
  return globalThis.crypto?.randomUUID?.() ?? `block-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function ensureBlockIds(deck: AllternitDeck): AllternitDeck {
  return {
    ...deck,
    slides: deck.slides.map((slide) => ({
      ...slide,
      blocks: slide.blocks.map((block) =>
        !(block as InternalBlock).__id ? ({ ...block, __id: id() } as InternalBlock) : block
      ),
    })),
  };
}

function getBlockId(block: SlideBlock): string {
  return (block as InternalBlock).__id ?? '';
}

function slideFromTitleBody(title: string, body: string): Slide {
  return {
    id: id(),
    layout: 'title',
    blocks: [
      { type: 'text', text: title, x: 0.5, y: 0.5, w: 9, h: 1, style: { fontSize: 32, bold: true }, __id: id() } as InternalBlock,
      { type: 'text', text: body, x: 0.5, y: 1.75, w: 9, h: 4.5, style: { fontSize: 16 }, __id: id() } as InternalBlock,
    ],
  };
}

export default function PresentationEditorPack({ documentId, onClose }: { documentId: string; onClose: () => void }) {
  const key = editorPackStorageKey('presentations', documentId);
  const [deck, setDeck] = useState<AllternitDeck>(() => {
    const stored = getStoredModel<AllternitDeck>('presentations', documentId);
    const slides = JSON.parse(localStorage.getItem(key) || '[{"title":"Untitled presentation","body":"Add a clear idea for this slide"}]') as EditorSlide[];
    const initial = ensureBlockIds(stored ?? slidesToDeck(slides, 'Untitled presentation'));
    return initial.slides.length > 0 ? initial : { ...initial, slides: [slideFromTitleBody('Untitled presentation', '')] };
  });
  const [active, setActive] = useState(0);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [drag, setDrag] = useState<{
    blockId: string;
    kind: 'move' | 'resize';
    handle?: 'se' | 'sw' | 'ne' | 'nw';
    startX: number;
    startY: number;
    startBlock: InternalBlock;
  } | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const activeSlide = deck.slides[active];

  useEffect(() => {
    setStoredModel('presentations', documentId, deck);
    localStorage.setItem(key, JSON.stringify(deckToSlides(deck)));
  }, [deck, documentId, key]);

  useEffect(
    () =>
      registerNativeDocumentSurface({
        id: documentId,
        kind: 'presentations',
        snapshot: () => ({
          surfaceId: documentId,
          kind: 'presentations',
          title: deck.title,
          revision,
          content: { slides: deckToSlides(deck), activeSlide: active },
        }),
        apply: (mutation) => {
          if (mutation.type === 'export-office') {
            return exportDocumentFile('presentations', documentId, mutation.format).then(() => ({
              revision,
              summary: `Exported as ${mutation.format}.`,
            }));
          }

          let summary: string;
          if (mutation.type === 'add-slide') {
            const newSlide = slideFromTitleBody(mutation.title, mutation.body);
            setDeck((current) => ensureBlockIds({ ...current, slides: [...current.slides, newSlide] }));
            summary = 'Added a slide.';
          } else if (mutation.type === 'add-slide-block') {
            const block = mutation.block as SlideBlock;
            setDeck((current) =>
              ensureBlockIds({
                ...current,
                slides: current.slides.map((slide, index) =>
                  index === active ? { ...slide, blocks: [...slide.blocks, block] } : slide
                ),
              })
            );
            summary = `Added block to slide ${active + 1}.`;
          } else if (mutation.type === 'replace-slide') {
            setDeck((current) =>
              ensureBlockIds({
                ...current,
                slides: current.slides.map((slide, index) =>
                  index === mutation.index ? slideFromTitleBody(mutation.title ?? slideTitle(slide), mutation.body ?? '') : slide
                ),
              })
            );
            summary = `Updated slide ${mutation.index + 1}.`;
          } else {
            throw new Error(`Unsupported presentation mutation: ${mutation.type}`);
          }
          setRevision((value) => value + 1);
          return { revision: revision + 1, summary };
        },
      }),
    [active, deck.title, documentId, revision]
  );

  const updateDeck = (updater: (draft: AllternitDeck) => AllternitDeck) => {
    setDeck((current) => ensureBlockIds(updater(current)));
    setRevision((value) => value + 1);
  };

  const updateSlide = (updater: (slide: Slide) => Slide) => {
    updateDeck((current) => ({
      ...current,
      slides: current.slides.map((slide, index) => (index === active ? updater(slide) : slide)),
    }));
  };

  const updateBlock = (blockId: string, updater: (block: InternalBlock) => InternalBlock) => {
    updateSlide((slide) => ({
      ...slide,
      blocks: slide.blocks.map((block) => (getBlockId(block) === blockId ? updater(block as InternalBlock) : block)),
    }));
  };

  const addTextBox = () => {
    const newBlock: InternalBlock = {
      type: 'text',
      text: 'New text box',
      x: 1,
      y: 2,
      w: 4,
      h: 1,
      style: { fontSize: 18 },
      __id: id(),
    };
    updateSlide((slide) => ({ ...slide, blocks: [...slide.blocks, newBlock] }));
    setSelectedBlockId(getBlockId(newBlock));
  };

  const addImage = () => {
    const src = window.prompt('Image URL');
    if (!src) return;
    const newBlock: InternalBlock = {
      type: 'image',
      src,
      x: 1,
      y: 2,
      w: 4,
      h: 3,
      __id: id(),
    };
    updateSlide((slide) => ({ ...slide, blocks: [...slide.blocks, newBlock] }));
    setSelectedBlockId(getBlockId(newBlock));
  };

  const deleteSelected = () => {
    if (!selectedBlockId) return;
    updateSlide((slide) => ({ ...slide, blocks: slide.blocks.filter((block) => getBlockId(block) !== selectedBlockId) }));
    setSelectedBlockId(null);
  };

  const deleteActiveSlide = () => {
    if (deck.slides.length <= 1) return;
    updateDeck((current) => ({ ...current, slides: current.slides.filter((_, index) => index !== active) }));
    setActive((current) => Math.max(0, current - 1));
    setSelectedBlockId(null);
  };

  const moveActiveSlide = (delta: number) => {
    const newIndex = active + delta;
    if (newIndex < 0 || newIndex >= deck.slides.length) return;
    updateDeck((current) => {
      const slides = [...current.slides];
      const [moved] = slides.splice(active, 1);
      slides.splice(newIndex, 0, moved);
      return { ...current, slides };
    });
    setActive(newIndex);
  };

  const selectedBlock = useMemo(
    () => activeSlide?.blocks.find((b) => getBlockId(b) === selectedBlockId) as InternalBlock | undefined,
    [activeSlide, selectedBlockId]
  );

  const slidesRecord = useMemo(() => deckToSlides(deck), [deck]);

  const addSlide = () => {
    const newSlide = slideFromTitleBody('New slide', '');
    setDeck((current) => ensureBlockIds({ ...current, slides: [...current.slides, newSlide] }));
    setActive((current) => current + 1);
    setSelectedBlockId(null);
  };

  const handleBlockMouseDown = (e: React.MouseEvent, block: InternalBlock) => {
    e.stopPropagation();
    setSelectedBlockId(getBlockId(block));
    if (e.button !== 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    setDrag({
      blockId: getBlockId(block),
      kind: 'move',
      startX: e.clientX - rect.left,
      startY: e.clientY - rect.top,
      startBlock: block,
    });
  };

  const handleResizeMouseDown = (e: React.MouseEvent, block: InternalBlock, handle: 'se' | 'sw' | 'ne' | 'nw') => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedBlockId(getBlockId(block));
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    setDrag({
      blockId: getBlockId(block),
      kind: 'resize',
      handle,
      startX: e.clientX - rect.left,
      startY: e.clientY - rect.top,
      startBlock: block,
    });
  };

  useEffect(() => {
    if (!drag) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    const handleMove = (e: MouseEvent) => {
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const dxInches = (x - drag.startX) / PX_PER_INCH;
      const dyInches = (y - drag.startY) / PX_PER_INCH;

      if (drag.kind === 'move') {
        updateBlock(drag.blockId, (block) => ({
          ...block,
          x: Math.max(0, Math.min(10 - block.w, drag.startBlock.x + dxInches)),
          y: Math.max(0, Math.min(7.5 - block.h, drag.startBlock.y + dyInches)),
        }));
      } else {
        const { handle = 'se' } = drag;
        updateBlock(drag.blockId, (block) => {
          let next = { ...block };
          if (handle.includes('e')) {
            next.w = Math.max(0.5, drag.startBlock.w + dxInches);
          }
          if (handle.includes('s')) {
            next.h = Math.max(0.5, drag.startBlock.h + dyInches);
          }
          if (handle.includes('w')) {
            const newW = Math.max(0.5, drag.startBlock.w - dxInches);
            next.x = drag.startBlock.x + drag.startBlock.w - newW;
            next.w = newW;
          }
          if (handle.includes('n')) {
            const newH = Math.max(0.5, drag.startBlock.h - dyInches);
            next.y = drag.startBlock.y + drag.startBlock.h - newH;
            next.h = newH;
          }
          return next;
        });
      }
    };

    const handleUp = () => setDrag(null);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [drag]);

  const renderResizeHandles = (block: InternalBlock) => {
    const handles: Array<{ pos: 'se' | 'sw' | 'ne' | 'nw'; style: React.CSSProperties }> = [
      { pos: 'nw', style: { top: -4, left: -4 } },
      { pos: 'ne', style: { top: -4, right: -4 } },
      { pos: 'sw', style: { bottom: -4, left: -4 } },
      { pos: 'se', style: { bottom: -4, right: -4 } },
    ];
    return handles.map((h) => (
      <div
        key={h.pos}
        onMouseDown={(e) => handleResizeMouseDown(e, block, h.pos)}
        className="absolute size-2 rounded-full border border-white bg-orange-500"
        style={h.style}
      />
    ));
  };

  return (
    <div className="flex h-full flex-col bg-[var(--bg-primary)]">
      <header className="flex items-center gap-3 border-b border-[var(--border-subtle)] px-5 py-3">
        <button type="button" onClick={onClose} className="text-xs text-[var(--text-secondary)]">
          ← Documents
        </button>
        <input
          value={deck.title}
          onChange={(e) => updateDeck((current) => ({ ...current, title: e.target.value }))}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
        />
        <button
          type="button"
          onClick={() => void exportDocumentFile('presentations', documentId, 'pptx')}
          className="rounded border border-[var(--border-subtle)] px-2 py-1 text-[10px] font-semibold"
        >
          Save as .pptx
        </button>
        <button
          type="button"
          onClick={() => downloadDocumentFile(`${deck.title || 'presentation'}.altdeck`, JSON.stringify(slidesRecord, null, 2), 'application/json')}
          className="rounded border border-[var(--border-subtle)] px-2 py-1 text-[10px] font-semibold"
        >
          Export deck
        </button>
        <button type="button" onClick={addSlide} className="rounded bg-orange-600 px-3 py-1 text-xs font-semibold text-white">
          Add slide
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border-subtle)] px-5 py-2">
        <button
          type="button"
          onClick={addTextBox}
          className="rounded border border-[var(--border-subtle)] px-2 py-1 text-[10px] font-semibold"
        >
          Add text box
        </button>
        <button
          type="button"
          onClick={addImage}
          className="rounded border border-[var(--border-subtle)] px-2 py-1 text-[10px] font-semibold"
        >
          Add image
        </button>
        <button
          type="button"
          onClick={deleteSelected}
          disabled={!selectedBlockId}
          className="rounded border border-[var(--border-subtle)] px-2 py-1 text-[10px] font-semibold disabled:opacity-40"
        >
          Delete box
        </button>
        <button
          type="button"
          onClick={deleteActiveSlide}
          disabled={deck.slides.length <= 1}
          className="rounded border border-[var(--border-subtle)] px-2 py-1 text-[10px] font-semibold disabled:opacity-40"
        >
          Delete slide
        </button>
        <button
          type="button"
          onClick={() => moveActiveSlide(-1)}
          disabled={active === 0}
          className="rounded border border-[var(--border-subtle)] px-2 py-1 text-[10px] font-semibold disabled:opacity-40"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={() => moveActiveSlide(1)}
          disabled={active === deck.slides.length - 1}
          className="rounded border border-[var(--border-subtle)] px-2 py-1 text-[10px] font-semibold disabled:opacity-40"
        >
          ↓
        </button>
        {selectedBlock?.type === 'text' && (
          <>
            <button
              type="button"
              onClick={() => {
                updateBlock(getBlockId(selectedBlock), (block) => {
                  if (block.type !== 'text') return block;
                  return { ...block, style: { ...block.style, bold: !block.style?.bold } };
                });
              }}
              className={`rounded border border-[var(--border-subtle)] px-2 py-1 text-[10px] font-semibold ${selectedBlock.style?.bold ? 'bg-[var(--bg-secondary)]' : ''}`}
            >
              B
            </button>
            <input
              type="number"
              min={8}
              max={120}
              value={selectedBlock.style?.fontSize ?? 16}
              onChange={(e) => {
                updateBlock(getBlockId(selectedBlock), (block) => {
                  if (block.type !== 'text') return block;
                  return { ...block, style: { ...block.style, fontSize: parseInt(e.target.value, 10) || 16 } };
                });
              }}
              className="w-16 rounded border border-[var(--border-subtle)] px-2 py-1 text-[10px]"
            />
            <input
              type="color"
              value={selectedBlock.style?.color || '#000000'}
              onChange={(e) => {
                updateBlock(getBlockId(selectedBlock), (block) => {
                  if (block.type !== 'text') return block;
                  return { ...block, style: { ...block.style, color: e.target.value } };
                });
              }}
              className="size-6 cursor-pointer rounded border border-[var(--border-subtle)]"
            />
            <div className="flex gap-1">
              {(['left', 'center', 'right'] as const).map((align) => (
                <button
                  key={align}
                  type="button"
                  onClick={() => {
                    updateBlock(getBlockId(selectedBlock), (block) => {
                      if (block.type !== 'text') return block;
                      return { ...block, style: { ...block.style, align } };
                    });
                  }}
                  className={selectedBlock.style?.align === align ? 'rounded border border-[var(--border-subtle)] px-2 py-1 text-[10px] font-semibold bg-[var(--bg-secondary)]' : 'rounded border border-[var(--border-subtle)] px-2 py-1 text-[10px] font-semibold'}
                >
                  {align[0].toUpperCase()}
                </button>
              ))}
            </div>
          </>
        )}
        {selectedBlock?.type === 'image' && (
          <input
            type="text"
            value={selectedBlock.src}
            onChange={(e) =>
              updateBlock(getBlockId(selectedBlock), (block) =>
                block.type === 'image' ? ({ ...block, src: e.target.value } as InternalBlock) : block
              )
            }
            placeholder="Image URL"
            className="w-48 rounded border border-[var(--border-subtle)] px-2 py-1 text-[10px]"
          />
        )}
        {selectedBlock && (
          <div className="ml-auto flex items-center gap-1 text-[10px]">
            <label className="text-[var(--text-secondary)]">X</label>
            <input
              type="number"
              step={0.1}
              value={selectedBlock.x}
              onChange={(e) => updateBlock(getBlockId(selectedBlock), (block) => ({ ...block, x: parseFloat(e.target.value) || 0 }))}
              className="w-14 rounded border border-[var(--border-subtle)] px-1 py-1"
            />
            <label className="text-[var(--text-secondary)]">Y</label>
            <input
              type="number"
              step={0.1}
              value={selectedBlock.y}
              onChange={(e) => updateBlock(getBlockId(selectedBlock), (block) => ({ ...block, y: parseFloat(e.target.value) || 0 }))}
              className="w-14 rounded border border-[var(--border-subtle)] px-1 py-1"
            />
            <label className="text-[var(--text-secondary)]">W</label>
            <input
              type="number"
              step={0.1}
              value={selectedBlock.w}
              onChange={(e) => updateBlock(getBlockId(selectedBlock), (block) => ({ ...block, w: parseFloat(e.target.value) || 1 }))}
              className="w-14 rounded border border-[var(--border-subtle)] px-1 py-1"
            />
            <label className="text-[var(--text-secondary)]">H</label>
            <input
              type="number"
              step={0.1}
              value={selectedBlock.h}
              onChange={(e) => updateBlock(getBlockId(selectedBlock), (block) => ({ ...block, h: parseFloat(e.target.value) || 1 }))}
              className="w-14 rounded border border-[var(--border-subtle)] px-1 py-1"
            />
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className="w-48 overflow-auto border-r border-[var(--border-subtle)] p-3">
          {deck.slides.map((slide, index) => (
            <div
              key={slide.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', String(index));
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setDragOverIndex(index);
              }}
              onDragLeave={() => setDragOverIndex(null)}
              onDrop={(e) => {
                e.preventDefault();
                const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
                if (Number.isNaN(fromIndex) || fromIndex === index) {
                  setDragOverIndex(null);
                  return;
                }
                updateDeck((current) => {
                  const slides = [...current.slides];
                  const [moved] = slides.splice(fromIndex, 1);
                  slides.splice(index, 0, moved);
                  return { ...current, slides };
                });
                setActive(index);
                setDragOverIndex(null);
              }}
              onClick={() => {
                setActive(index);
                setSelectedBlockId(null);
              }}
              className={`mb-2 aspect-video w-full cursor-pointer rounded border p-2 text-left text-[10px] ${index === active ? 'border-orange-500' : 'border-[var(--border-subtle)]'} ${dragOverIndex === index ? 'bg-[var(--bg-secondary)]' : ''}`}
              style={{ backgroundColor: slideBackground(slide.background) }}
            >
              <b>
                {index + 1}. {slideTitle(slide)}
              </b>
            </div>
          ))}
        </aside>
        <main className="flex flex-1 items-center justify-center overflow-auto bg-[var(--bg-secondary)] p-8">
          <div
            ref={canvasRef}
            className="relative shadow-xl"
            style={{
              width: CANVAS_W,
              height: CANVAS_H,
              backgroundColor: activeSlide ? slideBackground(activeSlide.background) : '#ffffff',
            }}
            onClick={(e) => {
              if (e.currentTarget === e.target) setSelectedBlockId(null);
            }}
          >
            {activeSlide?.blocks.map((block) => {
              const isSelected = getBlockId(block) === selectedBlockId;
              const baseStyle: React.CSSProperties = {
                left: block.x * PX_PER_INCH,
                top: block.y * PX_PER_INCH,
                width: block.w * PX_PER_INCH,
                height: block.h * PX_PER_INCH,
              };

              if (block.type === 'image') {
                return (
                  <div
                    key={getBlockId(block)}
                    onMouseDown={(e) => handleBlockMouseDown(e, block as InternalBlock)}
                    className={`absolute ${isSelected ? 'ring-2 ring-orange-500' : ''}`}
                    style={baseStyle}
                  >
                    <img
                      src={block.src}
                      alt=""
                      className="pointer-events-none h-full w-full object-contain"
                      draggable={false}
                    />
                    {isSelected && renderResizeHandles(block as InternalBlock)}
                  </div>
                );
              }

              const style: TextStyle = block.style ?? {};
              return (
                <div
                  key={getBlockId(block)}
                  contentEditable
                  suppressContentEditableWarning
                  dangerouslySetInnerHTML={{ __html: escapeHtml(block.text).replace(/\n/g, '<br>') || '<br>' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedBlockId(getBlockId(block));
                  }}
                  onBlur={(e) => {
                    updateBlock(getBlockId(block), (b) => ({ ...b, text: e.currentTarget.innerText }));
                  }}
                  className="absolute overflow-hidden p-2 outline-none"
                  style={{
                    ...baseStyle,
                    fontSize: style.fontSize ?? 16,
                    fontWeight: style.bold ? 'bold' : undefined,
                    color: style.color ?? undefined,
                    textAlign: style.align ?? 'left',
                  }}
                />
              );
            })}
            {selectedBlock?.type === 'text' && (
              <div
                className="absolute"
                style={{
                  left: selectedBlock.x * PX_PER_INCH,
                  top: selectedBlock.y * PX_PER_INCH,
                  width: selectedBlock.w * PX_PER_INCH,
                  height: selectedBlock.h * PX_PER_INCH,
                  pointerEvents: 'none',
                }}
              >
                <div className="pointer-events-none absolute inset-0 ring-2 ring-orange-500" />
                <div
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const canvas = canvasRef.current;
                    if (!canvas) return;
                    const rect = canvas.getBoundingClientRect();
                    setDrag({
                      blockId: getBlockId(selectedBlock),
                      kind: 'move',
                      startX: e.clientX - rect.left,
                      startY: e.clientY - rect.top,
                      startBlock: selectedBlock,
                    });
                  }}
                  className="absolute -top-5 left-1/2 -translate-x-1/2 cursor-move rounded border border-orange-500 bg-white px-1 text-[10px] text-orange-500"
                  style={{ pointerEvents: 'auto' }}
                  title="Move"
                >
                  ⋮⋮
                </div>
                {(['nw', 'ne', 'sw', 'se'] as const).map((pos) => (
                  <div
                    key={pos}
                    onMouseDown={(e) => handleResizeMouseDown(e, selectedBlock, pos)}
                    className="absolute size-2 rounded-full border border-white bg-orange-500"
                    style={{
                      pointerEvents: 'auto',
                      ...(pos.startsWith('n') ? { top: -4 } : { bottom: -4 }),
                      ...(pos.endsWith('w') ? { left: -4 } : { right: -4 }),
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function slideTitle(slide: Slide): string {
  const first = slide.blocks.find((b) => b.type === 'text');
  return first?.type === 'text' ? first.text.split('\n')[0] || 'Untitled' : 'Untitled';
}

function slideBackground(background?: Slide['background']): string {
  if (background?.type === 'color') return background.value;
  return '#ffffff';
}
