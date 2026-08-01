/**
 * Deterministic HTML artifact generator.
 *
 * `generateArtifactHtml(input)` is a pure function: the same ArtifactInput
 * (see types.ts) always produces byte-identical HTML. No Date.now(), no
 * Math.random(), no generated ids, no reliance on object key iteration
 * order (every loop below walks an explicit array from the input, never
 * `Object.keys`/`for...in`). Output is fully self-contained — inline CSS,
 * one small inline vanilla-JS tab switcher, no external requests, no CDN
 * links — and supports light/dark via `prefers-color-scheme` plus an
 * explicit `data-theme` override on `<html>` for viewers that stamp one.
 *
 * This is a from-scratch implementation written for gizzi-code, not a copy
 * of Claude Code's project-artifact template.html — informed by the same
 * general vocabulary (status pill, tabs, callouts, CSS-variable theming)
 * but its own CSS, its own tab-switch script, and its own tone system.
 *
 * The token values (surface/text/border/status/accent colors, spacing
 * scale, tab pattern, badge formula) are pulled directly from the repo's
 * own `DESIGN.md` v2.0 §§1–4 — not invented — so every artifact this
 * generates reads as native Allternit UI rather than a generic template.
 * Typography uses DESIGN.md's Sans role (dashboards/status surfaces are
 * an explicit Sans surface per §1.3) for headings/body/labels and its
 * Mono role for stat values and tabular numerics; the Serif role is
 * deliberately unused here — that's reserved for long-form research and
 * editorial content, not tab/status/callout dashboards.
 */
import type { ArtifactInput, ArtifactSection, ArtifactTable, ArtifactTone } from './types'

const TAB_ID_PATTERN = /^[a-z0-9-]+$/

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function toneClass(tone: ArtifactTone | undefined): string {
  return `tone-${tone ?? 'neutral'}`
}

function renderTable(table: ArtifactTable): string {
  const head = `<tr>${table.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr>`
  const body = table.rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
    .join('')
  return `<div class="table-scroll"><table>${head}${body}</table></div>`
}

function renderSection(section: ArtifactSection): string {
  const parts: string[] = []
  if (section.heading) parts.push(`<h2>${escapeHtml(section.heading)}</h2>`)
  for (const paragraph of section.body ?? []) {
    parts.push(`<p>${escapeHtml(paragraph)}</p>`)
  }
  if (section.stats?.length) {
    const stats = section.stats
      .map((s) => `<div class="stat"><span class="stat-value">${escapeHtml(s.value)}</span><span class="stat-label">${escapeHtml(s.label)}</span></div>`)
      .join('')
    parts.push(`<div class="stats">${stats}</div>`)
  }
  if (section.list?.length) {
    parts.push(`<ul>${section.list.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`)
  }
  if (section.table) {
    parts.push(renderTable(section.table))
  }
  return parts.join('\n')
}

function validate(input: ArtifactInput): void {
  if (!input.title.trim()) throw new Error('ArtifactInput.title must not be empty')
  if (input.tabs.length === 0) throw new Error('ArtifactInput.tabs must have at least one tab')
  const seen = new Set<string>()
  for (const tab of input.tabs) {
    if (!TAB_ID_PATTERN.test(tab.id)) {
      throw new Error(`ArtifactInput tab id "${tab.id}" must match ${TAB_ID_PATTERN} (lowercase letters, digits, hyphens)`)
    }
    if (seen.has(tab.id)) throw new Error(`ArtifactInput has a duplicate tab id "${tab.id}"`)
    seen.add(tab.id)
  }
}

const STYLE = `
  :root {
    --surface-canvas: #fafafa; --surface-panel: #ffffff; --surface-active: #f3f4f6; --surface-hover: #e5e7eb;
    --text-primary: #111111; --text-secondary: #4b5563; --text-muted: #9ca3af; --text-inverse: #ffffff;
    --border-muted: #e5e7eb; --border-default: #d1d5db;
    --accent-primary: #7c3aed; --accent-primary-rgb: 124, 58, 237;
    --status-warning: #f59e0b; --status-warning-rgb: 245, 158, 11;
    --status-error: #ef4444; --status-error-rgb: 239, 68, 68;
    --shadow-2: 0 4px 12px rgba(0, 0, 0, 0.06);
    --duration-standard: 200ms; --ease-standard: cubic-bezier(0.4, 0, 0.2, 1);
    --font-sans: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    --font-mono: "SFMono-Regular", ui-monospace, Menlo, Monaco, Consolas, monospace;
    color-scheme: light dark;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --surface-canvas: #0a0a0b; --surface-panel: #141416; --surface-active: #222225; --surface-hover: #2a2a2e;
      --text-primary: #f0f0f0; --text-secondary: #a1a1aa; --text-muted: #52525b; --text-inverse: #0a0a0b;
      --border-muted: #27272a; --border-default: #3f3f46;
      --accent-primary: #a78bfa; --accent-primary-rgb: 167, 139, 250;
      --shadow-2: 0 4px 16px rgba(0, 0, 0, 0.24);
    }
  }
  :root[data-theme="dark"] {
    --surface-canvas: #0a0a0b; --surface-panel: #141416; --surface-active: #222225; --surface-hover: #2a2a2e;
    --text-primary: #f0f0f0; --text-secondary: #a1a1aa; --text-muted: #52525b; --text-inverse: #0a0a0b;
    --border-muted: #27272a; --border-default: #3f3f46;
    --accent-primary: #a78bfa; --accent-primary-rgb: 167, 139, 250;
    --shadow-2: 0 4px 16px rgba(0, 0, 0, 0.24);
  }
  :root[data-theme="light"] {
    --surface-canvas: #fafafa; --surface-panel: #ffffff; --surface-active: #f3f4f6; --surface-hover: #e5e7eb;
    --text-primary: #111111; --text-secondary: #4b5563; --text-muted: #9ca3af; --text-inverse: #ffffff;
    --border-muted: #e5e7eb; --border-default: #d1d5db;
    --accent-primary: #7c3aed; --accent-primary-rgb: 124, 58, 237;
    --shadow-2: 0 4px 12px rgba(0, 0, 0, 0.06);
  }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 40px 16px 64px; background: var(--surface-canvas); color: var(--text-primary);
    font: 15px/1.65 var(--font-sans); -webkit-font-smoothing: antialiased; }
  main, header, .tabbar-row { max-width: 768px; margin-left: auto; margin-right: auto; }
  header { display: flex; flex-direction: column; gap: 8px; margin-bottom: 24px; }
  h1 { font-size: 1.7em; font-weight: 650; margin: 0; letter-spacing: -.015em; text-wrap: balance; }
  h2 { font-size: 1.05em; font-weight: 650; margin: 32px 0 12px; letter-spacing: -.005em; }
  p { margin: 8px 0; color: var(--text-secondary); max-width: 65ch; }
  .subtitle { color: var(--text-secondary); font-size: 1em; margin: 0; }
  .badge { display: inline-flex; align-items: center; width: fit-content; font-size: .78em; font-weight: 600;
    padding: 3px 10px; border-radius: 999px; letter-spacing: .015em; }
  .badge.tone-accent { background: rgba(var(--accent-primary-rgb), 0.12); border: 1px solid rgba(var(--accent-primary-rgb), 0.25); color: var(--accent-primary); }
  .badge.tone-warn { background: rgba(var(--status-warning-rgb), 0.12); border: 1px solid rgba(var(--status-warning-rgb), 0.25); color: var(--status-warning); }
  .badge.tone-danger { background: rgba(var(--status-error-rgb), 0.12); border: 1px solid rgba(var(--status-error-rgb), 0.25); color: var(--status-error); }
  .badge.tone-neutral { background: transparent; border: 1px solid var(--border-default); color: var(--text-secondary); }
  .callout { border-radius: 10px; padding: 14px 16px; margin: 16px 0; font-size: .95em; line-height: 1.55;
    background: var(--surface-panel); border: 1px solid var(--border-muted); border-left-width: 3px; color: var(--text-secondary); }
  .callout.tone-accent { border-left-color: var(--accent-primary); }
  .callout.tone-warn { border-left-color: var(--status-warning); }
  .callout.tone-danger { border-left-color: var(--status-error); }
  .callout.tone-neutral { border-left-color: var(--border-default); }
  .tabbar-row { border-bottom: 1px solid var(--border-muted); margin-bottom: 24px; }
  .tabbar { display: flex; flex-wrap: wrap; gap: 4px; overflow-x: auto; }
  .tab { font: inherit; font-family: var(--font-sans); font-weight: 550; font-size: .92em; color: var(--text-secondary);
    background: none; border: none; cursor: pointer; white-space: nowrap;
    padding: 10px 14px; border-bottom: 2px solid transparent; margin-bottom: -1px;
    transition: color var(--duration-standard) var(--ease-standard), border-color var(--duration-standard) var(--ease-standard); }
  .tab:hover { color: var(--text-primary); }
  .tab.active { color: var(--text-primary); border-bottom-color: var(--accent-primary); }
  .tab:focus-visible { outline: 2px solid var(--accent-primary); outline-offset: 2px; border-radius: 4px; }
  .pane { display: none; }
  .pane.active { display: block; }
  .stats { display: flex; flex-wrap: wrap; gap: 24px; margin: 16px 0; }
  .stat { display: flex; flex-direction: column; gap: 2px; }
  .stat-value { font-family: var(--font-mono); font-variant-numeric: tabular-nums; font-size: 1.35em; font-weight: 600; letter-spacing: -.01em; }
  .stat-label { color: var(--text-muted); font-size: .82em; }
  ul { padding-left: 1.25em; margin: 8px 0; color: var(--text-secondary); }
  li { margin: 4px 0; }
  .table-scroll { overflow-x: auto; margin: 16px 0; border: 1px solid var(--border-muted); border-radius: 10px; }
  table { border-collapse: collapse; width: 100%; font-size: .92em; font-variant-numeric: tabular-nums; }
  th, td { padding: 10px 14px; text-align: left; vertical-align: top; border-bottom: 1px solid var(--border-muted); }
  tr:last-child td { border-bottom: none; }
  th { background: var(--surface-active); font-weight: 600; font-size: .85em; color: var(--text-secondary);
    text-transform: uppercase; letter-spacing: .03em; }
  td { color: var(--text-primary); }
  @media (prefers-reduced-motion: reduce) {
    .tab { transition-duration: 0.01ms; }
  }
`.trim()

const TAB_SCRIPT = `
(function () {
  var tabs = document.querySelectorAll('.tab');
  var panes = document.querySelectorAll('.pane');
  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      var target = tab.getAttribute('data-pane');
      tabs.forEach(function (t) { t.classList.toggle('active', t === tab); });
      panes.forEach(function (p) { p.classList.toggle('active', p.id === target); });
    });
  });
})();
`.trim()

/**
 * Renders a self-contained HTML document for the given input. Throws on
 * structurally invalid input (empty title, no tabs, bad/duplicate tab ids)
 * rather than silently producing broken markup.
 */
export function generateArtifactHtml(input: ArtifactInput): string {
  validate(input)

  const title = escapeHtml(input.title)
  const headerParts: string[] = [`<h1>${title}</h1>`]
  if (input.subtitle) headerParts.push(`<p class="subtitle">${escapeHtml(input.subtitle)}</p>`)
  if (input.status) {
    headerParts.push(`<span class="badge ${toneClass(input.status.tone)}">${escapeHtml(input.status.label)}</span>`)
  }

  const singleTab = input.tabs.length === 1

  const tabbar = singleTab
    ? ''
    : `<div class="tabbar-row"><div class="tabbar">\n${input.tabs
        .map(
          (tab, i) =>
            `  <button class="tab${i === 0 ? ' active' : ''}" data-pane="${tab.id}">${escapeHtml(tab.label)}</button>`,
        )
        .join('\n')}\n</div></div>\n`

  const panes = input.tabs
    .map((tab, i) => {
      const body: string[] = []
      if (tab.callout) {
        body.push(`<div class="callout ${toneClass(tab.callout.tone)}">${escapeHtml(tab.callout.text)}</div>`)
      }
      for (const section of tab.sections) {
        body.push(renderSection(section))
      }
      const inner = body.join('\n')
      return singleTab
        ? inner
        : `<section class="pane${i === 0 ? ' active' : ''}" id="${tab.id}">\n${inner}\n</section>`
    })
    .join('\n')

  const script = singleTab ? '' : `<script>\n${TAB_SCRIPT}\n</script>\n`

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
${STYLE}
</style>
</head>
<body>
<header>
${headerParts.join('\n')}
</header>
${tabbar}<main>
${panes}
</main>
${script}</body>
</html>
`
}
