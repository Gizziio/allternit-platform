/**
 * Animation engine for design sessions.
 * Ported from alchaincyf/huashu-design animations.jsx
 *
 * Exports:
 * - ANIMATION_ENGINE_SCRIPT   — the full IIFE as a <script> string, mounts on window.Animations
 * - getAnimationSystemPromptBlock() — directive for the studio system prompt
 *
 * Usage in generated HTML:
 *   <!-- React + Babel must already be loaded -->
 *   <script src="...react..."></script>
 *   <script>/* ANIMATION_ENGINE_SCRIPT injected here *\/</script>
 *   <script type="text/babel">
 *     const { Stage, Sprite, Easing, interpolate } = window.Animations;
 *     // ...
 *   </script>
 */

export const ANIMATION_ENGINE_SCRIPT = `(function() {
  const { createContext, useContext, useState, useEffect, useRef, useCallback } = React;

  const TimeContext = createContext({ time: 0, duration: 10, playing: false });
  const SpriteContext = createContext(null);

  const Easing = {
    linear: t => t,
    easeIn: t => t * t,
    easeOut: t => 1 - (1 - t) * (1 - t),
    easeInOut: t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
    expoOut: t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
    overshoot: t => {
      const c1 = 1.70158, c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
    spring: t => {
      const c = (2 * Math.PI) / 3;
      return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c) + 1;
    },
    anticipation: t => {
      if (t < 0.2) return -0.3 * (t / 0.2) * (t / 0.2);
      const adjusted = (t - 0.2) / 0.8;
      return -0.012 + 1.012 * adjusted * adjusted * (3 - 2 * adjusted);
    },
  };

  function interpolate(t, input, output, easing) {
    const [inStart, inEnd] = input;
    const [outStart, outEnd] = output;
    if (t <= inStart) return outStart;
    if (t >= inEnd) return outEnd;
    let progress = (t - inStart) / (inEnd - inStart);
    if (easing) progress = easing(progress);
    return outStart + (outEnd - outStart) * progress;
  }

  function useTime() {
    return useContext(TimeContext).time;
  }

  function useSprite() {
    const sprite = useContext(SpriteContext);
    if (!sprite) return { t: 0, elapsed: 0, duration: 0 };
    return sprite;
  }

  const stageStyles = {
    wrapper: { position: 'fixed', inset: 0, background: '#000', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-sans)' },
    stageHolder: { flex: 1, position: 'relative', overflow: 'hidden' },
    canvas: { position: 'absolute', top: '50%', left: '50%', transformOrigin: 'center center', background: '#111', overflow: 'hidden' },
    controls: { position: 'fixed', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 16, color: '#fff', fontSize: 12, zIndex: 100 },
    button: { background: 'none', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', padding: '6px 14px', borderRadius: 4, cursor: 'pointer', fontSize: 12 },
    timeDisplay: { fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', minWidth: 90 },
    scrubber: { flex: 1, height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 2, position: 'relative', cursor: 'pointer' },
    scrubberFill: { position: 'absolute', top: 0, left: 0, height: '100%', background: '#fff', borderRadius: 2, pointerEvents: 'none' },
    scrubberHandle: { position: 'absolute', top: '50%', width: 12, height: 12, background: '#fff', borderRadius: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none' },
  };

  function Stage({ duration = 10, width = 1920, height = 1080, fps = 60, loop = true, children, bgColor = '#fff' }) {
    const [time, setTime] = useState(0);
    const [playing, setPlaying] = useState(true);
    const [scale, setScale] = useState(1);
    const rafRef = useRef(null);

    const effectiveLoop = (typeof window !== 'undefined' && window.__recording) ? false : loop;

    useEffect(() => {
      function updateScale() {
        const vw = window.innerWidth;
        const vh = window.innerHeight - 56;
        setScale(Math.min(vw / width, vh / height));
      }
      updateScale();
      window.addEventListener('resize', updateScale);
      return () => window.removeEventListener('resize', updateScale);
    }, [width, height]);

    useEffect(() => {
      if (!playing) return;
      let cancelled = false;
      let last = null;
      function tick(now) {
        if (cancelled) return;
        if (last === null) {
          last = now;
          if (typeof window !== 'undefined') window.__ready = true;
        }
        const delta = (now - last) / 1000;
        last = now;
        setTime(prev => {
          const next = prev + delta;
          if (next >= duration) return effectiveLoop ? 0 : duration - 0.001;
          return next;
        });
        rafRef.current = requestAnimationFrame(tick);
      }
      const startAfterFonts = () => {
        if (cancelled) return;
        rafRef.current = requestAnimationFrame(tick);
      };
      if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
        document.fonts.ready.then(startAfterFonts);
      } else {
        startAfterFonts();
      }
      return () => { cancelled = true; cancelAnimationFrame(rafRef.current); };
    }, [playing, duration, effectiveLoop]);

    const handleSeek = useCallback((e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      setTime(Math.max(0, Math.min(duration, ratio * duration)));
      setPlaying(false);
    }, [duration]);

    const progress = time / duration;
    const ctx = { time, duration, playing, setPlaying, setTime };
    const canvasStyle = { ...stageStyles.canvas, width, height, background: bgColor, transform: \`translate(-50%, -50%) scale(\${scale})\` };

    return (
      React.createElement(TimeContext.Provider, { value: ctx },
        React.createElement('div', { style: stageStyles.wrapper },
          React.createElement('div', { style: stageStyles.stageHolder },
            React.createElement('div', { style: canvasStyle }, children)
          ),
          React.createElement('div', { style: stageStyles.controls },
            React.createElement('button', { style: stageStyles.button, onClick: () => setPlaying(p => !p) }, playing ? '⏸ Pause' : '▶ Play'),
            React.createElement('button', { style: stageStyles.button, onClick: () => setTime(0) }, '⏮ Start'),
            React.createElement('div', { style: stageStyles.timeDisplay }, time.toFixed(2) + 's / ' + duration.toFixed(2) + 's'),
            React.createElement('div', { style: stageStyles.scrubber, onMouseDown: handleSeek },
              React.createElement('div', { style: { ...stageStyles.scrubberFill, width: (progress * 100) + '%' } }),
              React.createElement('div', { style: { ...stageStyles.scrubberHandle, left: (progress * 100) + '%' } })
            )
          )
        )
      )
    );
  }

  function Sprite({ start = 0, end, children, style }) {
    const { time } = useContext(TimeContext);
    const actualEnd = end == null ? Infinity : end;
    if (time < start || time >= actualEnd) return null;
    const duration = actualEnd - start;
    const elapsed = time - start;
    const t = duration === 0 ? 1 : Math.max(0, Math.min(1, elapsed / duration));
    const spriteValue = { t, elapsed, duration, start, end: actualEnd };
    return (
      React.createElement(SpriteContext.Provider, { value: spriteValue },
        React.createElement('div', { style: { position: 'absolute', inset: 0, ...style } }, children)
      )
    );
  }

  if (typeof window !== 'undefined') {
    window.Animations = { Stage, Sprite, useTime, useSprite, Easing, interpolate };
  }
})();`;

export function getAnimationSystemPromptBlock(): string {
  return `## Animation sessions

When the user requests an animated design (motion graphics, animated infographic, video export), use the \`window.Animations\` engine already loaded in the page:

\`\`\`js
const { Stage, Sprite, Easing, interpolate } = window.Animations;
\`\`\`

**Stage** props: \`duration\` (seconds), \`width\`, \`height\`, \`loop\`, \`bgColor\`
**Sprite** props: \`start\` (seconds), \`end\` (seconds), \`style\`
- A Sprite renders only while \`time >= start && time < end\`
- Inside a Sprite, call \`useSprite()\` to get \`{ t: 0→1, elapsed, duration }\`

**Easing functions**: \`linear\`, \`easeIn\`, \`easeOut\`, \`easeInOut\`, \`expoOut\`, \`overshoot\`, \`spring\`, \`anticipation\`

**interpolate(t, [inStart, inEnd], [outStart, outEnd], easing?)**: maps a time value to an output range.

**Rules for animation sessions:**
1. Always wrap in a \`<Stage>\` with explicit \`duration\` and canvas dimensions
2. Prefer \`expoOut\` for entrances, \`easeInOut\` for transitions, \`spring\` for bouncy UI elements
3. Stagger text reveals: each word/line offset by 0.1–0.15s
4. The playback bar is built-in — do not add your own controls
5. Export-ready: the engine honors \`window.__recording\` for frame-accurate video export`;
}
