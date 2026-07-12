/**
 * buildSrcdoc — wrap an artifact's HTML for a sandboxed `<iframe srcdoc>`.
 *
 * Mirrors the core of Open Design's preview wrapper, adapted for Allternit:
 *  - If the model returned a full document (`<!doctype …>` / `<html …>`), pass it
 *    through unchanged so its own `<head>` / `<style>` / scripts are honored.
 *  - Otherwise wrap the fragment in a minimal, standards-compliant shell with a
 *    UTF-8 charset and a responsive viewport so fragments render predictably.
 *
 * Intentionally small. Open Design's heavier bridges (deck slide postMessage,
 * manual-edit, inspect/palette) are layered in later stages and wired to
 * Allternit's existing deck-framework / surgical-edit modules instead of being
 * duplicated here.
 */

const FULL_DOCUMENT_RE = /^\s*<!doctype\s+html|^\s*<html[\s>]/i;

export interface SrcdocOptions {
  /** Title used for the wrapped fragment shell. */
  title?: string;
  /** Monotonically increasing key that forces the iframe to re-parse even when
   *  the HTML bytes are identical (wired in a later hot-reload stage). */
  reloadKey?: number;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildSrcdoc(html: string, options: SrcdocOptions = {}): string {
  if (FULL_DOCUMENT_RE.test(html)) {
    if (options.reloadKey === undefined) return html;
    return html.replace(/<html(\s|>)/i, (_m, tail) => `<html data-alt-reload-key="${options.reloadKey}"${tail}`);
  }

  const title = escapeHtml(options.title ?? "Allternit Design preview");
  const reloadAttr = options.reloadKey !== undefined ? ` data-alt-reload-key="${options.reloadKey}"` : "";
  return `<!DOCTYPE html>
<html lang="en"${reloadAttr}>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>html,body{margin:0;padding:0;min-height:100%;}</style>
</head>
<body>
${html}
</body>
</html>`;
}
