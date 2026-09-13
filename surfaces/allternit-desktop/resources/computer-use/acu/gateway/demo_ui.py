"""
Allternit Computer Use — Demo UI

Self-contained single-page demo, mounted only when the gateway is started
with ALLTERNIT_ACU_DEMO=1 (the ``demo.py`` launcher sets it). The page lists
runs, starts a canned demo run ("open example.com and screenshot"), and
watches run events live over SSE. No build step, no external assets.
"""

from __future__ import annotations

import os
from typing import Any, Dict

from fastapi import APIRouter
from fastapi.responses import HTMLResponse

router = APIRouter(tags=["demo"])

_DEMO_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Allternit Computer Use — Demo</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; font-family: -apple-system, system-ui, sans-serif;
         background: #0b0b0c; color: #e5e5e5; }
  header { padding: 16px 24px; border-bottom: 1px solid #27272a;
           display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
  h1 { font-size: 18px; margin: 0; font-weight: 600; }
  button { background: #3b82f6; color: #fff; border: 0; border-radius: 6px;
           padding: 8px 14px; font-size: 14px; cursor: pointer; }
  button:disabled { opacity: .5; cursor: default; }
  .pill { background: #18181b; border: 1px solid #27272a; border-radius: 999px;
          padding: 4px 12px; font-size: 12px; color: #a1a1aa; }
  main { display: grid; grid-template-columns: 1fr 1fr; gap: 0; height: calc(100vh - 62px); }
  section { padding: 16px 24px; overflow: auto; }
  section:first-child { border-right: 1px solid #27272a; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .08em;
       color: #a1a1aa; margin: 0 0 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #1f1f22; }
  th { color: #71717a; font-weight: 500; }
  tr.run { cursor: pointer; } tr.run:hover { background: #18181b; }
  .status-completed { color: #4ade80; } .status-failed { color: #f87171; }
  .status-running { color: #60a5fa; } .status-pending { color: #a1a1aa; }
  #events { font-family: ui-monospace, Menlo, monospace; font-size: 12px;
            white-space: pre-wrap; word-break: break-all; }
  #events div { padding: 2px 0; border-bottom: 1px solid #141416; }
  #summary { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
  @media (max-width: 900px) { main { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<header>
  <h1>Allternit Computer Use — Live Demo</h1>
  <button id="start">Start canned demo run (open example.com + screenshot)</button>
  <span class="pill" id="vision"></span>
  <span class="pill" id="status-pill">idle</span>
</header>
<main>
  <section>
    <h2>Runs</h2>
    <div id="summary"></div>
    <table>
      <thead><tr><th>run_id</th><th>mode</th><th>status</th><th>tokens</th><th>est $</th></tr></thead>
      <tbody id="runs"></tbody>
    </table>
  </section>
  <section>
    <h2>Events <span id="watched" style="text-transform:none"></span></h2>
    <div id="events"></div>
  </section>
</main>
<script>
const $ = (id) => document.getElementById(id);
let es = null;

function fmt(n) { return n == null ? '—' : n; }

async function loadStatus() {
  try {
    const r = await fetch('/demo/status');
    const j = await r.json();
    $('vision').textContent = 'vision: ' + (j.vision_provider || 'auto');
  } catch (e) { $('vision').textContent = 'status unavailable'; }
}

async function loadRuns() {
  try {
    const [runsRes, costRes] = await Promise.all([
      fetch('/v1/computer-use/runs?limit=20'),
      fetch('/v1/computer-use/cost/summary'),
    ]);
    const j = await runsRes.json();
    const s = (await costRes.json()).summary || {};
    $('summary').innerHTML = '';
    for (const [k, v] of Object.entries(s)) {
      const el = document.createElement('span');
      el.className = 'pill';
      el.textContent = k + ': ' + v;
      $('summary').appendChild(el);
    }
    $('runs').innerHTML = '';
    for (const run of (j.runs || [])) {
      const tr = document.createElement('tr');
      tr.className = 'run';
      const cost = run.cost || {};
      tr.innerHTML = '<td>' + run.run_id + '</td><td>' + run.mode + '</td>' +
        '<td class="status-' + run.status + '">' + run.status + '</td>' +
        '<td>' + fmt(cost.total_tokens) + '</td><td>' + fmt(cost.est_cost_usd) + '</td>';
      tr.onclick = () => watch(run.run_id);
      $('runs').appendChild(tr);
    }
  } catch (e) { /* gateway starting — retry on next tick */ }
}

function logEvent(type, message) {
  const div = document.createElement('div');
  div.textContent = '[' + new Date().toLocaleTimeString() + '] ' + type + ' — ' + (message || '');
  $('events').prepend(div);
}

function watch(runId) {
  if (es) es.close();
  $('events').innerHTML = '';
  $('watched').textContent = '(run ' + runId + ')';
  es = new EventSource('/v1/computer-use/runs/' + runId + '/events');
  es.onmessage = (m) => {
    try {
      const j = JSON.parse(m.data);
      logEvent(j.event_type, j.message);
      if (j.event_type === 'run.ended') {
        $('status-pill').textContent = 'finished: ' + (j.message || 'unknown');
        es.close();
      }
    } catch (e) { logEvent('raw', m.data); }
  };
  es.onerror = () => { es.close(); };
}

$('start').onclick = async () => {
  $('start').disabled = true;
  $('status-pill').textContent = 'starting…';
  const runId = 'demo-' + Math.random().toString(16).slice(2, 14);
  try {
    const resp = await fetch('/v1/computer-use/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'direct',
        run_id: runId,
        session_id: 'sess-demo',
        actions: [
          { kind: 'navigate', target: { url: 'https://example.com' } },
          { kind: 'screenshot', target: { ref: 'page' } },
        ],
        options: { record: false, record_gif: false, approval_policy: 'never' },
      }),
    });
    const j = await resp.json();
    $('status-pill').textContent = 'run ' + j.status + ' (' + runId + ')';
    watch(runId);
  } catch (e) {
    $('status-pill').textContent = 'start failed: ' + e;
  } finally {
    $('start').disabled = false;
  }
  loadRuns();
};

loadStatus();
loadRuns();
setInterval(loadRuns, 3000);
</script>
</body>
</html>
"""


@router.get("/demo", response_class=HTMLResponse)
async def demo_page() -> str:
    """Self-contained demo page: run list, canned run starter, live events."""
    return _DEMO_HTML


@router.get("/demo/status")
async def demo_status() -> Dict[str, Any]:
    """Demo environment markers for the page header."""
    return {
        "demo": True,
        "vision_provider": os.environ.get("ALLTERNIT_VISION_PROVIDER") or "auto",
    }
