"use client";
import React, { useEffect, useRef, useState } from 'react';
import { Plus, Trash, VideoCamera, Play, Pause, Export, Warning } from '@phosphor-icons/react';
import {
  createEmptyTimeline, addTrack, updateTrack, removeTrack, updateKeyframe,
  duplicateKeyframe, removeKeyframe, buildPreviewHtml, buildRenderHtml,
  type HyperFrameTimeline, type Track,
} from '../../lib/design/hyperframes-timeline';
import { exportMp4FromIframe, downloadMp4 } from '../../lib/design/hyperframes-export';

interface HyperFramesTimelineEditorProps {
  projectId?: string;
  initialTimeline?: HyperFrameTimeline;
  artifactHtml?: string;
  onChange?: (timeline: HyperFrameTimeline) => void;
}

export function HyperFramesTimelineEditor({ projectId, initialTimeline, artifactHtml, onChange }: HyperFramesTimelineEditorProps) {
  const [timeline, setTimeline] = useState<HyperFrameTimeline>(initialTimeline ?? createEmptyTimeline());
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null);
  const [scrubMs, setScrubMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const previewIframeRef = useRef<HTMLIFrameElement>(null);
  const playStartRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  function update(next: HyperFrameTimeline) {
    setTimeline(next);
    onChange?.(next);
  }

  function addNewTrack() {
    update(addTrack(timeline, '.hero', 'opacity'));
  }

  const track = timeline.tracks.find((t) => t.id === selectedTrack);
  const hasArtifact = Boolean(artifactHtml && artifactHtml.trim().length > 0);

  // Refresh preview when timeline, artifact, or scrub changes.
  useEffect(() => {
    if (!previewIframeRef.current || !hasArtifact) return;
    previewIframeRef.current.srcdoc = buildPreviewHtml(artifactHtml!, timeline, scrubMs);
  }, [timeline, artifactHtml, scrubMs, hasArtifact]);

  // Playback loop.
  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    playStartRef.current = performance.now() - scrubMs;
    function tick() {
      const elapsed = performance.now() - playStartRef.current;
      const next = Math.min(elapsed, timeline.durationMs);
      setScrubMs(next);
      if (next >= timeline.durationMs) {
        setIsPlaying(false);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, timeline.durationMs, scrubMs]);

  async function renderMp4() {
    if (!previewIframeRef.current || !hasArtifact) return;
    setIsRendering(true);
    try {
      previewIframeRef.current.srcdoc = buildRenderHtml(artifactHtml!, timeline);
      // Wait for the render document to signal readiness via postMessage.
      await new Promise<void>((resolve) => {
        function onMessage(e: MessageEvent) {
          if (e.data?.type === 'HYPERFRAMES_READY') {
            window.removeEventListener('message', onMessage);
            resolve();
          }
        }
        window.addEventListener('message', onMessage);
        setTimeout(() => {
          window.removeEventListener('message', onMessage);
          resolve();
        }, 3000);
      });
      const blob = await exportMp4FromIframe({ iframe: previewIframeRef.current, durationMs: timeline.durationMs, fps: timeline.fps });
      downloadMp4(blob, `hyperframes-${projectId ?? 'untitled'}.webm`);
    } finally {
      setIsRendering(false);
      setScrubMs(0);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-primary)', padding: 16, gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <VideoCamera size={18} color="var(--accent-primary)" weight="bold" />
          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>HyperFrames Timeline</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{projectId ? `[${projectId}] ` : ''}{timeline.durationMs}ms · {timeline.fps}fps · {timeline.width}×{timeline.height}</div>
          <button
            type="button"
            onClick={renderMp4}
            disabled={!hasArtifact || isRendering}
            title="Render MP4"
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8,
              border: '1px solid var(--border-subtle)', background: hasArtifact && !isRendering ? 'var(--accent-primary)' : 'var(--surface-hover)',
              color: hasArtifact && !isRendering ? '#fff' : 'var(--text-tertiary)', fontSize: 12, fontWeight: 700,
              cursor: hasArtifact && !isRendering ? 'pointer' : 'default',
            }}
          >
            <Export size={13} /> {isRendering ? 'Rendering…' : 'Render'}
          </button>
        </div>
      </div>

      {!hasArtifact && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 8, background: 'rgba(234,179,8,0.12)' }}>
          <Warning size={14} color="#eab308" weight="fill" />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Generate a design artifact first to preview and render HyperFrames.</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, flex: 1, overflow: 'hidden' }}>
        <div style={{ width: 260, border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 12, overflow: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)' }}>Tracks</span>
            <button type="button" onClick={addNewTrack} style={{ width: 22, height: 22, borderRadius: 5, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <Plus size={14} weight="bold" />
            </button>
          </div>
          {timeline.tracks.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>No tracks yet.</div>}
          {timeline.tracks.map((t) => (
            <div
              key={t.id}
              onClick={() => setSelectedTrack(t.id)}
              style={{
                padding: '8px 10px', borderRadius: 8, marginBottom: 6, cursor: 'pointer',
                background: selectedTrack === t.id ? 'var(--surface-hover)' : 'transparent',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{t.selector}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{t.property}</div>
            </div>
          ))}
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          <div style={{ flex: 1, border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden', position: 'relative', background: '#000' }}>
            {hasArtifact ? (
              <iframe
                ref={previewIframeRef}
                srcDoc={buildPreviewHtml(artifactHtml!, timeline, scrubMs)}
                sandbox="allow-scripts allow-same-origin"
                title="HyperFrames preview"
                style={{ width: '100%', height: '100%', border: 'none' }}
              />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
                No artifact to preview
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid var(--border-subtle)', borderRadius: 12, background: 'var(--surface-panel)' }}>
            <button
              type="button"
              onClick={() => setIsPlaying((p) => !p)}
              disabled={!hasArtifact}
              style={{
                width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border-subtle)',
                background: hasArtifact ? 'var(--accent-primary)' : 'var(--surface-hover)',
                color: hasArtifact ? '#fff' : 'var(--text-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: hasArtifact ? 'pointer' : 'default',
              }}
            >
              {isPlaying ? <Pause size={14} weight="fill" /> : <Play size={14} weight="fill" />}
            </button>
            <input
              aria-label="Scrub"
              type="range"
              min={0}
              max={timeline.durationMs}
              step={10}
              value={scrubMs}
              onChange={(e) => {
                setIsPlaying(false);
                setScrubMs(Number(e.target.value));
              }}
              disabled={!hasArtifact}
              style={{ flex: 1, accentColor: 'var(--accent-primary)' }}
            />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', minWidth: 70, textAlign: 'right' }}>
              {Math.round(scrubMs)}ms
            </span>
          </div>

          <div style={{ flex: '0 0 auto', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 16, overflow: 'auto', maxHeight: 260 }}>
            {track ? (
              <TrackEditor timeline={timeline} track={track} onUpdate={update} />
            ) : (
              <div style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Select a track to edit keyframes.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TrackEditor({ timeline, track, onUpdate }: { timeline: HyperFrameTimeline; track: Track; onUpdate: (t: HyperFrameTimeline) => void }) {
  const [selector, setSelector] = useState(track.selector);
  const [property, setProperty] = useState(track.property);

  function commit() {
    let next = updateTrack(timeline, track.id, { selector, property });
    // Rebuild keyframe properties if property name changed
    next = {
      ...next,
      tracks: next.tracks.map((t) =>
        t.id === track.id
          ? { ...t, keyframes: t.keyframes.map((k) => ({ ...k, properties: { [property]: k.properties[track.property] ?? 0 } })) }
          : t,
      ),
    };
    onUpdate(next);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <input
          value={selector}
          onChange={(e) => setSelector(e.target.value)}
          onBlur={commit}
          placeholder="CSS selector"
          style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 12 }}
        />
        <input
          value={property}
          onChange={(e) => setProperty(e.target.value)}
          onBlur={commit}
          placeholder="Property"
          style={{ width: 140, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 12 }}
        />
        <button
          type="button"
          onClick={() => onUpdate(removeTrack(timeline, track.id))}
          style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'transparent', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        ><Trash size={14} /></button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)' }}>Keyframes</div>
        <button
          type="button"
          onClick={() => onUpdate(duplicateKeyframe(timeline, track.id, track.keyframes.length - 1))}
          disabled={track.keyframes.length === 0}
          style={{
            padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border-subtle)',
            background: 'transparent', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 700,
            cursor: track.keyframes.length === 0 ? 'default' : 'pointer',
          }}
        >
          + Keyframe
        </button>
      </div>
      {track.keyframes.map((k, i) => (
        <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            type="number"
            value={k.time}
            onChange={(e) => {
              const next = updateKeyframe(timeline, track.id, i, { ...k, time: Number(e.target.value) });
              onUpdate(next);
            }}
            style={{ width: 80, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 12 }}
          />
          <input
            value={String(k.properties[property] ?? '')}
            onChange={(e) => {
              const value = property === 'opacity' || property.includes('scale') || property.includes('rotate') ? Number(e.target.value) : e.target.value;
              const next = updateKeyframe(timeline, track.id, i, { ...k, properties: { [property]: value } });
              onUpdate(next);
            }}
            style={{ flex: 1, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 12 }}
          />
          <select
            aria-label="Easing"
            value={k.easing ?? 'linear'}
            onChange={(e) => {
              const next = updateKeyframe(timeline, track.id, i, { ...k, easing: e.target.value });
              onUpdate(next);
            }}
            style={{ width: 110, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 12 }}
          >
            {['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out'].map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => onUpdate(removeKeyframe(timeline, track.id, i))}
            style={{ width: 24, height: 24, borderRadius: 5, border: '1px solid var(--border-subtle)', background: 'transparent', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          ><Trash size={12} /></button>
        </div>
      ))}
    </div>
  );
}
