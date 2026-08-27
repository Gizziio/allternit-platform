import React, { useEffect, useState } from 'react';

/**
 * AProtocolWordmark — the A:// protocol mark that expands into the full
 * A://TERNIT wordmark (the :// stands in for the "ll" of Allternit).
 * Office surface copy — adds an optional pixel-letter `suffix` (e.g. "OFFICE")
 * rendered on the same grid so product names match the wordmark style.
 *
 * Pixel-construct geometry shared with the brand assets in
 * public/brand/a-protocol/: 10-unit cells, 8.5 blocks, rx 1.5.
 * The A:// mark occupies cols 0–14, letters run at pitch 6 from col 16.
 *
 * Behavior mirrors the Anthropic logotype → logomark collapse: pass
 * `collapsed` (e.g. from `useScrollCollapse`) and the letters cascade away
 * letter-by-letter while the container clips down to the A:// mark.
 */

const CELL = 10;
const BLOCK = 8.5;
const OFF = (CELL - BLOCK) / 2; // 0.75
const MARK_COLS = 15;
const TERNIT_START = 16;
const PITCH = 6;
const SPACE_COLS = 3;
const ROWS = 5;

// A:// mark — apex, shoulders, crossbar row, legs; colon; two staircase slashes.
const MARK_CELLS: ReadonlyArray<readonly [number, number]> = [
  [2, 0],
  [1, 1], [3, 1],
  [0, 2], [1, 2], [3, 2], [4, 2],
  [0, 3], [4, 3],
  [0, 4], [4, 4],
  [6, 1], [6, 3],
  [8, 3], [8, 4], [9, 2], [10, 0], [10, 1],
  [12, 3], [12, 4], [13, 2], [14, 0], [14, 1],
];
const CORE_CELL: readonly [number, number] = [2, 2];

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
  /** true = show only the A:// mark; false = full wordmark */
  collapsed?: boolean;
  /** rendered height in px */
  height?: number;
  /** extra pixel-letter word after TERNIT (e.g. "OFFICE") */
  suffix?: string;
  /** ink = dark on light bg, light = cream on dark bg, mono = currentColor,
   *  adaptive = currentColor ink with coral core (follows the host theme) */
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
  const core = theme === 'mono' ? 'currentColor' : '#D97757';

  const { letters, totalCols } = layout(`TERNIT ${suffix}`.trimEnd());
  const fullW = (height * totalCols) / ROWS;
  const markW = (height * MARK_COLS) / ROWS;

  return (
    <span
      className={className}
      aria-label={`Allternit ${suffix}`.trim()}
      role="img"
      style={{
        display: 'inline-block',
        overflow: 'hidden',
        height,
        width: collapsed ? markW : fullW,
        transition: `width 500ms ${EASE}`,
        verticalAlign: 'middle',
      }}
    >
      <svg
        viewBox={`0 0 ${totalCols * CELL} ${ROWS * CELL}`}
        width={fullW}
        height={height}
        style={{ display: 'block' }}
        shapeRendering="geometricPrecision"
      >
        {/* A:// protocol mark — always visible */}
        <g fill={ink}>
          {MARK_CELLS.map(([cx, cy]) => (
            <rect
              key={`m-${cx}-${cy}`}
              x={cx * CELL + OFF}
              y={cy * CELL + OFF}
              width={BLOCK}
              height={BLOCK}
              rx={1.5}
            />
          ))}
        </g>
        <rect
          x={CORE_CELL[0] * CELL + OFF}
          y={CORE_CELL[1] * CELL + OFF}
          width={BLOCK}
          height={BLOCK}
          rx={1.5}
          fill={core}
        />
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
 * collapsed to the A:// mark once scrolled past `threshold` px.
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
