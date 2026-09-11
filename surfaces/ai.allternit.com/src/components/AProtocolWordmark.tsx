import React, { useEffect, useState } from 'react';

/**
 * AProtocolWordmark — the pixel-A brand mark followed by the full A://TERNIT
 * wordmark (the :// stands in for the "ll" of Allternit). Office surface copy
 * adds an optional pixel-letter `suffix` (e.g. "OFFICE") rendered on the same
 * grid so product names match the wordmark style.
 *
 * The mark itself is the canonical cream squircle PNG
 * (public/brand/a-only-cream-squircle.png) — the same asset used for favicons
 * and app icons. Only the TERNIT/suffix letters are still drawn as pixel
 * blocks: 10-unit cells, 8.5 blocks, rx 1.5, running at pitch 6.
 *
 * Behavior mirrors the Anthropic logotype → logomark collapse: pass
 * `collapsed` (e.g. from `useScrollCollapse`) and the letters cascade away
 * letter-by-letter while the container clips down to the mark.
 */

const CELL = 10;
const BLOCK = 8.5;
const OFF = (CELL - BLOCK) / 2; // 0.75
const TERNIT_START = 16;
const PITCH = 6;
const SPACE_COLS = 3;
const ROWS = 5;

// Pixel letterforms, 5x5 cell maps (x, y) relative to each letter's origin col.
const GLYPHS: Record<string, ReadonlyArray<readonly [number, number]>> = {
  T: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [2, 1], [2, 2], [2, 3], [2, 4]],
  E: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [0, 1], [0, 2], [1, 2], [2, 2], [3, 2], [0, 3], [0, 4], [1, 4], [2, 4], [3, 4], [4, 4]],
  R: [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [4, 1], [0, 2], [1, 2], [2, 2], [3, 2], [0, 3], [2, 3], [0, 4], [3, 4], [4, 4]],
  N: [[0, 0], [0, 1], [1, 1], [0, 2], [2, 2], [0, 3], [3, 3], [0, 4], [4, 0], [4, 1], [4, 2], [4, 3], [4, 4]],
  I: [[1, 0], [2, 0], [3, 0], [2, 1], [2, 2], [2, 3], [1, 4], [2, 4], [3, 4]],
  S: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [0, 1], [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [4, 3], [0, 4], [1, 4], [2, 4], [3, 4], [4, 4]],
  U: [[0, 0], [0, 1], [0, 2], [0, 3], [4, 0], [4, 1], [4, 2], [4, 3], [0, 4], [1, 4], [2, 4], [3, 4], [4, 4]],
  D: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 0], [2, 0], [3, 0], [4, 1], [4, 2], [4, 3], [1, 4], [2, 4], [3, 4]],
  O: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [4, 0], [4, 1], [4, 2], [4, 3], [4, 4], [1, 0], [2, 0], [3, 0], [1, 4], [2, 4], [3, 4]],
  L: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 4], [2, 4], [3, 4], [4, 4]],
  A: [[2, 0], [1, 1], [3, 1], [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [0, 3], [4, 3], [0, 4], [4, 4]],
  B: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 0], [2, 0], [3, 0], [4, 1], [1, 2], [2, 2], [3, 2], [4, 3], [1, 4], [2, 4], [3, 4]],
  F: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [0, 1], [0, 2], [1, 2], [2, 2], [3, 2], [0, 3], [0, 4]],
  C: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 4], [2, 4], [3, 4], [4, 4]],
};

const EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';
const EXPAND_STAGGER = 45; // ms per letter when revealing
const COLLAPSE_STAGGER = 30; // ms per letter when hiding (reverse order)

// Mark asset and the gap that used to sit between the A:// mark and TERNIT.
const MARK_SRC = '/brand/a-only-cream-squircle.png';
const MARK_GAP_COLS = TERNIT_START - 15; // one empty column after the mark

interface LetterSpec {
  cells: ReadonlyArray<readonly [number, number]>;
  col: number; // origin column
}

function layout(word: string): { letters: LetterSpec[]; totalCols: number } {
  const letters: LetterSpec[] = [];
  let col = TERNIT_START;
  for (const ch of word.toUpperCase()) {
    if (ch === ' ') {
      col += SPACE_COLS;
      continue;
    }
    const cells = GLYPHS[ch];
    if (!cells) continue;
    letters.push({ cells, col });
    col += PITCH;
  }
  return { letters, totalCols: col - 1 };
}

export interface AProtocolWordmarkProps {
  /** true = show only the pixel-A mark; false = full wordmark */
  collapsed?: boolean;
  /** rendered height in px */
  height?: number;
  /** extra pixel-letter word after TERNIT (e.g. "OFFICE") */
  suffix?: string;
  /** ink = dark letters on light bg, light = cream letters on dark bg,
   *  mono = currentColor letters, adaptive = currentColor ink (follows the
   *  host theme). The mark image is a fixed cream squircle in all themes. */
  theme?: 'ink' | 'light' | 'mono' | 'adaptive';
  className?: string;
}

export function AProtocolWordmark({
  collapsed = false,
  height = 20,
  suffix = '',
  theme = 'ink',
  className,
}: AProtocolWordmarkProps) {
  const ink = theme === 'light' ? '#F0EEE6'
    : theme === 'mono' || theme === 'adaptive' ? 'currentColor'
    : '#141413';

  const { letters, totalCols } = layout(`TERNIT ${suffix}`.trimEnd());
  const letterCols = totalCols - TERNIT_START;
  const lettersW = (height * letterCols) / ROWS;
  const gap = (height * MARK_GAP_COLS) / ROWS;
  // The mark is a 1:1 squircle, so it is sized by height like the old SVG mark.
  const markW = height;
  const fullW = markW + gap + lettersW;

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        overflow: 'hidden',
        height,
        width: collapsed ? markW : fullW,
        transition: `width 500ms ${EASE}`,
        verticalAlign: 'middle',
      }}
    >
      <img
        src={MARK_SRC}
        alt="Allternit"
        width={height}
        height={height}
        style={{ display: 'block', borderRadius: '22%' }}
      />
      <svg
        viewBox={`${TERNIT_START * CELL} 0 ${letterCols * CELL} ${ROWS * CELL}`}
        width={lettersW}
        height={height}
        style={{ display: 'block', marginLeft: gap, flexShrink: 0 }}
        shapeRendering="geometricPrecision"
        aria-hidden="true"
      >
        {/* Letters — cascade in left-to-right on expand, out right-to-left on collapse */}
        {letters.map((letter, i) => (
          <g
            key={i}
            fill={ink}
            style={{
              opacity: collapsed ? 0 : 1,
              transform: collapsed ? 'translateX(-12px)' : 'translateX(0)',
              transition: `opacity 240ms ${EASE}, transform 400ms ${EASE}`,
              transitionDelay: `${collapsed
                ? (letters.length - 1 - i) * COLLAPSE_STAGGER
                : 120 + i * EXPAND_STAGGER}ms`,
            }}
          >
            {letter.cells.map(([cx, cy]) => (
              <rect
                key={`l${i}-${cx}-${cy}`}
                x={(letter.col + cx) * CELL + OFF}
                y={cy * CELL + OFF}
                width={BLOCK}
                height={BLOCK}
                rx={1.5}
              />
            ))}
          </g>
        ))}
      </svg>
    </span>
  );
}

/**
 * Anthropic-style scroll trigger: full wordmark at the top of the page,
 * collapsed to the pixel-A mark once scrolled past `threshold` px.
 */
export function useScrollCollapse(threshold = 24): boolean {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const onScroll = () => setCollapsed(window.scrollY > threshold);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);
  return collapsed;
}
