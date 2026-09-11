/* phone-remote client — speaks the phone-remote protocol (NOT RFB):
 * server→client: binary JPEG frames + JSON text control messages.
 * client→server: JSON text input events, coordinates in stream-image pixels.
 * Layout idioms borrowed from surfaces/computer-embed (hud dot, dark canvas).
 */
'use strict';

const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');
const dot = document.getElementById('dot');
const statusEl = document.getElementById('status');
const fpsEl = document.getElementById('fps');
const kbd = document.getElementById('kbd');
const btnKbd = document.getElementById('btn-kbd');
const btnTouch = document.getElementById('btn-touch');
const btnTrackpad = document.getElementById('btn-trackpad');
const btnFit = document.getElementById('btn-fit');
const btnActual = document.getElementById('btn-actual');
const specialKeys = document.getElementById('special-keys');
const cursorEl = document.getElementById('cursor');

let inputMode = 'touch'; // touch | trackpad
let viewMode = 'fit';    // fit | actual
let cursorImg = { x: 0, y: 0 };

// ── Connection ──────────────────────────────────────────────────────────────

const token = new URLSearchParams(location.search).get('t')
  || sessionStorage.getItem('prt');
if (token) sessionStorage.setItem('prt', token);
const wsProto = location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = `${wsProto}//${location.host}/ws${token ? `?t=${encodeURIComponent(token)}` : ''}`;

let ws = null;
let imgW = 0;   // stream-image pixel size (authority for coordinate mapping)
let imgH = 0;
let frameCount = 0;
let fpsWindowStart = performance.now();

function setStatus(text, online) {
  statusEl.textContent = text;
  dot.className = `dot ${online ? 'online' : 'offline'}`;
}

function send(obj) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}

function sendInput(ev) {
  send({ type: 'input', ev });
}

function connect() {
  ws = new WebSocket(wsUrl, ['pr1']);
  ws.binaryType = 'arraybuffer';

  ws.onopen = () => setStatus('connected', true);

  ws.onclose = (ev) => {
    setStatus(`disconnected (${ev.code}) — retrying in 2s`, false);
    setTimeout(connect, 2000);
  };

  ws.onerror = () => {};

  ws.onmessage = async (msg) => {
    if (typeof msg.data === 'string') {
      const m = JSON.parse(msg.data);
      if (m.type === 'hello') {
        setStatus(m.input?.enabled ? 'connected (view + control)' : 'connected (view only)', true);
      } else if (m.type === 'screen') {
        // server hint about capture size; the JPEG itself is authoritative
      } else if (m.type === 'error' || m.type === 'input-error') {
        setStatus(m.error, true);
      }
      return;
    }
    // binary = one JPEG frame
    const blob = new Blob([msg.data], { type: 'image/jpeg' });
    const bitmap = await createImageBitmap(blob);
    if (bitmap.width !== imgW || bitmap.height !== imgH) {
      imgW = bitmap.width;
      imgH = bitmap.height;
      send({ type: 'view', imgW, imgH });
      cursorImg = { x: imgW / 2, y: imgH / 2 };
      resetView();
    }
    latest = bitmap;
    scheduleDraw();
    frameCount++;
    const now = performance.now();
    if (now - fpsWindowStart >= 2000) {
      fpsEl.textContent = `${(frameCount / ((now - fpsWindowStart) / 1000)).toFixed(1)} fps`;
      frameCount = 0;
      fpsWindowStart = now;
    }
  };
}

// ── View transform (client-side zoom/pan of the stream) ────────────────────

let latest = null;
let scale = 1;   // total: fit-scale × user zoom
let fitScale = 1;
let zoom = 1;
let offX = 0;
let offY = 0;
let drawQueued = false;

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(canvas.clientWidth * dpr);
  canvas.height = Math.round(canvas.clientHeight * dpr);
  if (imgW) resetView();
}

function resetView() {
  if (!imgW || !imgH) return;
  fitScale = Math.min(canvas.width / imgW, canvas.height / imgH);
  zoom = viewMode === 'actual' ? Math.max(1, (window.devicePixelRatio || 1)) : 1;
  // Fit = contain. Actual = 1 CSS pixel per stream pixel (no magnifying-glass zoom).
  if (viewMode === 'actual') {
    scale = window.devicePixelRatio || 1;
    offX = (canvas.width - imgW * scale) / 2;
    offY = (canvas.height - imgH * scale) / 2;
  } else {
    scale = fitScale;
    offX = (canvas.width - imgW * scale) / 2;
    offY = (canvas.height - imgH * scale) / 2;
  }
  scheduleDraw();
}

function setInputMode(mode) {
  inputMode = mode;
  btnTouch.classList.toggle('active', mode === 'touch');
  btnTrackpad.classList.toggle('active', mode === 'trackpad');
  cursorEl.hidden = mode !== 'trackpad';
}

function setViewMode(mode) {
  viewMode = mode;
  btnFit.classList.toggle('active', mode === 'fit');
  btnActual.classList.toggle('active', mode === 'actual');
  resetView();
}

function placeCursorFromImage(ix, iy) {
  cursorImg = { x: ix, y: iy };
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  cursorEl.style.left = `${rect.left + (offX + ix * scale) / dpr}px`;
  cursorEl.style.top = `${rect.top + (offY + iy * scale) / dpr}px`;
}

function scheduleDraw() {
  if (drawQueued) return;
  drawQueued = true;
  requestAnimationFrame(() => {
    drawQueued = false;
    if (!latest) return;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(latest, offX, offY, imgW * scale, imgH * scale);
  });
}

// CSS-pixel point → stream-image pixel coordinates.
function toImageCoords(clientX, clientY) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const cx = (clientX - rect.left) * dpr;
  const cy = (clientY - rect.top) * dpr;
  return {
    x: Math.round((cx - offX) / scale),
    y: Math.round((cy - offY) / scale),
  };
}

function clampZoomAround(factor, cx, cy) {
  const dpr = window.devicePixelRatio || 1;
  const px = cx * dpr;
  const py = cy * dpr;
  const newZoom = Math.min(8, Math.max(1, zoom * factor));
  const realFactor = newZoom / zoom;
  zoom = newZoom;
  const newScale = fitScale * zoom;
  offX = px - ((px - offX) / scale) * newScale;
  offY = py - ((py - offY) / scale) * newScale;
  scale = newScale;
  scheduleDraw();
}

// ── Touch gestures ──────────────────────────────────────────────────────────
// 1 finger: tap = click · long-press = right-click · drag = mouse drag
// 2 fingers: pinch = zoom view · two-finger drag = scroll remote

const TAP_MAX_MOVE = 12;
const TAP_MAX_MS = 400;
const LONGPRESS_MS = 500;

let gesture = null; // { mode, startX, startY, lastX, lastY, startT, dragging, longFired, timer, pinch }

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (e.touches.length === 1) {
    const t = e.touches[0];
    if (inputMode === 'trackpad') {
      gesture = { mode: 'trackpad', lastX: t.clientX, lastY: t.clientY, startT: performance.now(), moved: false };
      return;
    }
    gesture = {
      mode: 'single',
      startX: t.clientX, startY: t.clientY,
      lastX: t.clientX, lastY: t.clientY,
      startT: performance.now(),
      dragging: false,
      longFired: false,
      timer: setTimeout(() => {
        if (gesture && gesture.mode === 'single' && !gesture.dragging) {
          gesture.longFired = true;
          const p = toImageCoords(gesture.startX, gesture.startY);
          sendInput({ type: 'click', x: p.x, y: p.y, button: 'right' });
          if (navigator.vibrate) navigator.vibrate(10);
        }
      }, LONGPRESS_MS),
    };
  } else if (e.touches.length === 2) {
    if (gesture?.timer) clearTimeout(gesture.timer);
    const [a, b] = e.touches;
    gesture = {
      mode: 'pair',
      mid: midpoint(a, b),
      dist: distance(a, b),
      scrollAccum: { x: 0, y: 0 },
      pinch: false,
    };
  }
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (!gesture) return;
  if (gesture.mode === 'trackpad' && e.touches.length === 1) {
    const t = e.touches[0];
    const dx = t.clientX - gesture.lastX;
    const dy = t.clientY - gesture.lastY;
    if (Math.hypot(dx, dy) > 2) gesture.moved = true;
    cursorImg.x = Math.max(0, Math.min(imgW, cursorImg.x + dx / (scale / (window.devicePixelRatio || 1))));
    cursorImg.y = Math.max(0, Math.min(imgH, cursorImg.y + dy / (scale / (window.devicePixelRatio || 1))));
    placeCursorFromImage(cursorImg.x, cursorImg.y);
    sendInput({ type: 'move', x: Math.round(cursorImg.x), y: Math.round(cursorImg.y) });
    gesture.lastX = t.clientX;
    gesture.lastY = t.clientY;
    return;
  }
  if (gesture.mode === 'single' && e.touches.length === 1) {
    const t = e.touches[0];
    const moved = Math.hypot(t.clientX - gesture.startX, t.clientY - gesture.startY);
    if (!gesture.dragging && moved > TAP_MAX_MOVE) {
      if (gesture.timer) clearTimeout(gesture.timer);
      if (!gesture.longFired) {
        gesture.dragging = true;
        const p = toImageCoords(gesture.startX, gesture.startY);
        sendInput({ type: 'mousedown', x: p.x, y: p.y, button: 'left' });
      }
    }
    if (gesture.dragging) {
      const p = toImageCoords(t.clientX, t.clientY);
      sendInput({ type: 'move', x: p.x, y: p.y });
      gesture.lastX = t.clientX;
      gesture.lastY = t.clientY;
    }
  } else if (gesture.mode === 'pair' && e.touches.length === 2) {
    const [a, b] = e.touches;
    const mid = midpoint(a, b);
    const dist = distance(a, b);
    // Pinch-zoom of a JPEG is what made the picture look grainy. Fit/Actual
    // are the only view modes; two-finger drag always scrolls the remote.
    gesture.scrollAccum.x += mid.x - gesture.mid.x;
    gesture.scrollAccum.y += mid.y - gesture.mid.y;
    const step = 18; // CSS px per wheel line
    const dx = Math.trunc(gesture.scrollAccum.x / step);
    const dy = Math.trunc(gesture.scrollAccum.y / step);
    if (dx || dy) {
      sendInput({ type: 'scroll', dx, dy });
      gesture.scrollAccum.x -= dx * step;
      gesture.scrollAccum.y -= dy * step;
    }
    gesture.mid = mid;
    gesture.dist = dist;
  }
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  if (!gesture) return;
  if (gesture.mode === 'trackpad') {
    if (!gesture.moved && performance.now() - gesture.startT < TAP_MAX_MS) {
      sendInput({ type: 'click', x: Math.round(cursorImg.x), y: Math.round(cursorImg.y), button: 'left' });
    }
  } else if (gesture.mode === 'single') {
    if (gesture.timer) clearTimeout(gesture.timer);
    if (gesture.dragging) {
      const p = toImageCoords(gesture.lastX, gesture.lastY);
      sendInput({ type: 'mouseup', x: p.x, y: p.y, button: 'left' });
    } else if (!gesture.longFired && performance.now() - gesture.startT < TAP_MAX_MS) {
      const p = toImageCoords(gesture.startX, gesture.startY);
      sendInput({ type: 'click', x: p.x, y: p.y, button: 'left' });
    }
  }
  if (e.touches.length === 0) gesture = null;
  else if (e.touches.length === 1) {
    // dropped from two fingers to one — restart as a fresh single gesture
    const t = e.touches[0];
    gesture = { mode: 'single', startX: t.clientX, startY: t.clientY, lastX: t.clientX, lastY: t.clientY, startT: performance.now(), dragging: false, longFired: true, timer: null };
  }
}, { passive: false });

canvas.addEventListener('touchcancel', () => { gesture = null; });

function midpoint(a, b) { return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 }; }
function distance(a, b) { return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); }

// Mouse fallback for desktop testing.
canvas.addEventListener('mousedown', (e) => {
  const p = toImageCoords(e.clientX, e.clientY);
  sendInput({ type: 'mousedown', x: p.x, y: p.y, button: e.button === 2 ? 'right' : 'left' });
});
canvas.addEventListener('mousemove', (e) => {
  if (e.buttons) {
    const p = toImageCoords(e.clientX, e.clientY);
    sendInput({ type: 'move', x: p.x, y: p.y });
  }
});
canvas.addEventListener('mouseup', (e) => {
  const p = toImageCoords(e.clientX, e.clientY);
  sendInput({ type: 'mouseup', x: p.x, y: p.y, button: e.button === 2 ? 'right' : 'left' });
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  sendInput({ type: 'scroll', dx: Math.trunc(e.deltaX / 40), dy: Math.trunc(e.deltaY / 40) });
}, { passive: false });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// ── Keyboard ────────────────────────────────────────────────────────────────

btnKbd.addEventListener('click', () => {
  const active = btnKbd.classList.toggle('active');
  specialKeys.hidden = !active;
  if (active) {
    kbd.value = '';
    kbd.focus();
  } else {
    kbd.blur();
  }
});

kbd.addEventListener('input', () => {
  // Forward whatever the OSK inserted as unicode text; then clear so the
  // field never grows (diffing mobile autocorrect text is unreliable).
  if (kbd.value) sendInput({ type: 'text', text: kbd.value });
  kbd.value = '';
});

kbd.addEventListener('keydown', (e) => {
  const named = { Backspace: 'delete', Enter: 'return', Escape: 'esc', Tab: 'tab',
    ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }[e.key];
  if (named) {
    e.preventDefault();
    sendInput({ type: 'key', key: named });
  }
});

kbd.addEventListener('blur', () => {
  btnKbd.classList.remove('active');
  specialKeys.hidden = true;
});

specialKeys.addEventListener('click', (e) => {
  const key = e.target?.dataset?.key;
  if (!key) return;
  sendInput({ type: 'key', key });
  kbd.focus(); // keep the OSK up
});

btnTouch.addEventListener('click', () => setInputMode('touch'));
btnTrackpad.addEventListener('click', () => setInputMode('trackpad'));
btnFit.addEventListener('click', () => setViewMode('fit'));
btnActual.addEventListener('click', () => setViewMode('actual'));

window.addEventListener('resize', resizeCanvas);
window.visualViewport?.addEventListener('resize', resizeCanvas);

async function holdAwake() {
  if (!navigator.wakeLock) return;
  try { await navigator.wakeLock.request('screen'); } catch { /* denied / unsupported */ }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') holdAwake();
});
holdAwake();

resizeCanvas();
connect();
