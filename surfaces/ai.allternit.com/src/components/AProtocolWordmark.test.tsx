import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { AProtocolWordmark } from './AProtocolWordmark';

// Every letter used by a shipped product suffix must exist in the pixel
// glyph map. A missing glyph used to be silently dropped (and collapsed the
// word) — "DESIGN" rendered as "DESIN".
describe('AProtocolWordmark glyphs', () => {
  it.each([
    ['OFFICE', 6],
    ['DESIGN', 6],
  ])('renders every letter of suffix "%s"', (suffix, count) => {
    const { container } = render(<AProtocolWordmark suffix={suffix} height={20} />);
    // One <g> per pixel letter (the A:// mark is an <img> outside the svg).
    expect(container.querySelectorAll('svg g')).toHaveLength(6 + count);
  });

  it('advances the grid for unknown letters instead of collapsing the word', () => {
    const { container: known } = render(<AProtocolWordmark suffix="ABC" height={20} />);
    const { container: unknown } = render(<AProtocolWordmark suffix="A?C" height={20} />);
    // "?" has no glyph: C must still start at the same column (gap in the middle).
    const knownSvg = known.querySelector('svg')!;
    const unknownSvg = unknown.querySelector('svg')!;
    expect(unknownSvg.getAttribute('width')).toBe(knownSvg.getAttribute('width'));
    const lastLetterX = (svg: Element) => {
      const rects = [...svg.querySelectorAll('g rect')];
      return Math.max(...rects.map((r) => parseFloat(r.getAttribute('x')!)));
    };
    expect(lastLetterX(unknownSvg)).toBe(lastLetterX(knownSvg));
  });
});
