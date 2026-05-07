/**
 * Extracted design tokens from the live canvas.
 *
 * DesignTldrawCanvas writes here whenever shapes change.
 * DesignSystemView reads here to show canvas-derived tokens.
 */

import { create } from 'zustand';

export interface DesignToken {
  category: 'color' | 'radius' | 'opacity' | 'shadow';
  name: string;    // human label, e.g. "Frame fill" or "Component #3b82f6"
  value: string;   // CSS value
  rawValue: string; // the raw hex / number
  count: number;   // number of shapes using this value
  shapeName: string; // first shape that produced it
}

interface DesignCanvasState {
  tokens: DesignToken[];
  shapeCount: number;
  setTokens: (tokens: DesignToken[], shapeCount: number) => void;
}

export const useDesignCanvasStore = create<DesignCanvasState>((set) => ({
  tokens: [],
  shapeCount: 0,
  setTokens: (tokens, shapeCount) => set({ tokens, shapeCount }),
}));

// ─── Extraction ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractTokensFromShapes(shapes: any[]): DesignToken[] {
  const colorMap = new Map<string, { count: number; shapeName: string; name: string }>();
  const radiusMap = new Map<number, { count: number; shapeName: string }>();
  const shadowMap = new Map<string, { count: number; shapeName: string }>();

  for (const shape of shapes) {
    const props = shape.props;
    if (!props) continue;
    const label: string = props.label ?? props.variant ?? shape.id;

    // Fill colors
    const fills: any[] = props.fills ?? [];
    for (const fill of fills) {
      if (fill?.fillColor) {
        const hex: string = fill.fillColor;
        const existing = colorMap.get(hex);
        if (existing) {
          existing.count++;
        } else {
          colorMap.set(hex, { count: 1, shapeName: label, name: label });
        }
      }
    }

    // Border-radius
    if (props.rx != null && props.rx > 0) {
      const rx: number = props.rx;
      const existing = radiusMap.get(rx);
      if (existing) existing.count++;
      else radiusMap.set(rx, { count: 1, shapeName: label });
    }

    // Shadows
    const shadows: any[] = props.shadows ?? [];
    for (const shadow of shadows) {
      if (!shadow?.hidden && shadow?.color?.opacity > 0) {
        const key = `${shadow.offsetX ?? 0}px ${shadow.offsetY ?? 4}px ${shadow.blur ?? 8}px`;
        const existing = shadowMap.get(key);
        if (existing) existing.count++;
        else shadowMap.set(key, { count: 1, shapeName: label });
      }
    }
  }

  const tokens: DesignToken[] = [];

  // Deduplicated colors — sorted by usage count desc
  const sortedColors = [...colorMap.entries()].sort((a, b) => b[1].count - a[1].count);
  sortedColors.forEach(([hex, meta], i) => {
    tokens.push({
      category: 'color',
      name: i === 0 ? 'Primary fill' : meta.name,
      value: hex,
      rawValue: hex,
      count: meta.count,
      shapeName: meta.shapeName,
    });
  });

  // Radii — sorted asc
  [...radiusMap.entries()].sort((a, b) => a[0] - b[0]).forEach(([px, meta]) => {
    tokens.push({
      category: 'radius',
      name: `radius-${px}`,
      value: `${px}px`,
      rawValue: String(px),
      count: meta.count,
      shapeName: meta.shapeName,
    });
  });

  // Shadows
  [...shadowMap.entries()].forEach(([key, meta]) => {
    tokens.push({
      category: 'shadow',
      name: 'drop-shadow',
      value: key,
      rawValue: key,
      count: meta.count,
      shapeName: meta.shapeName,
    });
  });

  return tokens;
}

// ─── W3C DTCG tokens.json export ─────────────────────────────────────────────

export function tokensToJSON(tokens: DesignToken[], projectName: string): string {
  const output: Record<string, Record<string, unknown>> = {
    color: {},
    radius: {},
    shadow: {},
  };

  tokens.forEach((t, i) => {
    const key = t.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || `token-${i}`;
    if (t.category === 'color') {
      output.color[key] = { $value: t.rawValue, $type: 'color', $description: `Used by ${t.count} shape(s)` };
    } else if (t.category === 'radius') {
      output.radius[key] = { $value: t.value, $type: 'dimension', $description: `Used by ${t.count} shape(s)` };
    } else if (t.category === 'shadow') {
      output.shadow[key] = { $value: t.rawValue, $type: 'shadow', $description: `Used by ${t.count} shape(s)` };
    }
  });

  return JSON.stringify({ [`${projectName} Tokens`]: output }, null, 2);
}

export function tokensToCSSVars(tokens: DesignToken[], projectName: string): string {
  const lines: string[] = [`/* ${projectName} — canvas design tokens */`, ':root {'];
  tokens.forEach((t, i) => {
    const varName = `--${t.category}-${t.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || i}`;
    lines.push(`  ${varName}: ${t.value};`);
  });
  lines.push('}');
  return lines.join('\n');
}
