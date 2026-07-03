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
