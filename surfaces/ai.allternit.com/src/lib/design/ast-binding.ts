/**
 * AST two-way binding — Onlook-style code↔DOM writeback, scoped MVP.
 *
 * Ported deferred non-goal from session surgicaleye-0911: click-targeted
 * surgical edits write BACK into the artifact HTML source deterministically
 * (no agent round-trip), and the preview re-renders from the patched source.
 *
 * Design:
 * - Zero new dependencies: no HTML parser ships in this surface, and none is
 *   needed. A small position-tracking tolerant scanner splices edits on
 *   source offsets, so everything outside the target element is preserved
 *   BYTE-FOR-BYTE (we never re-serialize the document).
 * - Id parity with `injectAioIds` (aio-targeting.ts): an element's effective
 *   id is its own `data-aio-id` when present, otherwise `aio-N` assigned in
 *   document order continuing after the highest pre-existing `aio-N` — with
 *   the same skip rules (raw-text script/style/textarea/title regions, void /
 *   skip tags, comments / doctype / CDATA / PIs). The id the user clicked in
 *   the preview therefore resolves to exactly the same source element.
 * - Duplicate `data-aio-id`s: FIRST match in document order wins (the same
 *   element `document.querySelector('[data-aio-id="…"]')` would return).
 * - Idempotency: every edit kind is deterministic and applying the same edit
 *   twice yields the same output as applying it once.
 *
 * Known limitation (documented, accepted for the MVP): patching inner HTML
 * that adds/removes targetable elements renumbers the injected ids of the
 * elements AFTER the patch point on the next render (numbering is
 * deterministic but positional). Re-target after an in-place edit.
 */

// Mirrors aio-targeting.ts — elements injection never tags (all void).
const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link',
  'meta', 'param', 'source', 'track', 'wbr',
]);
// Mirrors aio-targeting.ts — tags injection skips for id assignment.
const SKIP_TAGS = new Set([
  'html', 'head', 'body', 'meta', 'link', 'base', 'br', 'hr', 'img',
  'input', 'source', 'track', 'area', 'col', 'embed', 'param', 'wbr',
]);
// Mirrors aio-targeting.ts — contents are raw text, never scanned for tags.
const RAW_TEXT_TAGS = new Set(['script', 'style', 'textarea', 'title']);

// HTML implied-end-tag set (simplified): an open element of one of these
// tags is implicitly closed when a new start tag of the SAME tag appears
// (`<ul><li>One<li>Two</ul>`). Like real HTML parsing, this is what keeps
// editing `li` One from swallowing `li` Two. Tags that legitimately nest
// (div, span, section, …) are intentionally NOT here.
const AUTOCLOSE_TAGS = new Set([
  'p', 'li', 'dt', 'dd', 'tr', 'td', 'th', 'option', 'optgroup',
  'thead', 'tbody', 'tfoot', 'caption', 'colgroup',
]);

const AIO_ID_RE = /^aio-\d+$/;
const EXISTING_AIO_ID_RE = /data-aio-id\s*=\s*["']aio-(\d+)["']/g;
const TOKEN_RE =
  /<!--[\s\S]*?-->|<!\[[\s\S]*?\]>|<![^>]*>|<\?[\s\S]*?\?>|<\/([a-zA-Z][a-zA-Z0-9-]*)[^>]*>|<([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
const ATTR_NAME_RE = /^[^\s"'<>\/=]+$/;

export class AstElementNotFoundError extends Error {
  readonly aioId: string;
  constructor(aioId: string) {
    super(`[ast-binding] element "${aioId}" not found in artifact source`);
    this.name = 'AstElementNotFoundError';
    this.aioId = aioId;
  }
}

/** Source location of an element targeted by its effective `data-aio-id`. */
export interface AstElementLocation {
  aioId: string;
  /** Lowercased tag name. */
  tag: string;
  /** Offset of the `<` that opens the element. */
  start: number;
  /** Offset just past the `>` that closes the OPEN tag. */
  openEnd: number;
  /** Offset just past the element (past its closing tag; == openEnd for void/self-closing). */
  end: number;
  /** Lowercased attr name → value (null = valueless boolean attribute). */
  attrs: Record<string, string | null>;
  /** Source range of the inner HTML: [start, end). */
  innerRange: { start: number; end: number };
  selfClosing: boolean;
  void: boolean;
}

/**
 * A deterministic in-place edit. At most one of `innerHtml` / `setText` may
 * be given (both = error). Attribute ops always apply; content ops apply
 * only to non-void, non-self-closing elements (silently skipped otherwise —
 * a void element has no inner HTML to replace).
 */
export interface AstElementEdit {
  /** Replace the inner HTML verbatim (raw markup — caller is trusted here). */
  innerHtml?: string;
  /** Replace the content with this text, HTML-escaped. */
  setText?: string;
  /** Attr name → new value; a null value removes the attribute. */
  setAttributes?: Record<string, string | null>;
  /** Attribute names to remove (no-op when absent). */
  removeAttributes?: string[];
}

function maxExistingAioId(html: string): number {
  let max = 0;
  let match: RegExpExecArray | null;
  EXISTING_AIO_ID_RE.lastIndex = 0;
  // eslint-disable-next-line no-cond-assign
  while ((match = EXISTING_AIO_ID_RE.exec(html)) !== null) {
    max = Math.max(max, Number(match[1]));
  }
  return max;
}

interface AttrToken {
  name: string; // lowercased
  value: string | null;
  leadStart: number; // start of the whitespace run before the name (raw-region relative)
  end: number; // end of the attr, past value or name (raw-region relative)
  valueStart: number; // absolute, -1 when valueless
  valueEnd: number; // absolute
  quote: '"' | "'" | null;
}

function isWs(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f';
}

/** Quote-aware attribute scan of a raw start-tag attribute region. */
function parseAttrs(raw: string, base: number): AttrToken[] {
  const tokens: AttrToken[] = [];
  const len = raw.length;
  let i = 0;
  while (i < len) {
    const leadStart = i;
    while (i < len && isWs(raw[i])) i++;
    if (i >= len) break;
    // A lone `/` (self-closing marker) ends the attribute region.
    if (raw[i] === '/' && raw.slice(i).trim() === '/') break;
    const nameStart = i;
    while (i < len && !isWs(raw[i]) && raw[i] !== '=') i++;
    const name = raw.slice(nameStart, i).toLowerCase();
    if (!name) break;
    let j = i;
    while (j < len && isWs(raw[j])) j++;
    let value: string | null = null;
    let valueStart = -1;
    let valueEnd = -1;
    let quote: '"' | "'" | null = null;
    if (j < len && raw[j] === '=') {
      j++;
      while (j < len && isWs(raw[j])) j++;
      if (j < len && (raw[j] === '"' || raw[j] === "'")) {
        const q = raw[j] as '"' | "'";
        quote = q;
        valueStart = j + 1;
        const close = raw.indexOf(q, valueStart);
        valueEnd = close === -1 ? len : close;
        value = raw.slice(valueStart, valueEnd);
        i = close === -1 ? len : close + 1;
      } else {
        valueStart = j;
        while (j < len && !isWs(raw[j])) j++;
        valueEnd = j;
        value = raw.slice(valueStart, valueEnd);
        i = j;
      }
    }
    // Valueless: `i` already sits just past the name.
    tokens.push({
      name,
      value,
      leadStart,
      end: i,
      valueStart: valueStart === -1 ? -1 : base + valueStart,
      valueEnd: base + valueEnd,
      quote,
    });
  }
  return tokens;
}

function escapeText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(value: string, quote: '"' | "'"): string {
  const escaped = value.replace(/&/g, '&amp;');
  return quote === '"' ? escaped.replace(/"/g, '&quot;') : escaped.replace(/'/g, '&#39;');
}

function attrsToRecord(tokens: AttrToken[]): Record<string, string | null> {
  const record: Record<string, string | null> = {};
  for (const token of tokens) record[token.name] = token.value;
  return record;
}

interface LocatedElement extends AstElementLocation {
  tokens: AttrToken[];
}

/**
 * Find the element carrying the effective `data-aio-id` === `aioId`,
 * replicating the numbering `injectAioIds` applies at render time (see file
 * header). Returns null when no element resolves to that id.
 */
export function locateElement(html: string, aioId: string): AstElementLocation | null {
  if (!AIO_ID_RE.test(aioId)) return null;

  let counter = maxExistingAioId(html);
  let found: LocatedElement | null = null;
  const rawTextStack: { tag: string; rec: LocatedElement | null }[] = [];
  const elemStack: { tag: string; rec: LocatedElement | null }[] = [];

  TOKEN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  // eslint-disable-next-line no-cond-assign
  while ((match = TOKEN_RE.exec(html)) !== null) {
    const whole = match[0];
    const start = match.index;
    const tokenEnd = start + whole.length;
    const closingTag = match[1];
    const tagName = match[2];
    const attrsRaw = match[3] ?? '';

    const rawTop = rawTextStack[rawTextStack.length - 1];
    if (rawTop) {
      // Inside a raw-text element only its closing tag ends the region.
      if (closingTag !== undefined && closingTag.toLowerCase() === rawTop.tag) {
        if (rawTop.rec) {
          rawTop.rec.innerRange.end = start;
          rawTop.rec.end = tokenEnd;
        }
        rawTextStack.pop();
      }
      continue;
    }

    if (tagName === undefined) {
      // Closing tag, comment, doctype, CDATA, or PI. Resolve element frames
      // for closing tags; everything else passes through untouched.
      if (closingTag !== undefined) {
        const closing = closingTag.toLowerCase();
        for (let i = elemStack.length - 1; i >= 0; i--) {
          if (elemStack[i].tag === closing) {
            // Frames above the match are implicitly closed by this tag
            // (tolerant HTML parsing).
            for (let j = elemStack.length - 1; j >= i; j--) {
              const frame = elemStack[j];
              if (frame.rec) {
                frame.rec.innerRange.end = start;
                frame.rec.end = tokenEnd;
              }
            }
            elemStack.length = i;
            break;
          }
        }
      }
      continue;
    }

    const tag = tagName.toLowerCase();
    const attrsStart = start + 1 + tagName.length;
    const tokens = parseAttrs(attrsRaw, attrsStart);
    const existing = tokens.find((t) => t.name === 'data-aio-id');

    // Effective id — exact parity with injectAioIds (aio-targeting.ts).
    let effective: string | null = null;
    if (existing && existing.value) {
      effective = existing.value;
    } else if (!RAW_TEXT_TAGS.has(tag) && !SKIP_TAGS.has(tag)) {
      counter += 1;
      effective = `aio-${counter}`;
    }

    const selfClosing = attrsRaw.trimEnd().endsWith('/');
    const isVoid = VOID_TAGS.has(tag);

    let rec: LocatedElement | null = null;
    if (effective !== null && effective === aioId && !found) {
      rec = {
        aioId,
        tag,
        start,
        openEnd: tokenEnd,
        end: tokenEnd,
        attrs: attrsToRecord(tokens),
        innerRange: { start: tokenEnd, end: tokenEnd },
        selfClosing,
        void: isVoid,
        tokens,
      };
      found = rec;
    }

    if (RAW_TEXT_TAGS.has(tag)) {
      if (!selfClosing) rawTextStack.push({ tag, rec });
      continue;
    }
    if (isVoid || selfClosing) continue;
    // Implied end tag: a same-tag start tag implicitly closes the nearest
    // open same-tag frame (and anything left open inside it) at `start`.
    if (AUTOCLOSE_TAGS.has(tag)) {
      for (let i = elemStack.length - 1; i >= 0; i--) {
        if (elemStack[i].tag === tag) {
          for (let j = elemStack.length - 1; j >= i; j--) {
            const frame = elemStack[j];
            if (frame.rec) {
              frame.rec.innerRange.end = start;
              frame.rec.end = start;
            }
          }
          elemStack.length = i;
          break;
        }
      }
    }
    elemStack.push({ tag, rec });
  }

  // Unclosed elements extend to EOF (tolerant parse — byte offsets stay valid).
  for (const frame of elemStack) {
    if (frame.rec) {
      frame.rec.innerRange.end = html.length;
      frame.rec.end = html.length;
    }
  }
  for (const frame of rawTextStack) {
    if (frame.rec) {
      frame.rec.innerRange.end = html.length;
      frame.rec.end = html.length;
    }
  }

  return found;
}

/**
 * Rebuild the open tag of `loc` with the attribute operations from `edit`
 * spliced into the ORIGINAL attribute text (untouched attributes keep their
 * exact original bytes, including quote style). Returns the original open-tag
 * slice when there are no attribute operations.
 */
function buildOpenTag(html: string, loc: LocatedElement, edit: AstElementEdit): string {
  const sets = edit.setAttributes ?? {};
  const removals = new Set((edit.removeAttributes ?? []).map((n) => n.toLowerCase()));
  if (removals.size === 0 && Object.keys(sets).length === 0) {
    return html.slice(loc.start, loc.openEnd);
  }

  for (const name of [...Object.keys(sets), ...removals]) {
    if (!ATTR_NAME_RE.test(name)) {
      throw new Error(`[ast-binding] invalid attribute name "${name}"`);
    }
  }

  const tagNameLen = loc.tag.length; // same length in any case
  const base = loc.start + 1 + tagNameLen;
  const raw = html.slice(base, loc.openEnd - 1);

  interface Splice { start: number; end: number; text: string }
  const splices: Splice[] = [];
  for (const token of loc.tokens) {
    const hasSet = Object.prototype.hasOwnProperty.call(sets, token.name);
    const setValue = hasSet ? sets[token.name] : undefined;
    if (setValue === null || (setValue === undefined && removals.has(token.name))) {
      splices.push({ start: token.leadStart, end: token.end, text: '' });
    } else if (setValue !== undefined) {
      const quote = token.quote ?? '"';
      const escaped = escapeAttr(setValue, quote);
      if (token.valueStart >= 0) {
        splices.push({ start: token.valueStart - base, end: token.valueEnd - base, text: escaped });
      } else {
        // Valueless attribute gains a value: name + ="value" (relative offset:
        // token.end is past the name).
        splices.push({ start: token.end, end: token.end, text: `=${quote}${escaped}${quote}` });
      }
    }
  }

  const existingNames = new Set(loc.tokens.map((t) => t.name));
  const insertions = Object.entries(sets).filter(
    ([name, value]) => value !== null && !existingNames.has(name.toLowerCase()),
  );

  let out = raw;
  splices.sort((a, b) => b.start - a.start);
  for (const s of splices) {
    out = out.slice(0, s.start) + s.text + out.slice(s.end);
  }

  if (insertions.length > 0) {
    const text = insertions
      .map(([name, value]) => ` ${name.toLowerCase()}="${escapeAttr(value as string, '"')}"`)
      .join('');
    const trimmed = out.trimEnd();
    const trailing = out.slice(trimmed.length);
    if (loc.selfClosing) {
      // Insert before the trailing `/`, collapsing whitespace between the
      // last attribute and the slash (the original gap is not meaningful).
      const at = trimmed.lastIndexOf('/');
      const pre = trimmed.slice(0, at).replace(/\s+$/, '');
      out = `${pre}${text}/${trailing}`;
    } else {
      out = `${trimmed}${text}${trailing}`;
    }
  }

  return `<${html.slice(loc.start + 1, base)}${out}>`;
}

/**
 * Apply a deterministic in-place edit to the element identified by `aioId`.
 * Everything outside the element is preserved byte-for-byte. Throws
 * {@link AstElementNotFoundError} when the id does not resolve.
 */
export function applyElementEdit(html: string, aioId: string, edit: AstElementEdit): string {
  if (edit.innerHtml !== undefined && edit.setText !== undefined) {
    throw new Error('[ast-binding] edit cannot set both innerHtml and setText');
  }
  const located = locateElement(html, aioId);
  if (!located) throw new AstElementNotFoundError(aioId);
  const loc = located as LocatedElement;

  const newOpenTag = buildOpenTag(html, loc, edit);

  if (loc.void || loc.selfClosing) {
    // Attribute edits only — a void/self-closing element has no inner HTML.
    return html.slice(0, loc.start) + newOpenTag + html.slice(loc.openEnd);
  }

  let newInner: string;
  if (edit.innerHtml !== undefined) newInner = edit.innerHtml;
  else if (edit.setText !== undefined) newInner = escapeText(edit.setText);
  else newInner = html.slice(loc.innerRange.start, loc.innerRange.end);

  return html.slice(0, loc.start) + newOpenTag + newInner + html.slice(loc.innerRange.end);
}

/**
 * Text-content approximation of an element's inner range (tags stripped,
 * basic entities decoded). Used to pre-fill the in-place text editor; not a
 * full HTML5 textContent implementation.
 */
export function extractInnerText(html: string, loc: AstElementLocation): string {
  const inner = html.slice(loc.innerRange.start, loc.innerRange.end);
  let text = '';
  TOKEN_RE.lastIndex = 0;
  let cursor = 0;
  let match: RegExpExecArray | null;
  // eslint-disable-next-line no-cond-assign
  while ((match = TOKEN_RE.exec(inner)) !== null) {
    text += inner.slice(cursor, match.index);
    cursor = match.index + match[0].length;
  }
  text += inner.slice(cursor);
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}
