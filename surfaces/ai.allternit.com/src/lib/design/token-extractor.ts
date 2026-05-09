export interface ExtractedToken {
  id: string;
  label: string;
  value: string;
  source: 'css-var' | 'tailwind' | 'dtcg';
  type: 'color' | 'dimension' | 'fontFamily' | 'string';
}

export function extractCssVars(css: string): ExtractedToken[] {
  const tokens: ExtractedToken[] = [];
  const re = /--([\w-]+)\s*:\s*([^;]+);/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    const id = m[1];
    const rawValue = m[2].trim();
    const type = inferTokenType(rawValue);
    tokens.push({
      id,
      label: idToLabel(id),
      value: rawValue,
      source: 'css-var',
      type,
    });
  }
  return tokens;
}

export function extractTailwindTokens(tailwindConfig: string): ExtractedToken[] {
  const tokens: ExtractedToken[] = [];
  const colorsMatch = tailwindConfig.match(/"?colors"?\s*:\s*\{([\s\S]*?)\}/);
  if (!colorsMatch) return tokens;
  const colorsBlock = colorsMatch[1];
  const re = /"?([\w-]+)"?\s*:\s*["']?(#[0-9a-fA-F]{3,8}|oklch[^"',]+|rgb[^"',]+)["']?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(colorsBlock)) !== null) {
    tokens.push({
      id: `tw-${m[1]}`,
      label: `Color: ${m[1]}`,
      value: m[2].trim(),
      source: 'tailwind',
      type: 'color',
    });
  }
  return tokens;
}

export function extractDtcgTokens(json: string): ExtractedToken[] {
  const tokens: ExtractedToken[] = [];
  try {
    const parsed = JSON.parse(json);
    extractDtcgNode(parsed, '', tokens);
  } catch {
    // malformed JSON — return empty
  }
  return tokens;
}

function extractDtcgNode(node: any, prefix: string, out: ExtractedToken[]) {
  if (typeof node !== 'object' || node === null) return;
  if ('$value' in node) {
    const id = prefix.replace(/^\./, '').replace(/\./g, '-');
    out.push({
      id,
      label: idToLabel(id),
      value: String(node.$value),
      source: 'dtcg',
      type: mapDtcgType(node.$type),
    });
  } else {
    for (const key of Object.keys(node)) {
      if (!key.startsWith('$')) {
        extractDtcgNode(node[key], `${prefix}.${key}`, out);
      }
    }
  }
}

function mapDtcgType(t: string | undefined): ExtractedToken['type'] {
  if (t === 'color') return 'color';
  if (t === 'dimension' || t === 'spacing' || t === 'borderRadius') return 'dimension';
  if (t === 'fontFamily') return 'fontFamily';
  return 'string';
}

function inferTokenType(value: string): ExtractedToken['type'] {
  if (/^#[0-9a-fA-F]{3,8}$/.test(value) || /^oklch/.test(value) || /^rgb/.test(value) || /^hsl/.test(value)) return 'color';
  if (/^\d+(\.\d+)?(px|rem|em|%)$/.test(value)) return 'dimension';
  if (/^["']?[\w\s,]+["']?$/.test(value) && value.includes(',')) return 'fontFamily';
  return 'string';
}

function idToLabel(id: string): string {
  return id
    .replace(/^(color|bg|text|border|radius|spacing|font)-/, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}
