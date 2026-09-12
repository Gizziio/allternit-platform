/**
 * Content-Security-Policy for artifact iframe srcdocs (DESIGN.md §11).
 *
 * Artifact documents are untrusted, model-generated markup rendered in a
 * sandboxed `<iframe srcdoc>` with an opaque origin. The iframe `sandbox`
 * attribute cuts them off from the host page; this CSP cuts them off from
 * the network. Injected as a `<meta http-equiv>` into every generated srcdoc
 * (see ArtifactRenderer) — no HTTP header is possible for srcdoc documents.
 *
 * Policy rationale — every directive preserves something legitimate
 * self-contained artifacts do, and nothing else:
 *  - `default-src 'none'` — deny everything by default.
 *  - `script-src 'unsafe-inline'` — artifact JS is inline `<script>` (the
 *    storage shim, the aio-target capture script, template scripts). External
 *    `<script src>` is blocked (no 'self', no https:).
 *  - `style-src 'unsafe-inline'` — inline `<style>` blocks and style attrs.
 *  - `img-src data: blob:` — self-contained artifacts embed images as data
 *    URIs or canvas-generated blobs; remote images are blocked.
 *  - `media-src blob:` — recorded audio/video as blobs; remote media blocked.
 *  - `font-src data:` — inline data-URI fonts; remote font CDNs blocked.
 *  - `connect-src 'none'` — fetch/XHR/beacon/WebSocket all blocked. NOTE:
 *    postMessage is NOT a network fetch and is NOT subject to connect-src,
 *    so the aio-target click-to-target channel keeps working.
 *  - `form-action 'none'` — `<form>` submissions blocked.
 *  - `base-uri 'none'` — a model-injected `<base>` cannot re-root relative
 *    URLs to an attacker origin.
 *
 * Deliberately absent: worker-src, frame-src, object-src all fall back to
 * `default-src 'none'` — blob workers, nested browsing contexts, and plugins
 * are blocked. No renderer path needs them today; re-open per-renderer if
 * one ever does (DESIGN.md §11.3).
 */

export const ARTIFACT_CSP =
  "default-src 'none'; " +
  "script-src 'unsafe-inline'; " +
  "style-src 'unsafe-inline'; " +
  "img-src data: blob:; " +
  "media-src blob:; " +
  "font-src data:; " +
  "connect-src 'none'; " +
  "form-action 'none'; " +
  "base-uri 'none'";

const CSP_MARKER = 'data-allternit-artifact-csp';

/**
 * Inject the artifact CSP `<meta>` into an HTML document, as early in `<head>`
 * as possible so it governs everything parsed after it. Idempotent via the
 * marker attribute.
 */
export function injectSandboxCsp(htmlContent: string, csp: string = ARTIFACT_CSP): string {
  if (htmlContent.includes(CSP_MARKER)) return htmlContent;
  const meta = `<meta http-equiv="Content-Security-Policy" content="${csp}" ${CSP_MARKER}>`;
  const headTag = htmlContent.match(/<head(?:\s[^>]*)?>/i);
  if (headTag) {
    const idx = htmlContent.indexOf(headTag[0]) + headTag[0].length;
    return htmlContent.slice(0, idx) + '\n' + meta + htmlContent.slice(idx);
  }
  const htmlTag = htmlContent.match(/<html(?:\s[^>]*)?>/i);
  if (htmlTag) {
    const idx = htmlContent.indexOf(htmlTag[0]) + htmlTag[0].length;
    return htmlContent.slice(0, idx) + '\n<head>' + meta + '</head>' + htmlContent.slice(idx);
  }
  return `<head>${meta}</head>\n` + htmlContent;
}
