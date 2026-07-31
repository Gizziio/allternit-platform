/**
 * Deterministic HTML artifact generator.
 *
 * `generateArtifactHtml(input)` is a pure function: the same ArtifactInput
 * (see types.ts) always produces byte-identical HTML. No Date.now(), no
 * Math.random(), no generated ids, no reliance on object key iteration
 * order (every loop below walks an explicit array from the input, never
 * `Object.keys`/`for...in`). Output is fully self-contained — inline CSS,
 * one small inline vanilla-JS tab switcher, no external requests, no CDN
 * links — and supports light/dark via `prefers-color-scheme`.
 *
 * This is a from-scratch implementation written for gizzi-code, not a copy
 * of Claude Code's project-artifact template.html — informed by the same
 * general vocabulary (status pill, tabs, callouts, CSS-variable theming)
 * but its own CSS, its own tab-switch script, and its own tone system.
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
  return `<table>${head}${body}</table>`
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
  :root { --fg:#1c1c1e; --bg:#fbfaf8; --surface:#ffffff; --muted:#6b6b6f; --border:#e3e1dc; --code-bg:#f2f0ec;
    --accent:#3d6b4f; --accent-fg:#ffffff; --warn:#9a5b12; --warn-fg:#ffffff; --danger:#a3352c; --danger-fg:#ffffff; }
  @media (prefers-color-scheme: dark) {
    :root { --fg:#eeeeee; --bg:#17181a; --surface:#1f2023; --muted:#9a9a9e; --border:#2f3033; --code-bg:#232427;
      --accent:#7fbf98; --accent-fg:#0e1a13; --warn:#e0a655; --warn-fg:#241605; --danger:#e28378; --danger-fg:#2a0d0a; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 2.5em 1.5em 4em; background: var(--bg); color: var(--fg);
    font: 15px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  main, header { max-width: 880px; margin: 0 auto; }
  header { margin-bottom: 1.6em; }
  h1 { font-size: 1.6em; font-weight: 650; margin: 0 0 .2em; letter-spacing: -.01em; }
  h2 { font-size: 1.15em; font-weight: 650; margin: 1.4em 0 .5em; }
  p { margin: .6em 0; }
  .subtitle { color: var(--muted); font-size: .98em; margin: 0 0 .8em; }
  .pill { display: inline-block; font-size: .8em; font-weight: 600; padding: .25em .7em; border-radius: 999px; letter-spacing: .01em; }
  .pill.tone-accent { background: var(--accent); color: var(--accent-fg); }
  .pill.tone-warn { background: var(--warn); color: var(--warn-fg); }
  .pill.tone-danger { background: var(--danger); color: var(--danger-fg); }
  .pill.tone-neutral { background: var(--code-bg); color: var(--fg); border: 1px solid var(--border); }
  .callout { border-radius: 8px; padding: .8em 1.1em; margin: 1em 0; font-size: .95em; border: 1px solid var(--border); border-left-width: 4px; background: var(--surface); }
  .callout.tone-accent { border-left-color: var(--accent); }
  .callout.tone-warn { border-left-color: var(--warn); }
  .callout.tone-danger { border-left-color: var(--danger); }
  .callout.tone-neutral { border-left-color: var(--border); }
  .tabbar { display: flex; flex-wrap: wrap; gap: .25em; border-bottom: 1px solid var(--border); margin: 0 0 1.5em; max-width: 880px; margin-left: auto; margin-right: auto; }
  .tab { font: inherit; font-weight: 550; font-size: .92em; color: var(--muted); background: none; border: none; cursor: pointer;
    padding: .65em .9em; border-bottom: 2px solid transparent; margin-bottom: -1px; }
  .tab:hover { color: var(--fg); }
  .tab.active { color: var(--fg); border-bottom-color: var(--accent); }
  .pane { display: none; }
  .pane.active { display: block; }
  .stats { display: flex; flex-wrap: wrap; gap: 1.5em; margin: 1em 0; }
  .stat { display: flex; flex-direction: column; }
  .stat-value { font-size: 1.4em; font-weight: 650; }
  .stat-label { color: var(--muted); font-size: .85em; }
  ul { padding-left: 1.3em; margin: .6em 0; }
  li { margin: .3em 0; }
  table { border-collapse: collapse; width: 100%; margin: .9em 0; font-size: .93em; }
  th, td { border: 1px solid var(--border); padding: .5em .7em; text-align: left; vertical-align: top; }
  th { background: var(--code-bg); font-weight: 600; }
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
    headerParts.push(`<span class="pill ${toneClass(input.status.tone)}">${escapeHtml(input.status.label)}</span>`)
  }

  const singleTab = input.tabs.length === 1

  const tabbar = singleTab
    ? ''
    : `<div class="tabbar">\n${input.tabs
        .map(
          (tab, i) =>
            `  <button class="tab${i === 0 ? ' active' : ''}" data-pane="${tab.id}">${escapeHtml(tab.label)}</button>`,
        )
        .join('\n')}\n</div>\n`

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
