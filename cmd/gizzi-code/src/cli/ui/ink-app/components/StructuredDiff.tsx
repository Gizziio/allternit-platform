import type { StructuredPatchHunk } from 'diff';
import * as React from 'react';
import { memo } from 'react';
import { useSettings } from '../hooks/useSettings';
import { Box, NoSelect, RawAnsi, useTheme } from '../ink';
import { isFullscreenEnvEnabled } from '../utils/fullscreen';
import sliceAnsi from '../utils/sliceAnsi';
import { expectColorDiff } from './StructuredDiff/colorDiff';
import { StructuredDiffFallback } from './StructuredDiff/Fallback';
type Props = {
  patch: StructuredPatchHunk;
  dim: boolean;
  filePath: string; // File path for language detection
  firstLine: string | null; // First line of file for shebang detection
  fileContent?: string; // Full file content for syntax context (multiline strings, etc.)
  width: number;
  skipHighlighting?: boolean; // Skip syntax highlighting
};

// REPL.tsx renders <Messages> at two disjoint tree positions (transcript
// early-return vs prompt-mode nested in FullscreenLayout), so ctrl+o
// unmounts/remounts the entire message tree and React's memo cache is lost.
// Keep both the NAPI result AND the pre-split gutter/content columns at
// module level so the only work on remount is a WeakMap lookup plus two
// <ink-raw-ansi> leaves — not a fresh syntax highlight, nor N sliceAnsi
// calls + 6N Yoga nodes.
//
// PR #21439 (fullscreen default-on) made gutterWidth>0 the default path,
// reactivating the per-line <DiffLine> branch that PR #20378 had bypassed.
// Caching the split here restores the O(1)-leaves-per-diff invariant.
type CachedRender = {
  lines: string[];
  // Two RawAnsi columns replace what was N DiffLine rows. sliceAnsi work
  // moves from per-remount to cold-cache-only; parseToSpans is eliminated
  // entirely (RawAnsi bypasses Ansi parsing).
  gutterWidth: number;
  gutters: string[] | null;
  contents: string[] | null;
};
const RENDER_CACHE = new WeakMap<StructuredPatchHunk, Map<string, CachedRender>>();

// Gutter width matches the Rust module's layout: marker (1) + space +
// right-aligned line number (max_digits) + space. Depends only on patch
// identity (the WeakMap key), so it's cacheable alongside the NAPI output.
function computeGutterWidth(patch: StructuredPatchHunk): number {
  const maxLineNumber = Math.max(patch.oldStart + patch.oldLines - 1, patch.newStart + patch.newLines - 1, 1);
  return maxLineNumber.toString().length + 3; // marker + 2 padding spaces
}
function renderColorDiff(patch: StructuredPatchHunk, firstLine: string | null, filePath: string, fileContent: string | null, theme: string, width: number, dim: boolean, splitGutter: boolean): CachedRender | null {
  const ColorDiff = expectColorDiff();
  if (!ColorDiff) return null;

  // Defensive: if the gutter would eat the whole render width (narrow
  // terminal), skip the split. Rust already wraps to `width` so the
  // single-column output stays correct; we just lose noSelect. Without
  // this, sliceAnsi(line, gutterWidth) would return empty content and
  // RawAnsi(width<=0) is untested.
  const rawGutterWidth = splitGutter ? computeGutterWidth(patch) : 0;
  const gutterWidth = rawGutterWidth > 0 && rawGutterWidth < width ? rawGutterWidth : 0;
  const key = `${theme}|${width}|${dim ? 1 : 0}|${gutterWidth}|${firstLine ?? ''}|${filePath}`;
  let perHunk = RENDER_CACHE.get(patch);
  const hit = perHunk?.get(key);
  if (hit) return hit;
  // The vendored TS port of color-diff may not implement .render (or may
  // throw on unexpected input); degrade to the fallback renderer instead of
  // crashing the TUI.
  let lines: string[] | null = null;
  try {
    const instance = new ColorDiff(patch, firstLine, filePath, fileContent);
    if (typeof (instance as { render?: unknown }).render === 'function') {
      const rendered = (instance as { render: (t: string, w: number, d: boolean) => unknown }).render(theme, width, dim);
      lines = Array.isArray(rendered) ? (rendered as string[]) : null;
    }
  } catch {
    lines = null;
  }
  if (lines === null) return null;

  // Pre-split the gutter column once (cold-cache). sliceAnsi preserves
  // styles across the cut; the Rust module already pads the gutter to
  // gutterWidth so the narrow RawAnsi column's width matches its cells.
  let gutters: string[] | null = null;
  let contents: string[] | null = null;
  if (gutterWidth > 0) {
    gutters = lines.map(l => sliceAnsi(l, 0, gutterWidth));
    contents = lines.map(l => sliceAnsi(l, gutterWidth));
  }
  const entry: CachedRender = {
    lines,
    gutterWidth,
    gutters,
    contents
  };
  if (!perHunk) {
    perHunk = new Map();
    RENDER_CACHE.set(patch, perHunk);
  }
  // Cap the inner map: width is part of the key, so terminal resize while a
  // diff is visible accumulates a full render copy per distinct width. Four
  // variants (two widths × dim on/off) covers the steady state; beyond that
  // the user is actively resizing and old widths are stale.
  if (perHunk.size >= 4) perHunk.clear();
  perHunk.set(key, entry);
  return entry;
}
export const StructuredDiff = memo(function StructuredDiff({
    patch,
    dim,
    filePath,
    firstLine,
    fileContent,
    width,
    skipHighlighting: t1
}: Props) {
  const skipHighlighting = t1 === undefined ? false : t1;
  const [theme] = useTheme();
  const settings = useSettings();
  const syntaxHighlightingDisabled = settings.syntaxHighlightingDisabled ?? false;
  const safeWidth = Math.max(1, Math.floor(width));
  const splitGutter = isFullscreenEnvEnabled();
  const t2 = skipHighlighting || syntaxHighlightingDisabled ? null : renderColorDiff(patch, firstLine, filePath, fileContent ?? null, theme, safeWidth, dim, splitGutter);

  const cached = t2;
  if (!cached) {
    const t3 = <Box><StructuredDiffFallback patch={patch} dim={dim} width={width} /></Box>;

    return t3;
  }
  const {
    lines,
    gutterWidth,
    gutters,
    contents
  } = cached;
  if (gutterWidth > 0 && gutters && contents) {
    const t3 = <NoSelect fromLeftEdge={true}><RawAnsi lines={gutters} width={gutterWidth} /></NoSelect>;

    const t4 = safeWidth - gutterWidth;
    const t5 = <RawAnsi lines={contents} width={t4} />;

    const t6 = <Box flexDirection="row">{t3}{t5}</Box>;

    return t6;
  }
  const t3 = <Box><RawAnsi lines={lines} width={safeWidth} /></Box>;

  return t3;
});
