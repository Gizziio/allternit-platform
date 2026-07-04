/**
 * HyperFrames timeline data model — ported from nexu-io/open-design.
 *
 * Provides a lightweight keyframe/timeline model for HTML-to-MP4 motion
 * graphics. Each track targets a CSS selector and animates properties over
 * time. The model is scaffolding for a future full HyperFrames renderer.
 */

export interface Keyframe {
  time: number; // milliseconds
  properties: Record<string, string | number>;
  easing?: string;
}

export interface Track {
  id: string;
  selector: string;
  property: string;
  keyframes: Keyframe[];
}

export interface HyperFrameTimeline {
  id: string;
  name: string;
  durationMs: number;
  fps: number;
  width: number;
  height: number;
  tracks: Track[];
}

export function createEmptyTimeline(name = 'Untitled'): HyperFrameTimeline {
  return {
    id: `timeline-${Date.now()}`,
    name,
    durationMs: 3000,
    fps: 30,
    width: 1920,
    height: 1080,
    tracks: [],
  };
}

export function addTrack(timeline: HyperFrameTimeline, selector: string, property: string): HyperFrameTimeline {
  const track: Track = {
    id: `track-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    selector,
    property,
    keyframes: [
      { time: 0, properties: { [property]: property === 'opacity' ? 0 : 0 } },
      { time: timeline.durationMs, properties: { [property]: property === 'opacity' ? 1 : 100 } },
    ],
  };
  return { ...timeline, tracks: [...timeline.tracks, track] };
}

export function updateTrack(timeline: HyperFrameTimeline, trackId: string, updates: Partial<Track>): HyperFrameTimeline {
  return {
    ...timeline,
    tracks: timeline.tracks.map((t) => (t.id === trackId ? { ...t, ...updates } : t)),
  };
}

export function removeTrack(timeline: HyperFrameTimeline, trackId: string): HyperFrameTimeline {
  return { ...timeline, tracks: timeline.tracks.filter((t) => t.id !== trackId) };
}

export function updateKeyframe(timeline: HyperFrameTimeline, trackId: string, index: number, keyframe: Keyframe): HyperFrameTimeline {
  return {
    ...timeline,
    tracks: timeline.tracks.map((t) =>
      t.id === trackId
        ? { ...t, keyframes: t.keyframes.map((k, i) => (i === index ? keyframe : k)) }
        : t,
    ),
  };
}

export function duplicateKeyframe(timeline: HyperFrameTimeline, trackId: string, index: number): HyperFrameTimeline {
  const track = timeline.tracks.find((t) => t.id === trackId);
  if (!track) return timeline;
  const keyframe = track.keyframes[index];
  if (!keyframe) return timeline;
  const newKeyframe: Keyframe = {
    ...keyframe,
    time: Math.min(keyframe.time + 250, timeline.durationMs),
  };
  return {
    ...timeline,
    tracks: timeline.tracks.map((t) =>
      t.id === trackId
        ? { ...t, keyframes: [...t.keyframes.slice(0, index + 1), newKeyframe, ...t.keyframes.slice(index + 1)] }
        : t,
    ),
  };
}

export function removeKeyframe(timeline: HyperFrameTimeline, trackId: string, index: number): HyperFrameTimeline {
  return {
    ...timeline,
    tracks: timeline.tracks.map((t) =>
      t.id === trackId
        ? { ...t, keyframes: t.keyframes.filter((_, i) => i !== index) }
        : t,
    ),
  };
}

function cssPropertyName(property: string): string {
  return property;
}

function cssValue(property: string, value: string | number): string {
  if (property === 'opacity') return String(value);
  if (property === 'transform') return String(value);
  if (typeof value === 'number') return `${value}px`;
  return String(value);
}

function keyframePercent(time: number, durationMs: number): number {
  if (durationMs <= 0) return 0;
  return Math.round((time / durationMs) * 1000) / 10;
}

/**
 * Generate a CSS @keyframes rule and animation class for a timeline.
 * The animation targets are applied by class names injected into the artifact.
 */
export function generateTimelineCss(timeline: HyperFrameTimeline): { css: string; classes: Record<string, string> } {
  const classes: Record<string, string> = {};
  const rules: string[] = [];

  for (const track of timeline.tracks) {
    if (track.keyframes.length < 2) continue;
    const animName = `hf-anim-${track.id.replace(/[^a-zA-Z0-9]/g, '-')}`;
    classes[track.selector] = animName;
    const keyframes = track.keyframes
      .map((k) => {
        const pct = keyframePercent(k.time, timeline.durationMs);
        const value = cssValue(track.property, k.properties[track.property] ?? 0);
        return `  ${pct}% { ${cssPropertyName(track.property)}: ${value}; ${k.easing ? `animation-timing-function: ${k.easing};` : ''} }`;
      })
      .join('\n');
    rules.push(`@keyframes ${animName} {\n${keyframes}\n}`);
    rules.push(`.${animName} { animation: ${animName} ${timeline.durationMs}ms linear forwards; }`);
  }

  return { css: rules.join('\n\n'), classes };
}

/**
 * Build an HTML document that wraps the artifact with the timeline CSS/JS
 * and pauses the animation at a specific scrub time (ms).
 */
export function buildPreviewHtml(artifactHtml: string, timeline: HyperFrameTimeline, scrubTimeMs = 0): string {
  const { css, classes } = generateTimelineCss(timeline);
  const classEntries = Object.entries(classes)
    .map(([selector, className]) => `document.querySelectorAll('${selector}').forEach(el => el.classList.add('${className}'));`)
    .join('\n  ');

  const wrapper = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
  ${css}
</style>
</head>
<body>
<div id="hyperframes-root" style="width:100%;height:100%;">
  ${artifactHtml}
</div>
<script>
  (function () {
    ${classEntries}
    const root = document.documentElement;
    if (root) {
      root.style.setProperty('--hyperframes-scrub', '${scrubTimeMs}ms');
    }
    document.querySelectorAll('[style*="animation"], [class*="hf-anim"]').forEach((el) => {
      const animations = el.getAnimations ? el.getAnimations() : [];
      animations.forEach((anim) => {
        anim.currentTime = ${scrubTimeMs};
        anim.pause();
      });
    });
  })();
</script>
</body>
</html>`;
  return wrapper;
}

/**
 * Build an HTML document that plays the timeline from 0 to durationMs and
 * signals readiness via postMessage. Used by the MP4 renderer.
 */
export function buildRenderHtml(artifactHtml: string, timeline: HyperFrameTimeline): string {
  const { css, classes } = generateTimelineCss(timeline);
  const classEntries = Object.entries(classes)
    .map(([selector, className]) => `document.querySelectorAll('${selector}').forEach(el => el.classList.add('${className}'));`)
    .join('\n  ');

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
  ${css}
</style>
</head>
<body>
<div id="hyperframes-root" style="width:100%;height:100%;">
  ${artifactHtml}
</div>
<script>
  (function () {
    ${classEntries}
    document.fonts && document.fonts.ready.then(() => {
      requestAnimationFrame(() => {
        window.parent.postMessage({ type: 'HYPERFRAMES_READY', durationMs: ${timeline.durationMs} }, '*');
      });
    });
  })();
</script>
</body>
</html>`;
}
