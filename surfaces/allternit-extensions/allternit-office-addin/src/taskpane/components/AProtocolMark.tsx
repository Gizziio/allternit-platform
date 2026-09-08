/**
 * AProtocolMark — package-local port of the A:// protocol wordmark
 * (geometry shared with surfaces/ai.allternit.com/src/components/AProtocolWordmark.tsx
 * and the brand assets in public/brand/a-protocol/): 10-unit cells, 8.5
 * blocks, rx 1.5. The A:// mark occupies cols 0–14; pixel letters run at
 * pitch 6 from col 16. The core block renders in Allternit coral (#D97757).
 *
 * Rendered as a single inline SVG — no font or image assets, so the pane
 * stays light in an Office iframe.
 */

const CELL = 10
const BLOCK = 8.5
const OFF = (CELL - BLOCK) / 2 // 0.75
const TERNIT_START = 16
const PITCH = 6
const SPACE_COLS = 3
const ROWS = 5

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
]
const CORE_CELL: readonly [number, number] = [2, 2]

// Pixel letterforms, 5x5 cell maps (x, y) relative to each letter's origin col.
const GLYPHS: Record<string, ReadonlyArray<readonly [number, number]>> = {
  T: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [2, 1], [2, 2], [2, 3], [2, 4]],
  E: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [0, 1], [0, 2], [1, 2], [2, 2], [3, 2], [0, 3], [0, 4], [1, 4], [2, 4], [3, 4], [4, 4]],
  R: [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [4, 1], [0, 2], [1, 2], [2, 2], [3, 2], [0, 3], [2, 3], [0, 4], [3, 4], [4, 4]],
  N: [[0, 0], [0, 1], [1, 1], [0, 2], [2, 2], [0, 3], [3, 3], [0, 4], [4, 0], [4, 1], [4, 2], [4, 3], [4, 4]],
  I: [[1, 0], [2, 0], [3, 0], [2, 1], [2, 2], [2, 3], [1, 4], [2, 4], [3, 4]],
  O: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [4, 0], [4, 1], [4, 2], [4, 3], [4, 4], [1, 0], [2, 0], [3, 0], [1, 4], [2, 4], [3, 4]],
  F: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [0, 1], [0, 2], [1, 2], [2, 2], [3, 2], [0, 3], [0, 4]],
  W: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [4, 0], [4, 1], [4, 2], [4, 3], [4, 4], [1, 3], [2, 4], [3, 3]],
  X: [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4], [4, 0], [3, 1], [1, 3], [0, 4]],
  C: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 4], [2, 4], [3, 4], [4, 4]],
}

interface LetterSpec {
  cells: ReadonlyArray<readonly [number, number]>
  col: number
}

function layout(word: string): { letters: LetterSpec[]; totalCols: number } {
  const letters: LetterSpec[] = []
  let col = TERNIT_START
  for (const ch of word.toUpperCase()) {
    if (ch === ' ') {
      col += SPACE_COLS
      continue
    }
    const cells = GLYPHS[ch]
    if (!cells) continue
    letters.push({ cells, col })
    col += PITCH
  }
  return { letters, totalCols: col - 1 }
}

export interface AProtocolMarkProps {
  /** rendered height in px */
  height?: number
  /** extra pixel-letter word after TERNIT (e.g. "OFFICE") */
  suffix?: string
  /** render only the A:// mark (cols 0–14), without the TERNIT wordmark */
  markOnly?: boolean
  /** ink color for the letterforms; defaults to the brand ink */
  ink?: string
  className?: string
}

export function AProtocolMark({
  height = 16,
  suffix = '',
  markOnly = false,
  ink = '#29201A',
  className,
}: AProtocolMarkProps) {
  const core = '#D97757'
  const { letters, totalCols } = layout(markOnly ? '' : `TERNIT ${suffix}`.trimEnd())
  const fullW = (height * totalCols) / ROWS

  return (
    <span
      className={className}
      aria-label={`Allternit ${suffix}`.trim()}
      role="img"
      style={{ display: 'inline-block', height, width: fullW, verticalAlign: 'middle' }}
    >
      <svg
        viewBox={`0 0 ${totalCols * CELL} ${ROWS * CELL}`}
        width={fullW}
        height={height}
        style={{ display: 'block' }}
        shapeRendering="geometricPrecision"
      >
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
        {letters.map((letter, i) => (
          <g key={i} fill={ink}>
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
  )
}
