/**
 * Full-screen image viewer (lightbox) — opens on image click in BOTH Live Preview
 * and Reading view. Wheel/pinch zoom toward the cursor/focal point, drag (or
 * one-finger) to pan, double-click/tap to reset, Esc or backdrop click to close.
 * A single instance lives on document.body. (PRD FR-2)
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const MIN_SCALE = 0.1;
const MAX_SCALE = 16;

let overlay: HTMLDivElement | null = null;
let keyHandler: ((e: KeyboardEvent) => void) | null = null;

export function closeLightbox(): void {
  if (!overlay) return;
  overlay.remove();
  overlay = null;
  if (keyHandler) {
    window.removeEventListener('keydown', keyHandler);
    keyHandler = null;
  }
}

export function openLightbox(src: string, alt = ''): void {
  closeLightbox();

  const root = document.createElement('div');
  root.className = 'image-lightbox';
  overlay = root;

  const img = document.createElement('img');
  img.className = 'image-lightbox-img';
  img.alt = alt;
  img.draggable = false;

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'image-lightbox-close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';

  // transform = translate(tx,ty) scale(s), origin top-left so the zoom math stays
  // linear: screen = (tx,ty) + scale * local.
  let scale = 1;
  let tx = 0;
  let ty = 0;
  const apply = () => {
    img.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  };

  // Center + fit the image inside the viewport (never upscale past natural size).
  const fit = () => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const nw = img.naturalWidth || vw;
    const nh = img.naturalHeight || vh;
    const s = Math.min((vw * 0.92) / nw, (vh * 0.92) / nh, 1);
    scale = s > 0 ? s : 1;
    tx = (vw - nw * scale) / 2;
    ty = (vh - nh * scale) / 2;
    apply();
  };

  // Zoom keeping `(cx, cy)` fixed under the cursor/focal point.
  const zoomAt = (cx: number, cy: number, factor: number) => {
    const prev = scale;
    scale = clamp(scale * factor, MIN_SCALE, MAX_SCALE);
    const k = scale / prev;
    tx = cx - k * (cx - tx);
    ty = cy - k * (cy - ty);
    apply();
  };

  img.onload = fit;
  img.src = src;

  root.appendChild(img);
  root.appendChild(closeBtn);

  // --- wheel zoom toward cursor ---
  root.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.12 : 1 / 1.12);
    },
    { passive: false },
  );

  // --- mouse drag to pan (listeners attached per-drag, removed on release) ---
  let moved = false;
  img.addEventListener('mousedown', (e) => {
    e.preventDefault();
    moved = false;
    let lastX = e.clientX;
    let lastY = e.clientY;
    const move = (ev: MouseEvent) => {
      const dx = ev.clientX - lastX;
      const dy = ev.clientY - lastY;
      if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
      tx += dx;
      ty += dy;
      lastX = ev.clientX;
      lastY = ev.clientY;
      apply();
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  });

  // --- touch: one finger pans, two fingers pinch-zoom (focal = midpoint) ---
  let pinchDist = 0;
  let pinchBase = 1;
  let focalX = 0;
  let focalY = 0;
  let touchX = 0;
  let touchY = 0;
  root.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length === 2) {
        const [a, b] = [e.touches[0], e.touches[1]];
        pinchDist = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
        pinchBase = scale;
        focalX = (a.clientX + b.clientX) / 2;
        focalY = (a.clientY + b.clientY) / 2;
      } else if (e.touches.length === 1) {
        touchX = e.touches[0].clientX;
        touchY = e.touches[0].clientY;
      }
    },
    { passive: false },
  );
  root.addEventListener(
    'touchmove',
    (e) => {
      e.preventDefault();
      if (e.touches.length === 2 && pinchDist > 0) {
        const [a, b] = [e.touches[0], e.touches[1]];
        const d = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
        const prev = scale;
        scale = clamp(pinchBase * (d / pinchDist), MIN_SCALE, MAX_SCALE);
        const k = scale / prev;
        tx = focalX - k * (focalX - tx);
        ty = focalY - k * (focalY - ty);
        apply();
      } else if (e.touches.length === 1) {
        const t = e.touches[0];
        tx += t.clientX - touchX;
        ty += t.clientY - touchY;
        touchX = t.clientX;
        touchY = t.clientY;
        apply();
      }
    },
    { passive: false },
  );

  // double-click / double-tap resets to fit
  img.addEventListener('dblclick', (e) => {
    e.preventDefault();
    fit();
  });

  // close: backdrop click (not the end of a pan), close button, or Esc
  root.addEventListener('click', (e) => {
    if (e.target === root && !moved) closeLightbox();
  });
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeLightbox();
  });
  keyHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') closeLightbox();
  };
  window.addEventListener('keydown', keyHandler);

  document.body.appendChild(root);
}
