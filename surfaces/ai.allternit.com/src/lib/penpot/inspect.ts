import type {
  PenpotShape, PenpotFill, PenpotStroke, PenpotShadow,
  PenpotText, PenpotFrame,
} from './schema';

export interface InspectResult {
  css: Record<string, string>;
  cssString: string;
  variables: Record<string, string>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function hexWithAlpha(hex: string, opacity?: number | null): string {
  if (!hex) return 'transparent';
  const op = opacity ?? 1;
  if (op >= 1) return hex;
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${op})`;
}

function gradientAngle(g: { startX: number; startY: number; endX: number; endY: number }): number {
  const dx = g.endX - g.startX;
  const dy = g.endY - g.startY;
  const rad = Math.atan2(dy, dx);
  return Math.round((rad * 180) / Math.PI + 90);
}

function gradientStops(stops: { color: string; opacity: number; offset: number }[]): string {
  return stops
    .map(s => `${hexWithAlpha(s.color, s.opacity)} ${Math.round(s.offset * 100)}%`)
    .join(', ');
}

export function formatCSSBlock(selector: string, props: Record<string, string>): string {
  const lines = Object.entries(props).map(([k, v]) => `  ${k}: ${v};`).join('\n');
  return `.${selector} {\n${lines}\n}`;
}

// ─── Fill → background ────────────────────────────────────────────────────────

function fillsToCSS(fills: PenpotFill[]): string | null {
  if (!fills?.length) return null;
  const fill = fills[0];
  if (!fill) return null;

  if (fill.fillType === 'linear' && fill.fillColorGradient) {
    const g = fill.fillColorGradient;
    return `linear-gradient(${gradientAngle(g)}deg, ${gradientStops(g.stops)})`;
  }
  if (fill.fillType === 'radial' && fill.fillColorGradient) {
    const g = fill.fillColorGradient;
    return `radial-gradient(${gradientStops(g.stops)})`;
  }
  if (fill.fillColor) {
    return hexWithAlpha(fill.fillColor, fill.fillOpacity);
  }
  return null;
}

// ─── Stroke → border / outline / box-shadow ───────────────────────────────────

function strokeToCSS(stroke: PenpotStroke, css: Record<string, string>): void {
  if (!stroke.strokeColor) return;
  const color = hexWithAlpha(stroke.strokeColor, stroke.strokeOpacity);
  const width = stroke.strokeWidth ?? 1;
  const style = stroke.strokeStyle ?? 'solid';

  if (stroke.strokeAlignment === 'inner') {
    css['box-shadow'] = `inset 0 0 0 ${width}px ${color}`;
  } else if (stroke.strokeAlignment === 'outer') {
    css['outline'] = `${width}px ${style} ${color}`;
  } else {
    css['border'] = `${width}px ${style} ${color}`;
  }
}

// ─── Shadow → box-shadow ──────────────────────────────────────────────────────

function shadowsToCSS(shadows: PenpotShadow[]): string | null {
  const visible = shadows?.filter(s => !s.hidden);
  if (!visible?.length) return null;
  return visible.map(s => {
    const color = s.color ? hexWithAlpha(s.color.color, s.color.opacity) : 'rgba(0,0,0,0.25)';
    const inset = s.style === 'inner-shadow' ? 'inset ' : '';
    return `${inset}${s.offsetX ?? 0}px ${s.offsetY ?? 0}px ${s.blur ?? 0}px ${s.spread ?? 0}px ${color}`;
  }).join(', ');
}

// ─── Text styles ──────────────────────────────────────────────────────────────

function textToCSS(shape: PenpotText, css: Record<string, string>): void {
  const para = shape.content?.children?.[0];
  const node = para?.children?.[0];
  if (!node) return;
  const s = node.styles ?? {};
  if (s.fontFamily) css['font-family'] = `'${s.fontFamily}', sans-serif`;
  if (s.fontSize) css['font-size'] = s.fontSize.includes('px') ? s.fontSize : `${s.fontSize}px`;
  if (s.fontWeight) css['font-weight'] = s.fontWeight;
  if (s.fontStyle && s.fontStyle !== 'normal') css['font-style'] = s.fontStyle;
  if (s.lineHeight) css['line-height'] = s.lineHeight;
  if (s.letterSpacing) css['letter-spacing'] = s.letterSpacing.includes('px') ? s.letterSpacing : `${s.letterSpacing}px`;
  if (s.textDecoration && s.textDecoration !== 'none') css['text-decoration'] = s.textDecoration;
  if (s.textTransform && s.textTransform !== 'none') css['text-transform'] = s.textTransform;
  if (para?.align && para.align !== 'left') css['text-align'] = para.align;
  const fill = s.fills?.[0];
  if (fill?.fillColor) css['color'] = hexWithAlpha(fill.fillColor, fill.fillOpacity);
}

// ─── Flex layout (frame) ──────────────────────────────────────────────────────

function layoutToCSS(frame: PenpotFrame, css: Record<string, string>): void {
  const l = frame.layout;
  if (!l?.layoutType) return;
  css['display'] = l.layoutType; // 'flex' | 'grid'
  if (l.layoutFlexDir) css['flex-direction'] = l.layoutFlexDir;
  if (l.layoutAlignItems) css['align-items'] = l.layoutAlignItems;
  if (l.layoutJustifyContent) css['justify-content'] = l.layoutJustifyContent;
  if (l.layoutWrap) css['flex-wrap'] = l.layoutWrap;
  if (l.layoutGap) css['gap'] = `${l.layoutGap.rowGap}px ${l.layoutGap.columnGap}px`;
  if (l.layoutPadding) {
    const { top, right, bottom, left } = l.layoutPadding;
    css['padding'] = `${top}px ${right}px ${bottom}px ${left}px`;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function inspectShape(shape: PenpotShape): InspectResult {
  const css: Record<string, string> = {};

  // Geometry
  css['width'] = `${shape.width}px`;
  css['height'] = `${shape.height}px`;
  if (shape.rotation) css['transform'] = `rotate(${shape.rotation}deg)`;

  // Opacity
  if (shape.opacity != null && shape.opacity !== 1) css['opacity'] = String(shape.opacity);

  // Fills
  const bg = fillsToCSS(shape.fills ?? []);
  if (bg) {
    css[(shape.fills?.[0]?.fillType === 'plain' || !shape.fills?.[0]?.fillType)
      ? 'background-color' : 'background'] = bg;
  }

  // Strokes
  if (shape.strokes?.length) strokeToCSS(shape.strokes[0], css);

  // Shadows
  const boxShadow = shadowsToCSS(shape.shadows ?? []);
  if (boxShadow) {
    css['box-shadow'] = css['box-shadow']
      ? `${css['box-shadow']}, ${boxShadow}`
      : boxShadow;
  }

  // Blur
  if (shape.blur && !shape.blur.hidden && shape.blur.value) {
    css['filter'] = `blur(${shape.blur.value}px)`;
  }

  // Frame / Rect radius + clip
  if (shape.type === 'frame' || shape.type === 'rect') {
    const rx = (shape as PenpotFrame).rx;
    if (rx) css['border-radius'] = `${rx}px`;
    if (shape.type === 'frame' && (shape as PenpotFrame).clipContent) css['overflow'] = 'hidden';
    if (shape.type === 'frame') layoutToCSS(shape as PenpotFrame, css);
  }

  // Text
  if (shape.type === 'text') textToCSS(shape as PenpotText, css);

  // Variables (each fill color as a CSS var)
  const variables: Record<string, string> = {};
  (shape.fills ?? []).forEach((f, i) => {
    if (f.fillColor) variables[`--fill-${i}`] = hexWithAlpha(f.fillColor, f.fillOpacity);
  });

  const selectorName = shape.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const cssString = formatCSSBlock(selectorName || 'shape', css);

  return { css, cssString, variables };
}

export function inspectShapeToClipboard(shape: PenpotShape): string {
  return inspectShape(shape).cssString;
}
