/**
 * Click-to-target surgical edits (mapping doc §3 port #5 — the shortcut
 * version of Onlook's DOM↔code binding; click → identify → prompt only, no
 * AST instrumentation and no code→DOM writeback).
 *
 * The artifact preview renders in a sandboxed `<iframe srcdoc>` WITHOUT
 * `allow-same-origin` (see ArtifactRenderer), so the parent page cannot read
 * the iframe's DOM. All element communication therefore happens over
 * postMessage from a script injected into the srcdoc:
 *
 *   parent page ──srcdoc(html + aio ids + capture script)──▶ sandboxed iframe
 *   sandboxed iframe ──postMessage({source:'aio-target', ...})──▶ parent page
 *
 * The ids are injected on the fly in the srcdoc pipeline only — stored
 * artifacts stay clean. Ids are deterministic (`aio-1`, `aio-2`, … in
 * document order) so they are stable across re-renders of the same HTML, and
 * injection is idempotent so re-running it never renumbers existing ids.
 */

export interface AioTargetPayload {
  aioId: string;
  tag: string;
  text: string;
}

/** Message `source` tag the in-iframe capture script posts with. */
export const AIO_TARGET_SOURCE = 'aio-target';

const AIO_ID_ATTR = 'data-aio-id';
const AIO_ID_RE = /^aio-\d+$/;
const TAG_RE = /^[a-z][a-z0-9-]*$/;
const MAX_TEXT_LEN = 120;

// Elements that cannot meaningfully be targeted (or must not receive attrs).
const SKIP_TAGS = new Set([
  'html', 'head', 'body', 'meta', 'link', 'base', 'br', 'hr', 'img',
  'input', 'source', 'track', 'area', 'col', 'embed', 'param', 'wbr',
]);
// Raw-text elements whose contents must not be scanned for tags.
const RAW_TEXT_TAGS = new Set(['script', 'style', 'textarea', 'title']);

const START_TAG_RE =
  /<!--[\s\S]*?-->|<!\[[\s\S]*?\]>|<![^>]*>|<\?[\s\S]*?\?>|<\/([a-zA-Z][a-zA-Z0-9-]*)[^>]*>|<([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;

function maxExistingAioId(html: string): number {
  let max = 0;
  const re = /data-aio-id\s*=\s*["']aio-(\d+)["']/g;
  let match: RegExpExecArray | null;
  // eslint-disable-next-line no-cond-assign
  while ((match = re.exec(html)) !== null) {
    max = Math.max(max, Number(match[1]));
  }
  return max;
}

/**
 * Deterministically add `data-aio-id="aio-N"` to every targetable element
 * lacking one, numbering in document order. Idempotent: re-injecting into
 * already-injected HTML returns it unchanged (any gaps left by user HTML that
 * already carried some ids are filled continuing after the highest id).
 * Comments, doctype, raw-text (script/style/textarea/title) contents, and
 * void-ish elements are left untouched.
 */
export function injectAioIds(html: string): string {
  let counter = maxExistingAioId(html);
  const rawTextStack: string[] = [];
  const out = html.replace(START_TAG_RE, (whole: string, closingTag?: string, tagName?: string, attrs?: string) => {
    const openTop = rawTextStack[rawTextStack.length - 1];
    if (openTop) {
      // Inside a raw-text element only its closing tag ends the region.
      if (closingTag !== undefined && closingTag.toLowerCase() === openTop) {
        rawTextStack.pop();
      }
      return whole;
    }

    // Comments, doctype, CDATA, processing instructions, and unmatched
    // closing tags: pass through.
    if (tagName === undefined) return whole;

    const tag = tagName.toLowerCase();

    if (RAW_TEXT_TAGS.has(tag)) {
      const selfClosing = (attrs ?? '').trimEnd().endsWith('/');
      if (!selfClosing) rawTextStack.push(tag);
      return whole;
    }
    if (SKIP_TAGS.has(tag)) return whole;
    if (attrs !== undefined && /\sdata-aio-id\s*=/.test(` ${attrs}`)) return whole;

    counter += 1;
    return `<${tagName}${attrs ?? ''} data-aio-id="aio-${counter}">`;
  });
  return out;
}

const AIO_TARGET_CAPTURE_SCRIPT = `<script data-allternit-aio-target-capture>
(() => {
  if (window.__allternitAioTargetCapture) return;
  Object.defineProperty(window, '__allternitAioTargetCapture', { value: true });
  document.addEventListener('click', (event) => {
    const target = event.target;
    const el = target && target.closest ? target.closest('[data-aio-id]') : null;
    if (!el) return;
    event.preventDefault();
    event.stopPropagation();
    const text = (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, ${MAX_TEXT_LEN});
    parent.postMessage({
      source: ${JSON.stringify(AIO_TARGET_SOURCE)},
      aioId: el.getAttribute('data-aio-id'),
      tag: el.tagName.toLowerCase(),
      text,
    }, '*');
  }, true);
})();
</script>`;

/**
 * Inject the click-capture script into an HTML document (before </body> when
 * present, appended otherwise). Idempotent via the script's marker attribute.
 */
export function injectAioTargetCapture(html: string): string {
  if (html.includes('data-allternit-aio-target-capture')) return html;
  const bodyClose = html.match(/<\/body\s*>/i);
  if (bodyClose) {
    const idx = html.indexOf(bodyClose[0]);
    return html.slice(0, idx) + AIO_TARGET_CAPTURE_SCRIPT + '\n' + html.slice(idx);
  }
  return html + '\n' + AIO_TARGET_CAPTURE_SCRIPT;
}

/**
 * Strictly validate a postMessage payload from the sandboxed iframe. Returns
 * the payload when it matches the expected shape, null otherwise. Callers
 * must ALSO check event.origin === 'null' (opaque origin) before trusting a
 * payload — this function validates shape only.
 */
export function parseAioTargetMessage(data: unknown): AioTargetPayload | null {
  if (typeof data !== 'object' || data === null) return null;
  const msg = data as Record<string, unknown>;
  if (msg.source !== AIO_TARGET_SOURCE) return null;
  const { aioId, tag, text } = msg;
  if (typeof aioId !== 'string' || !AIO_ID_RE.test(aioId)) return null;
  if (typeof tag !== 'string' || !TAG_RE.test(tag)) return null;
  if (typeof text !== 'string' || text.length > MAX_TEXT_LEN) return null;
  return { aioId, tag, text };
}

/**
 * Human element description used to seed the surgical-edit target field:
 * `<button> "Buy now" (aio-12)`. Text omitted when empty.
 */
export function buildAioTargetDescription(payload: AioTargetPayload): string {
  const text = payload.text.trim();
  return text ? `<${payload.tag}> "${text}" (${payload.aioId})` : `<${payload.tag}> (${payload.aioId})`;
}
