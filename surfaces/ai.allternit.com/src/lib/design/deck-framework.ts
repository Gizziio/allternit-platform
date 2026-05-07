/**
 * Deck Framework
 *
 * Two skeletons available:
 * - DECK_SKELETON_HTML: simple inline-JS version (lightweight, no web component)
 * - DECK_STAGE_SKELETON_HTML: full <deck-stage> web component (ported from
 *   alchaincyf/huashu-design deck_stage.js) — Shadow DOM, hash nav, print-to-PDF,
 *   keyboard nav, speaker notes postMessage, localStorage persistence
 *
 * The system prompt uses DECK_STAGE_SKELETON_HTML by default.
 */

// Full <deck-stage> web component — ported from alchaincyf/huashu-design
export const DECK_STAGE_SCRIPT = `(function() {
  const STORAGE_KEY_PREFIX = 'deck-stage-slide-';

  class DeckStage extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._currentSlide = 0;
      this._slides = [];
      this._storageKey = STORAGE_KEY_PREFIX + (location.pathname || 'default');
    }

    connectedCallback() {
      this._width = parseInt(this.getAttribute('width')) || 1920;
      this._height = parseInt(this.getAttribute('height')) || 1080;
      this._render();
      const init = () => {
        this._collectSlides();
        this._setupEventListeners();
        this._restoreSlide();
        this._updateDisplay();
        this._setupPrintStyles();
      };
      if (this.ownerDocument.readyState === 'loading') {
        this.ownerDocument.addEventListener('DOMContentLoaded', init, { once: true });
      } else {
        requestAnimationFrame(init);
      }
    }

    _render() {
      this.shadowRoot.innerHTML = \`
        <style>
          :host { display: block; position: fixed; inset: 0; background: #000; overflow: hidden; font-family: 'Allternit Sans', Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          :host([noscale]) .stage { transform: none !important; top: 0 !important; left: 0 !important; }
          .stage { position: absolute; top: 50%; left: 50%; transform-origin: top left; will-change: transform; background: #fff; }
          .slide-wrapper { width: 100%; height: 100%; position: relative; }
          ::slotted(section) { display: none; width: 100%; height: 100%; position: absolute; top: 0; left: 0; overflow: hidden; }
          ::slotted(section.active) { display: block; }
          .counter { position: fixed; bottom: 20px; right: 20px; background: rgba(0,0,0,0.6); color: #fff; padding: 6px 14px; border-radius: 999px; font-size: 13px; font-variant-numeric: tabular-nums; z-index: 100; user-select: none; opacity: 0.6; transition: opacity 0.2s; }
          .counter:hover { opacity: 1; }
          .nav-zone { position: fixed; top: 0; bottom: 0; width: 15%; cursor: pointer; z-index: 50; }
          .nav-zone.left { left: 0; } .nav-zone.right { right: 0; }
          .nav-hint { position: absolute; top: 50%; transform: translateY(-50%); width: 44px; height: 44px; border-radius: 999px; background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.6); display: flex; align-items: center; justify-content: center; font-size: 24px; opacity: 0; transition: opacity 0.2s; }
          .nav-zone.left .nav-hint { left: 20px; } .nav-zone.right .nav-hint { right: 20px; }
          .nav-zone:hover .nav-hint { opacity: 1; }
          @media print {
            :host { position: static; background: #fff; }
            .counter, .nav-zone { display: none !important; }
            .stage { position: static; transform: none !important; page-break-after: always; }
            ::slotted(section) { display: block !important; position: relative !important; page-break-after: always; width: 100%; height: 100%; }
          }
        </style>
        <div class="stage" id="stage" style="width: \${this._width}px; height: \${this._height}px;">
          <div class="slide-wrapper"><slot></slot></div>
        </div>
        <div class="nav-zone left" id="navLeft"><div class="nav-hint">&#8249;</div></div>
        <div class="nav-zone right" id="navRight"><div class="nav-hint">&#8250;</div></div>
        <div class="counter" id="counter">1 / 1</div>
      \`;
    }

    _collectSlides() {
      this._slides = Array.from(this.querySelectorAll(':scope > section'));
      this._slides.forEach((slide, idx) => {
        if (!slide.hasAttribute('data-screen-label')) slide.setAttribute('data-screen-label', String(idx + 1).padStart(2, '0'));
      });
    }

    _setupEventListeners() {
      window.addEventListener('resize', () => this._updateScale());
      document.addEventListener('keydown', (e) => {
        if (e.target.matches('input, textarea, [contenteditable]')) return;
        switch (e.key) {
          case 'ArrowRight': case ' ': case 'PageDown': e.preventDefault(); this.next(); break;
          case 'ArrowLeft': case 'PageUp': e.preventDefault(); this.prev(); break;
          case 'Home': e.preventDefault(); this.goTo(0); break;
          case 'End': e.preventDefault(); this.goTo(this._slides.length - 1); break;
        }
      });
      this.shadowRoot.getElementById('navLeft').addEventListener('click', () => this.prev());
      this.shadowRoot.getElementById('navRight').addEventListener('click', () => this.next());
      window.addEventListener('hashchange', () => this._handleHash());
      if (location.hash) setTimeout(() => this._handleHash(), 0);
    }

    _handleHash() {
      const match = location.hash.match(/^#slide-(\\d+)$/);
      if (match) {
        const idx = parseInt(match[1]) - 1;
        if (idx >= 0 && idx < this._slides.length) this.goTo(idx);
      }
    }

    _restoreSlide() {
      try {
        const stored = localStorage.getItem(this._storageKey);
        if (stored !== null) {
          const idx = parseInt(stored);
          if (idx >= 0 && idx < this._slides.length) this._currentSlide = idx;
        }
      } catch (e) {}
    }

    _saveSlide() {
      try { localStorage.setItem(this._storageKey, String(this._currentSlide)); } catch (e) {}
    }

    _updateScale() {
      if (this.hasAttribute('noscale')) {
        const stage = this.shadowRoot.getElementById('stage');
        stage.style.transform = 'none'; stage.style.top = '0'; stage.style.left = '0'; return;
      }
      const stage = this.shadowRoot.getElementById('stage');
      if (!stage) return;
      const vw = window.innerWidth, vh = window.innerHeight;
      const scale = Math.min(vw / this._width, vh / this._height);
      const offsetX = (vw - this._width * scale) / 2;
      const offsetY = (vh - this._height * scale) / 2;
      stage.style.transform = \`translate(\${offsetX}px, \${offsetY}px) scale(\${scale})\`;
      stage.style.top = '0'; stage.style.left = '0';
    }

    _updateDisplay() {
      this._slides.forEach((slide, idx) => slide.classList.toggle('active', idx === this._currentSlide));
      const counter = this.shadowRoot.getElementById('counter');
      if (counter) counter.textContent = \`\${this._currentSlide + 1} / \${this._slides.length}\`;
      this._updateScale();
      try { window.postMessage({ slideIndexChanged: this._currentSlide, totalSlides: this._slides.length }, '*'); } catch (e) {}
      try { if (window.parent && window.parent !== window) window.parent.postMessage({ slideIndexChanged: this._currentSlide, totalSlides: this._slides.length }, '*'); } catch (e) {}
    }

    _setupPrintStyles() {
      const style = document.createElement('style');
      style.textContent = \`@media print { @page { size: \${this._width}px \${this._height}px; margin: 0; } body { margin: 0; padding: 0; } deck-stage { position: static !important; } deck-stage > section { display: block !important; position: relative !important; width: \${this._width}px !important; height: \${this._height}px !important; page-break-after: always; overflow: hidden; } deck-stage > section:last-child { page-break-after: auto; } }\`;
      document.head.appendChild(style);
    }

    next() { if (this._currentSlide < this._slides.length - 1) { this._currentSlide++; this._saveSlide(); this._updateDisplay(); } }
    prev() { if (this._currentSlide > 0) { this._currentSlide--; this._saveSlide(); this._updateDisplay(); } }
    goTo(idx) { if (idx >= 0 && idx < this._slides.length) { this._currentSlide = idx; this._saveSlide(); this._updateDisplay(); } }
    get currentSlide() { return this._currentSlide; }
    get totalSlides() { return this._slides.length; }
  }

  customElements.define('deck-stage', DeckStage);
  window.DeckStage = DeckStage;
})();`;

// Rich skeleton using the <deck-stage> web component.
// Built via array-join to avoid backtick escaping issues with embedded script.
export const DECK_STAGE_SKELETON_HTML = [
  '<!DOCTYPE html>',
  '<html lang="en">',
  '<head>',
  '<meta charset="UTF-8" />',
  '<meta name="viewport" content="width=device-width, initial-scale=1.0" />',
  '<title>Deck</title>',
  '<style>',
  '  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }',
  '  :root {',
  '    --bg: #0f0d0c; --surface: rgba(255,255,255,0.04); --border: rgba(255,255,255,0.08);',
  '    --fg: #e8e0d8; --muted: rgba(232,224,216,0.5); --accent: #d97757;',
  '  }',
  '  section { background: var(--bg); color: var(--fg); font-family: "Allternit Sans", Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }',
  '</style>',
  '</head>',
  '<body>',
  '<deck-stage>',
  '  <!-- SLIDES GO HERE — each child <section> is one slide -->',
  '  <section>',
  '    <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;width:100%;height:100%;padding:80px;gap:24px;">',
  '      <h1 style="font-size:80px;font-weight:800;letter-spacing:-3px;color:var(--fg);">Title Slide</h1>',
  '      <p style="font-size:32px;color:var(--muted);">Subtitle / tagline</p>',
  '    </div>',
  '  </section>',
  '  <section>',
  '    <div style="display:flex;flex-direction:column;justify-content:center;padding:120px 160px;gap:32px;height:100%;">',
  '      <h2 style="font-size:60px;font-weight:700;letter-spacing:-2px;color:var(--fg);">Slide Two</h2>',
  '      <p style="font-size:28px;color:var(--muted);max-width:900px;line-height:1.5;">Body content. One idea per slide.</p>',
  '    </div>',
  '  </section>',
  '</deck-stage>',
  '<script>',
  DECK_STAGE_SCRIPT,
  '</script>',
  '</body>',
  '</html>',
].join('\n');

export const DECK_SKELETON_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Deck</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #0f0d0c;
    --surface: rgba(255,255,255,0.04);
    --border: rgba(255,255,255,0.08);
    --text: #e8e0d8;
    --muted: rgba(232,224,216,0.5);
    --accent: #6366f1;
    --slide-w: 1920px;
    --slide-h: 1080px;
  }
  html, body { width: 100%; height: 100%; overflow: hidden; background: #111; }
  #stage {
    position: absolute; top: 50%; left: 50%;
    width: var(--slide-w); height: var(--slide-h);
    transform-origin: top left;
  }
  .slide {
    position: absolute; inset: 0;
    display: none;
    background: var(--bg);
    color: var(--text);
    font-family: "Allternit Sans", Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    overflow: hidden;
  }
  .slide.active { display: flex; }
  #nav {
    position: fixed; bottom: 20px; left: 50%;
    transform: translateX(-50%);
    display: flex; gap: 8px; align-items: center;
    background: rgba(15,13,12,0.85);
    border: 1px solid var(--border);
    border-radius: 24px;
    padding: 6px 16px;
    font-size: 13px;
    color: var(--muted);
    z-index: 100;
    backdrop-filter: blur(8px);
  }
  #nav button {
    background: none; border: none; cursor: pointer;
    color: var(--muted); font-size: 16px; line-height: 1;
    padding: 2px 4px; border-radius: 4px;
    transition: color 0.15s;
  }
  #nav button:hover { color: var(--text); }
</style>
</head>
<body>
<div id="stage">
  <!-- SLIDES GO HERE — each is a <div class="slide"> -->
  <!-- Example slide structure:
  <div class="slide active">
    <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;width:100%;height:100%;padding:80px;">
      <h1 style="font-size:72px;font-weight:800;letter-spacing:-2px;">Title</h1>
      <p style="font-size:28px;color:var(--muted);margin-top:24px;">Subtitle</p>
    </div>
  </div>
  -->
</div>
<div id="nav">
  <button id="prev">&#8592;</button>
  <span id="counter">1 / 1</span>
  <button id="next">&#8594;</button>
</div>
<script>
(function () {
  const stage = document.getElementById('stage');
  const counter = document.getElementById('counter');
  const slides = Array.from(stage.querySelectorAll('.slide'));
  let cur = +(localStorage.getItem('deck-slide') || 0);
  if (cur >= slides.length) cur = 0;

  function scale() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const sw = 1920, sh = 1080;
    const s = Math.min(vw / sw, vh / sh);
    stage.style.transform = \`translate(-50%,-50%) scale(\${s})\`;
    stage.style.marginTop = '50vh';
    stage.style.marginLeft = '50vw';
  }

  function show(idx) {
    cur = Math.max(0, Math.min(slides.length - 1, idx));
    slides.forEach((s, i) => s.classList.toggle('active', i === cur));
    counter.textContent = \`\${cur + 1} / \${slides.length}\`;
    localStorage.setItem('deck-slide', cur);
  }

  window.addEventListener('resize', scale);
  scale();
  show(cur);

  document.getElementById('prev').addEventListener('click', () => show(cur - 1));
  document.getElementById('next').addEventListener('click', () => show(cur + 1));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') { e.preventDefault(); show(cur + 1); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); show(cur - 1); }
  });
})();
</script>
</body>
</html>`;

export const DECK_FRAMEWORK_DIRECTIVE = `
## Slide deck rules

You are producing a presentation deck using the \`<deck-stage>\` web component. Follow these rules exactly:

1. **One artifact, always.** Every response that produces or updates slides MUST emit a single \`<artifact type="text/html" identifier="deck" title="Deck">\` block containing the complete updated HTML. Never emit partial slides or diff-style updates.

2. **Use the \`<deck-stage>\` skeleton verbatim.** The output HTML MUST follow this exact structure:
   - \`<deck-stage>\` as the root container (the web component handles scale + nav + keyboard)
   - Each slide is a \`<section>\` direct child of \`<deck-stage>\`
   - The \`<deck-stage>\` script block copied verbatim from the skeleton
   - CSS vars: \`--bg\`, \`--surface\`, \`--border\`, \`--fg\`, \`--muted\`, \`--accent\`

3. **1920 × 1080 canvas.** Each \`<section>\` is 1920 × 1080 px. Design for that canvas. Use \`font-size\` in px, not rem. Headlines ≥ 36px, body ≥ 22px.

4. **Navigation is automatic.** The \`<deck-stage>\` component provides: keyboard nav (←/→/Space/Home/End), click zones left/right, slide counter, localStorage persistence, and hash nav (\`#slide-N\`). Do NOT add your own nav UI.

5. **No external fonts or scripts.** Use only system fonts or fonts specified in the design system. No CDN imports.

6. **Preserve all slides.** When editing or adding a slide, always output ALL existing \`<section>\` elements plus the new/changed one. Never drop slides silently.

7. **Print-to-PDF is built-in.** Cmd+P will print each slide as a separate page at 1920×1080. Do not add any print styles — the component handles them.
`.trim();
