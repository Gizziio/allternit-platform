"use client";
import React, { useState } from 'react';
import { Plus, Trash, VideoCamera } from '@phosphor-icons/react';
import { createEmptyTimeline, addTrack, updateTrack, removeTrack, updateKeyframe, type HyperFrameTimeline, type Track } from '../../lib/design/hyperframes-timeline';

interface HyperFramesTimelineEditorProps {
  projectId?: string;
  initialTimeline?: HyperFrameTimeline;
  onChange?: (timeline: HyperFrameTimeline) => void;
}

export function HyperFramesTimelineEditor({ projectId, initialTimeline, onChange }: HyperFramesTimelineEditorProps) {
  const [timeline, setTimeline] = useState<HyperFrameTimeline>(initialTimeline ?? createEmptyTimeline());
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null);

  function update(next: HyperFrameTimeline) {
    setTimeline(next);
    onChange?.(next);
  }

  function addNewTrack() {
    update(addTrack(timeline, '.hero', 'opacity'));
  }

  const track = timeline.tracks.find((t) => t.id === selectedTrack);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-primary)', padding: 16, gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <VideoCamera size={18} color="var(--accent-primary)" weight="bold" />
          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>HyperFrames Timeline</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{projectId ? `[${projectId}] ` : ''}{timeline.durationMs}ms · {timeline.fps}fps · {timeline.width}×{timeline.height}</div>
      </div>

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

        <div style={{ flex: 1, border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 16, overflow: 'auto' }}>
          {track ? (
            <TrackEditor timeline={timeline} track={track} onUpdate={update} />
          ) : (
            <div style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Select a track to edit keyframes.</div>
          )}
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

      <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)' }}>Keyframes</div>
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
        </div>
      ))}
    </div>
  );
}
