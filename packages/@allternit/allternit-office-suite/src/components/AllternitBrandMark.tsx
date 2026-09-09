import type { ReactNode } from 'react';

/**
 * AllternitBrandMark — the Allternit pixel-A brand mark (the matrix
 * construct from surfaces/ai.allternit.com/public/favicon.svg), self-contained
 * so hosts (platform, standalone office surface, desktop) render the real
 * brand without depending on the platform surface's component tree.
 *
 * Geometry matches the 100x100 construct mark: 14x14 rounded cells on an
 * 18-unit pitch, coral core cell at the crossbar. `tone` follows the same
 * convention as the platform's AProtocolWordmark: adaptive inks with
 * currentColor (coral core), light = cream on dark, dark = near-black.
 */

const CELLS: ReadonlyArray<readonly [number, number]> = [
  [43, 7],
  [25, 25], [61, 25],
  [7, 43], [25, 43], [61, 43], [79, 43],
  [7, 61], [79, 61],
  [7, 79], [79, 79],
];
const CORE: readonly [number, number] = [43, 43];

export interface AllternitBrandMarkProps {
  size?: number;
  /** adaptive = currentColor ink + coral core (follows the host theme). */
  tone?: 'adaptive' | 'light' | 'dark';
  className?: string;
}

export function AllternitBrandMark({
  size = 16,
  tone = 'adaptive',
  className,
}: AllternitBrandMarkProps): ReactNode {
  const ink = tone === 'light' ? '#F0EEE6' : tone === 'dark' ? '#141413' : 'currentColor';
  const core = '#D97757';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={className}
      shapeRendering="geometricPrecision"
    >
      <g fill={ink}>
        {CELLS.map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="14" height="14" rx="2" />
        ))}
      </g>
      <rect x={CORE[0]} y={CORE[1]} width="14" height="14" rx="2" fill={core} />
    </svg>
  );
}

export default AllternitBrandMark;
