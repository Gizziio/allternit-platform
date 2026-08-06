/**
 * Self-contained interactive codemap.html: no CDN, no external requests,
 * one inline <style>, one inline vanilla-JS <script>. Dark-themed by
 * default (per the spec), with the same dual `prefers-color-scheme`/
 * `data-theme` override technique as runtime/artifacts/generateHtml.ts.
 *
 * The codemap data is embedded verbatim as a
 * `<script id="codemap-data" type="application/json">` data island — the
 * page's JS reads this same object at runtime instead of a hand-maintained
 * parallel node/edge/flow list, which is what guarantees codemap.html and
 * codemap.json can never drift apart (validate.ts's check #4 asserts this,
 * but it's true by construction here, not just by convention).
 *
 * The layered auto-layout (topological sort by layer, cycle remainder
 * dumped into one layer) and hand-rolled SVG rendering are a from-scratch
 * port of the same technique used by
 * packages/@allternit/workflow-engine/src/visualizer/index.ts's
 * `autoLayoutNodes`/`toSVG` — reimplemented here in vanilla JS since this
 * needs to run in the browser with zero bundling, not imported as a
 * TS module.
 */
import type { CodemapJson } from "./types"

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/**
 * `<script>` elements are parsed in raw-text mode — the HTML tokenizer
 * never decodes entities inside them, it just scans for the literal
 * closing `</script>` sequence. So HTML-escaping (&quot; etc.) would leave
 * literal entities in `.textContent` and break `JSON.parse` in the browser.
 * The standard safe technique instead: escape only `<` to a JSON unicode
 * escape (`<`, which `JSON.parse` decodes back to `<` natively) — this
 * is the one character that could otherwise prematurely close the tag
 * (e.g. a path containing the literal text "</script>"), and nothing else
 * needs escaping for a `<script type="application/json">` data island.
 */
function jsonForScriptTag(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c")
}

const STYLE = `
  :root {
    --surface-canvas: #0a0a0b; --surface-panel: #141416; --surface-active: #1c1c1f; --surface-hover: #232327;
    --text-primary: #f0f0f0; --text-secondary: #a1a1aa; --text-muted: #6b6b70;
    --border-muted: #27272a; --border-default: #3f3f46;
    --accent-primary: #a78bfa; --accent-primary-rgb: 167, 139, 250;
    --edge-stroke: #52525b; --edge-highlight: #a78bfa;
    --node-workspace-member: #3b82f6; --node-top-level-directory: #10b981; --node-catch-all: #6b7280;
    --font-sans: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    --font-mono: "SFMono-Regular", ui-monospace, Menlo, Monaco, Consolas, monospace;
    color-scheme: dark light;
  }
  @media (prefers-color-scheme: light) {
    :root {
      --surface-canvas: #fafafa; --surface-panel: #ffffff; --surface-active: #f3f4f6; --surface-hover: #e5e7eb;
      --text-primary: #111111; --text-secondary: #4b5563; --text-muted: #9ca3af;
      --border-muted: #e5e7eb; --border-default: #d1d5db;
      --accent-primary: #7c3aed; --accent-primary-rgb: 124, 58, 237;
      --edge-stroke: #9ca3af; --edge-highlight: #7c3aed;
    }
  }
  :root[data-theme="dark"] {
    --surface-canvas: #0a0a0b; --surface-panel: #141416; --surface-active: #1c1c1f; --surface-hover: #232327;
    --text-primary: #f0f0f0; --text-secondary: #a1a1aa; --text-muted: #6b6b70;
    --border-muted: #27272a; --border-default: #3f3f46;
    --accent-primary: #a78bfa; --edge-stroke: #52525b; --edge-highlight: #a78bfa;
  }
  :root[data-theme="light"] {
    --surface-canvas: #fafafa; --surface-panel: #ffffff; --surface-active: #f3f4f6; --surface-hover: #e5e7eb;
    --text-primary: #111111; --text-secondary: #4b5563; --text-muted: #9ca3af;
    --border-muted: #e5e7eb; --border-default: #d1d5db;
    --accent-primary: #7c3aed; --edge-stroke: #9ca3af; --edge-highlight: #7c3aed;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; background: var(--surface-canvas); color: var(--text-primary);
    font: 14px/1.5 var(--font-sans); -webkit-font-smoothing: antialiased; }
  #app { display: flex; flex-direction: column; height: 100vh; }
  header { display: flex; align-items: center; gap: 16px; padding: 12px 20px; border-bottom: 1px solid var(--border-muted); flex-wrap: wrap; }
  header h1 { font-size: 1.05em; font-weight: 650; margin: 0; letter-spacing: -.01em; }
  header .meta { color: var(--text-muted); font-size: .85em; font-family: var(--font-mono); }
  header .spacer { flex: 1; }
  #search { background: var(--surface-panel); border: 1px solid var(--border-default); color: var(--text-primary);
    border-radius: 6px; padding: 6px 10px; font: inherit; width: 220px; }
  #search:focus { outline: 2px solid var(--accent-primary); outline-offset: 1px; }
  .legend { display: flex; gap: 12px; align-items: center; font-size: .82em; color: var(--text-secondary); flex-wrap: wrap; }
  .legend .swatch { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 4px; vertical-align: -1px; }
  #main { flex: 1; display: flex; min-height: 0; }
  #canvas-wrap { flex: 1; position: relative; overflow: hidden; cursor: grab; }
  #canvas-wrap.dragging { cursor: grabbing; }
  svg { display: block; width: 100%; height: 100%; }
  .node rect { stroke: var(--border-default); stroke-width: 1; transition: opacity .15s; }
  .node text { fill: var(--text-inverse, #fff); font-family: var(--font-sans); pointer-events: none; }
  .node text.role { fill-opacity: .75; font-size: 10px; }
  .node { cursor: pointer; }
  .node.dimmed rect, .node.dimmed text { opacity: .25; }
  .node.selected rect { stroke: var(--accent-primary); stroke-width: 2; }
  .node.search-match rect { stroke: var(--accent-primary); stroke-width: 2; }
  .edge path { stroke: var(--edge-stroke); stroke-width: 1.5; fill: none; transition: opacity .15s, stroke .15s; }
  .edge.dimmed path { opacity: .12; }
  .edge.highlighted path { stroke: var(--edge-highlight); stroke-width: 2.5; }
  #panel { width: 320px; border-left: 1px solid var(--border-muted); overflow-y: auto; padding: 16px; flex-shrink: 0; background: var(--surface-panel); }
  #panel h2 { font-size: .95em; margin: 0 0 8px; }
  #panel h3 { font-size: .78em; text-transform: uppercase; letter-spacing: .04em; color: var(--text-muted); margin: 16px 0 6px; }
  #panel p, #panel li { color: var(--text-secondary); font-size: .88em; }
  #panel ul { margin: 0; padding-left: 1.1em; }
  #panel .empty-hint { color: var(--text-muted); font-size: .88em; }
  .flow-item { cursor: pointer; padding: 8px 0; border-bottom: 1px solid var(--border-muted); font-size: .85em; }
  .flow-item:hover { color: var(--text-primary); }
  .flow-item .steps { color: var(--text-muted); font-family: var(--font-mono); font-size: .82em; }
  .flow-item.active { color: var(--accent-primary); }
`.trim()

const SCRIPT = `
(function () {
  var data = JSON.parse(document.getElementById('codemap-data').textContent);
  var nodes = data.nodes, edges = data.edges, flows = data.flows;

  var NODE_W = 190, NODE_H = 56, H_SPACING = 50, V_SPACING = 90;
  var COLORS = { 'workspace-member': 'var(--node-workspace-member)', 'top-level-directory': 'var(--node-top-level-directory)', 'catch-all': 'var(--node-catch-all)' };
  function colorFor(role) { return COLORS[role] || 'var(--node-catch-all)'; }

  function autoLayout() {
    var ids = nodes.map(function (n) { return n.id; });
    var incoming = {}, outgoing = {};
    ids.forEach(function (id) { incoming[id] = []; outgoing[id] = []; });
    edges.forEach(function (e) {
      if (outgoing[e.from] !== undefined && incoming[e.to] !== undefined) {
        outgoing[e.from].push(e.to); incoming[e.to].push(e.from);
      }
    });
    var layers = [], visited = {}, inDegree = {}, visitedCount = 0;
    ids.forEach(function (id) { inDegree[id] = incoming[id].length; });
    while (visitedCount < ids.length) {
      var layer = [];
      ids.forEach(function (id) { if (!visited[id] && inDegree[id] === 0) layer.push(id); });
      if (layer.length === 0) ids.forEach(function (id) { if (!visited[id]) layer.push(id); });
      layer.sort();
      layers.push(layer);
      layer.forEach(function (id) {
        visited[id] = true; visitedCount++;
        outgoing[id].forEach(function (t) { inDegree[t] = (inDegree[t] || 0) - 1; });
      });
    }
    var positions = {};
    layers.forEach(function (layer, layerIndex) {
      var layerWidth = layer.length * (NODE_W + H_SPACING) - H_SPACING;
      layer.forEach(function (id, i) {
        positions[id] = { x: i * (NODE_W + H_SPACING) - layerWidth / 2, y: layerIndex * (NODE_H + V_SPACING) };
      });
    });
    return positions;
  }

  var positions = autoLayout();
  var svgns = 'http://www.w3.org/2000/svg';
  var svg = document.getElementById('graph');

  var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  nodes.forEach(function (n) {
    var p = positions[n.id] || { x: 0, y: 0 };
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + NODE_W); maxY = Math.max(maxY, p.y + NODE_H);
  });
  if (!isFinite(minX)) { minX = 0; minY = 0; maxX = NODE_W; maxY = NODE_H; }
  var pad = 60;
  svg.setAttribute('viewBox', (minX - pad) + ' ' + (minY - pad) + ' ' + (maxX - minX + pad * 2) + ' ' + (maxY - minY + pad * 2));

  var defs = document.createElementNS(svgns, 'defs');
  defs.innerHTML = '<marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="var(--edge-stroke)" /></marker>';
  svg.appendChild(defs);

  var viewport = document.createElementNS(svgns, 'g');
  viewport.setAttribute('id', 'viewport');
  svg.appendChild(viewport);

  function anchor(id, side) {
    var p = positions[id] || { x: 0, y: 0 };
    return side === 'bottom' ? { x: p.x + NODE_W / 2, y: p.y + NODE_H } : { x: p.x + NODE_W / 2, y: p.y };
  }

  var edgeEls = {};
  edges.forEach(function (e, i) {
    var s = anchor(e.from, 'bottom'), t = anchor(e.to, 'top');
    var midY = (s.y + t.y) / 2;
    var d = 'M ' + s.x + ' ' + s.y + ' C ' + s.x + ' ' + midY + ', ' + t.x + ' ' + midY + ', ' + t.x + ' ' + t.y;
    var g = document.createElementNS(svgns, 'g');
    g.setAttribute('class', 'edge');
    g.setAttribute('data-from', e.from);
    g.setAttribute('data-to', e.to);
    var path = document.createElementNS(svgns, 'path');
    path.setAttribute('d', d);
    path.setAttribute('marker-end', 'url(#arrowhead)');
    g.appendChild(path);
    viewport.appendChild(g);
    (edgeEls[e.from] = edgeEls[e.from] || []).push(g);
    (edgeEls['to:' + e.to] = edgeEls['to:' + e.to] || []).push(g);
  });

  var nodeEls = {};
  nodes.forEach(function (n) {
    var p = positions[n.id] || { x: 0, y: 0 };
    var g = document.createElementNS(svgns, 'g');
    g.setAttribute('class', 'node');
    g.setAttribute('transform', 'translate(' + p.x + ',' + p.y + ')');
    g.setAttribute('data-id', n.id);
    var rect = document.createElementNS(svgns, 'rect');
    rect.setAttribute('width', NODE_W); rect.setAttribute('height', NODE_H); rect.setAttribute('rx', 8);
    rect.setAttribute('fill', colorFor(n.role));
    g.appendChild(rect);
    var label = document.createElementNS(svgns, 'text');
    label.setAttribute('x', 12); label.setAttribute('y', 24); label.textContent = n.id;
    g.appendChild(label);
    var role = document.createElementNS(svgns, 'text');
    role.setAttribute('class', 'role'); role.setAttribute('x', 12); role.setAttribute('y', 40); role.textContent = n.role;
    g.appendChild(role);
    g.addEventListener('click', function () { selectNode(n.id); });
    viewport.appendChild(g);
    nodeEls[n.id] = g;
  });

  var panel = document.getElementById('panel');
  var nodeById = {}; nodes.forEach(function (n) { nodeById[n.id] = n; });

  function clearHighlight() {
    Object.keys(nodeEls).forEach(function (id) { nodeEls[id].classList.remove('dimmed', 'selected', 'search-match'); });
    edges.forEach(function (e, i) { });
    document.querySelectorAll('.edge').forEach(function (el) { el.classList.remove('dimmed', 'highlighted'); });
  }

  function selectNode(id) {
    clearHighlight();
    var node = nodeById[id];
    if (!node) return;
    var related = new Set([id]);
    var callers = [], deps = [];
    edges.forEach(function (e) {
      if (e.from === id) { deps.push(e.to); related.add(e.to); }
      if (e.to === id) { callers.push(e.from); related.add(e.from); }
    });
    Object.keys(nodeEls).forEach(function (nid) {
      if (nid === id) nodeEls[nid].classList.add('selected');
      if (!related.has(nid)) nodeEls[nid].classList.add('dimmed');
    });
    document.querySelectorAll('.edge').forEach(function (el) {
      var f = el.getAttribute('data-from'), t = el.getAttribute('data-to');
      if (f === id || t === id) el.classList.add('highlighted'); else el.classList.add('dimmed');
    });
    var relevantFlows = flows.filter(function (fl) { return fl.steps.indexOf(id) !== -1; });
    renderPanel(node, callers, deps, relevantFlows);
  }

  function renderPanel(node, callers, deps, relevantFlows) {
    var html = '<h2>' + escapeText(node.id) + '</h2>';
    html += '<p>' + escapeText(node.role) + ' &middot; ' + escapeText(node.path) + '</p>';
    if (node.entrypoints.length) html += '<h3>Entrypoints</h3><ul>' + node.entrypoints.map(function (e) { return '<li>' + escapeText(e) + '</li>'; }).join('') + '</ul>';
    if (node.tests.length) html += '<h3>Tests</h3><ul>' + node.tests.map(function (e) { return '<li>' + escapeText(e) + '</li>'; }).join('') + '</ul>';
    if (node.constraints.length) html += '<h3>Constraints</h3><ul>' + node.constraints.map(function (e) { return '<li>' + escapeText(e) + '</li>'; }).join('') + '</ul>';
    html += '<h3>Callers (' + callers.length + ')</h3>' + (callers.length ? '<ul>' + callers.map(function (c) { return '<li>' + escapeText(c) + '</li>'; }).join('') + '</ul>' : '<p class="empty-hint">none</p>');
    html += '<h3>Dependencies (' + deps.length + ')</h3>' + (deps.length ? '<ul>' + deps.map(function (d) { return '<li>' + escapeText(d) + '</li>'; }).join('') + '</ul>' : '<p class="empty-hint">none</p>');
    html += '<h3>Flows (' + relevantFlows.length + ')</h3>' + (relevantFlows.length ? relevantFlows.map(flowItemHtml).join('') : '<p class="empty-hint">none</p>');
    panel.innerHTML = html;
    Array.prototype.forEach.call(panel.querySelectorAll('.flow-item'), function (el) {
      el.addEventListener('click', function () { highlightFlow(parseInt(el.getAttribute('data-index'), 10)); });
    });
  }

  function flowItemHtml(fl) {
    var idx = flows.indexOf(fl);
    return '<div class="flow-item" data-index="' + idx + '"><div>' + escapeText(fl.trigger) + ' &rarr; ' + escapeText(fl.outcome) + '</div><div class="steps">' + fl.steps.map(escapeText).join(' &rarr; ') + '</div></div>';
  }

  function highlightFlow(index) {
    clearHighlight();
    var fl = flows[index];
    if (!fl) return;
    var stepSet = new Set(fl.steps);
    Object.keys(nodeEls).forEach(function (id) { if (!stepSet.has(id)) nodeEls[id].classList.add('dimmed'); });
    document.querySelectorAll('.edge').forEach(function (el) {
      var f = el.getAttribute('data-from'), t = el.getAttribute('data-to');
      var consecutive = false;
      for (var i = 0; i < fl.steps.length - 1; i++) {
        if (fl.steps[i] === f && fl.steps[i + 1] === t) { consecutive = true; break; }
      }
      if (consecutive) el.classList.add('highlighted'); else el.classList.add('dimmed');
    });
  }

  function escapeText(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  var flowsPanelInitial = '<h2>Flows</h2>' + (flows.length ? flows.map(flowItemHtml).join('') : '<p class="empty-hint">none detected</p>');
  panel.innerHTML = flowsPanelInitial;
  Array.prototype.forEach.call(panel.querySelectorAll('.flow-item'), function (el) {
    el.addEventListener('click', function () { highlightFlow(parseInt(el.getAttribute('data-index'), 10)); });
  });

  // Search/filter
  var searchInput = document.getElementById('search');
  searchInput.addEventListener('input', function () {
    var q = searchInput.value.trim().toLowerCase();
    if (!q) { clearHighlight(); return; }
    Object.keys(nodeEls).forEach(function (id) {
      var n = nodeById[id];
      var match = id.toLowerCase().indexOf(q) !== -1 || n.path.toLowerCase().indexOf(q) !== -1;
      nodeEls[id].classList.toggle('search-match', match);
      nodeEls[id].classList.toggle('dimmed', !match);
    });
  });

  // Zoom + drag pan
  var wrap = document.getElementById('canvas-wrap');
  var scale = 1, tx = 0, ty = 0;
  function applyTransform() { viewport.setAttribute('transform', 'translate(' + tx + ',' + ty + ') scale(' + scale + ')'); }
  wrap.addEventListener('wheel', function (e) {
    e.preventDefault();
    var delta = e.deltaY > 0 ? 0.9 : 1.1;
    scale = Math.max(0.2, Math.min(3, scale * delta));
    applyTransform();
  }, { passive: false });
  var dragging = false, lastX = 0, lastY = 0;
  wrap.addEventListener('mousedown', function (e) { dragging = true; lastX = e.clientX; lastY = e.clientY; wrap.classList.add('dragging'); });
  window.addEventListener('mousemove', function (e) {
    if (!dragging) return;
    tx += (e.clientX - lastX); ty += (e.clientY - lastY);
    lastX = e.clientX; lastY = e.clientY;
    applyTransform();
  });
  window.addEventListener('mouseup', function () { dragging = false; wrap.classList.remove('dragging'); });
})();
`.trim()

export function generateCodemapHtml(json: CodemapJson, repoName: string): string {
  const shortCommit = json.generated_from_commit.slice(0, 12)
  const roles = [...new Set(json.nodes.map((n) => n.role))].sort()
  const roleLabel: Record<string, string> = {
    "workspace-member": "Workspace member",
    "top-level-directory": "Top-level directory",
    "catch-all": "Other",
  }
  const legend = roles
    .map((r) => {
      const varName = `--node-${r}`
      return `<span class="legend-item"><span class="swatch" style="background:var(${varName})"></span>${escapeHtml(roleLabel[r] ?? r)}</span>`
    })
    .join("")

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(repoName)} — Codemap</title>
<style>
${STYLE}
</style>
</head>
<body>
<div id="app">
<header>
<h1>${escapeHtml(repoName)}</h1>
<span class="meta">generated ${escapeHtml(json.generated_at)} &middot; ${escapeHtml(shortCommit)}</span>
<div class="legend">${legend}</div>
<div class="spacer"></div>
<input id="search" type="text" placeholder="Search modules...">
</header>
<div id="main">
<div id="canvas-wrap"><svg id="graph"></svg></div>
<div id="panel"></div>
</div>
</div>
<script id="codemap-data" type="application/json">${jsonForScriptTag(json)}</script>
<script>
${SCRIPT}
</script>
</body>
</html>
`
}
