"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CaretLeft,
  CaretRight,
  CircleNotch,
  FilmStrip,
  FolderOpen,
  WarningCircle,
  CheckCircle,
  XCircle,
  Robot,
  Wrench,
  VideoCamera,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { listRecordings } from '@/remote-control/api/recordings';
import type { RecordingListItem } from '@/remote-control/api/recordings';
import { getPlatformComputerUseBaseUrl } from '@/integration/computer-use-engine';
import {
  parseRecordingTimelineJsonl,
  frameOffsetSeconds,
  formatOffset,
  frameLabel,
  frameSucceeded,
  buildToolCallTrack,
} from './recording-timeline';
import type { RecordingTimeline, TimelineFrame } from './recording-timeline';

type LoadState = 'idle' | 'loading-list' | 'ready' | 'error';

async function fetchRecordingJsonl(recordingId: string): Promise<string> {
  const base = getPlatformComputerUseBaseUrl().replace(/\/+$/, '');
  const response = await fetch(
    `${base}/v1/computer-use/recordings/${encodeURIComponent(recordingId)}/file`,
  );
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

function gatewayVideoUrl(recordingId: string): string {
  const base = getPlatformComputerUseBaseUrl().replace(/\/+$/, '');
  return `${base}/v1/computer-use/recordings/${encodeURIComponent(recordingId)}/video`;
}

function StatusBadge({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="inline-flex items-center gap-1 text-[11px] text-green-500">
      <CheckCircle size={12} /> ok
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[11px] text-[var(--status-error)]">
      <XCircle size={12} /> error
    </span>
  );
}

function FrameViewer({ frame }: { frame: TimelineFrame }) {
  if (frame.kind === 'tool_call') {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-8 text-center">
        <Wrench size={28} className="text-[var(--text-tertiary)]" />
        <div className="text-lg font-medium">{frame.tool_name || 'tool call'}</div>
        {frame.result_summary && (
          <div className="max-w-xl text-sm text-[var(--text-secondary)]">{frame.result_summary}</div>
        )}
        <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-[var(--text-tertiary)]">
          <span>step {frame.step}</span>
          {frame.latency_ms !== null && <span>{frame.latency_ms} ms</span>}
          {frame.redacted && <span>args redacted</span>}
          {frame.error && <span className="text-[var(--status-error)]">{frame.error}</span>}
        </div>
        {Object.keys(frame.args).length > 0 && (
          <pre className="max-h-40 max-w-xl overflow-auto rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3 text-left text-[11px] text-[var(--text-secondary)]">
            {JSON.stringify(frame.args, null, 2)}
          </pre>
        )}
      </div>
    );
  }
  if (frame.screenshot_data_url) {
    return (
      <img
        src={frame.screenshot_data_url}
        alt={`Step ${frame.step}: ${frame.action_type}`}
        className="h-full w-full object-contain"
      />
    );
  }
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-8 text-center">
      <Robot size={28} className="text-[var(--text-tertiary)]" />
      <div className="text-lg font-medium">{frame.action_type || 'action'}</div>
      {frame.action_target && (
        <div className="text-sm text-[var(--text-secondary)]">{frame.action_target}</div>
      )}
      <div className="text-xs text-[var(--text-tertiary)]">no screenshot captured for this step</div>
    </div>
  );
}

export function AciRecordingTimelineView() {
  const [recordings, setRecordings] = useState<RecordingListItem[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [listError, setListError] = useState<string | null>(null);
  const [selectedRecordingId, setSelectedRecordingId] = useState<string>('');
  const [timeline, setTimeline] = useState<RecordingTimeline | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loadingRecording, setLoadingRecording] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const revokeVideo = useCallback(() => {
    setVideoSrc((current) => {
      if (current?.startsWith('blob:')) URL.revokeObjectURL(current);
      return null;
    });
  }, []);

  useEffect(() => revokeVideo, [revokeVideo]);

  useEffect(() => {
    let cancelled = false;
    setLoadState('loading-list');
    listRecordings()
      .then((items) => {
        if (cancelled) return;
        setRecordings(items);
        setLoadState('ready');
        if (items.length > 0) setSelectedRecordingId(items[0].recording_id);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setListError(error instanceof Error ? error.message : String(error));
        setLoadState('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadText = useCallback((text: string) => {
    setRecordingError(null);
    try {
      setTimeline(parseRecordingTimelineJsonl(text));
      setSelectedIndex(0);
    } catch (error) {
      setTimeline(null);
      setRecordingError(error instanceof Error ? error.message : String(error));
    }
  }, []);

  const loadRecording = useCallback(
    async (recordingId: string) => {
      if (!recordingId) return;
      setLoadingRecording(true);
      setRecordingError(null);
      try {
        loadText(await fetchRecordingJsonl(recordingId));
        revokeVideo();
        // Point the video pane at the gateway artifact (when the gateway
        // serves one); the <video> onError handler falls back to
        // screenshot mode if the route 404s.
        setVideoSrc(gatewayVideoUrl(recordingId));
      } catch (error) {
        setRecordingError(error instanceof Error ? error.message : String(error));
      } finally {
        setLoadingRecording(false);
      }
    },
    [loadText, revokeVideo],
  );

  const handleFile = useCallback(
    (file: File) => {
      revokeVideo();
      setLoadingRecording(true);
      file
        .text()
        .then(loadText)
        .catch((error: unknown) => {
          setRecordingError(error instanceof Error ? error.message : String(error));
        })
        .finally(() => setLoadingRecording(false));
    },
    [loadText, revokeVideo],
  );

  const handleVideoFile = useCallback((file: File) => {
    setVideoSrc((current) => {
      if (current?.startsWith('blob:')) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
  }, []);

  // Bidirectional scrubbing: keep the strip thumb and the track row for the
  // selected frame scrolled into view.
  useEffect(() => {
    if (!timeline) return;
    const thumb = stripRef.current?.querySelector(`[data-frame-index="${selectedIndex}"]`);
    thumb?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const row = trackRef.current?.querySelector(`[data-frame-index="${selectedIndex}"]`);
    row?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex, timeline]);

  const offsets = useMemo(() => {
    if (!timeline) return [];
    const start = timeline.manifest?.started_at ?? '';
    return timeline.frames.map((frame) => frameOffsetSeconds(start, frame.timestamp));
  }, [timeline]);

  // Video-aligned track: offsets are relative to the video start epoch when
  // the manifest carries one, else to the recording start.
  const track = useMemo(
    () =>
      timeline
        ? buildToolCallTrack(
            timeline.frames,
            timeline.manifest?.video_start_epoch ?? null,
            timeline.manifest?.started_at,
          )
        : [],
    [timeline],
  );

  const selectFrame = useCallback(
    (index: number) => {
      setSelectedIndex(index);
      const entry = track.find((candidate) => candidate.index === index);
      const video = videoRef.current;
      if (video && entry) video.currentTime = entry.offsetMs / 1000;
    },
    [track],
  );

  // Video → track direction: highlight the nearest track entry as playback
  // scrubs. Selection changes scroll the strip/track into view via the
  // existing effect.
  const handleVideoTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video || track.length === 0) return;
    const ms = video.currentTime * 1000;
    let nearest = track[0];
    for (const entry of track) {
      if (Math.abs(entry.offsetMs - ms) < Math.abs(nearest.offsetMs - ms)) nearest = entry;
    }
    setSelectedIndex((current) => (current === nearest.index ? current : nearest.index));
  }, [track]);

  const stepTo = useCallback(
    (delta: number) => {
      if (!timeline) return;
      setSelectedIndex((i) => Math.min(timeline.frames.length - 1, Math.max(0, i + delta)));
    },
    [timeline],
  );

  const selectedFrame = timeline?.frames[selectedIndex] ?? null;

  return (
    <div className="h-full w-full overflow-auto bg-[var(--bg-elevated)] text-[var(--text-primary)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-8 pb-12 pt-10">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-medium tracking-tight" style={{ fontFamily: 'var(--font-serif)' }}>
            Recording Timeline
          </h1>
          <div className="flex shrink-0 items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".jsonl,.json,.txt"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) handleFile(file);
                event.target.value = '';
              }}
            />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <FolderOpen size={14} />
              Open JSONL…
            </Button>
            <input
              ref={videoInputRef}
              type="file"
              accept="video/webm,video/mp4,video/*,.webm,.mp4,.mov"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) handleVideoFile(file);
                event.target.value = '';
              }}
            />
            <Button variant="outline" onClick={() => videoInputRef.current?.click()}>
              <VideoCamera size={14} />
              Open video…
            </Button>
            <Button
              onClick={() => loadRecording(selectedRecordingId)}
              disabled={!selectedRecordingId || loadingRecording}
            >
              {loadingRecording ? <CircleNotch size={14} className="animate-spin" /> : <FilmStrip size={14} />}
              Load
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs text-[var(--text-secondary)]" htmlFor="aci-recording-select">
            Recording
          </label>
          <select
            id="aci-recording-select"
            value={selectedRecordingId}
            onChange={(event) => setSelectedRecordingId(event.target.value)}
            disabled={recordings.length === 0}
            className="min-w-64 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 py-1.5 text-sm text-[var(--text-primary)]"
          >
            {recordings.length === 0 && <option value="">(no recordings on gateway)</option>}
            {recordings.map((recording) => (
              <option key={recording.recording_id} value={recording.recording_id}>
                {recording.task || recording.recording_id} — {recording.started_at}
              </option>
            ))}
          </select>
          {loadState === 'loading-list' && (
            <span className="inline-flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
              <CircleNotch size={12} className="animate-spin" /> listing recordings…
            </span>
          )}
          {listError && (
            <span className="inline-flex items-center gap-1 text-xs text-[var(--status-error)]">
              <WarningCircle size={12} /> gateway unreachable — use “Open JSONL…” to load a local file
            </span>
          )}
        </div>

        {recordingError && (
          <div className="flex items-center gap-2 rounded-md border border-[var(--status-error)] px-3 py-2 text-sm text-[var(--status-error)]">
            <WarningCircle size={14} /> {recordingError}
          </div>
        )}

        {!timeline && !recordingError && (
          <div className="rounded-md border border-dashed border-[var(--border-subtle)] px-6 py-16 text-center text-sm text-[var(--text-tertiary)]">
            Pick a recording from the gateway list or open a local recording JSONL to scrub through its
            frames.
          </div>
        )}

        {timeline && (
          <>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-[var(--text-secondary)]">
              <span className="font-medium text-[var(--text-primary)]">
                {timeline.manifest?.task || 'Untitled recording'}
              </span>
              {timeline.manifest && <span>{timeline.manifest.recording_id}</span>}
              {timeline.manifest && <span>status: {timeline.manifest.status}</span>}
              <span>{timeline.frames.length} frames</span>
              <span>{timeline.toolCalls.length} tool calls</span>
              {videoSrc && (
                <span className="inline-flex items-center gap-1 text-[var(--accent-primary)]">
                  <VideoCamera size={11} /> video
                  {timeline.manifest?.video_start_epoch
                    ? ' (epoch-aligned)'
                    : timeline.manifest?.started_at
                      ? ' (start-aligned)'
                      : ''}
                </span>
              )}
              {timeline.toolCalls.length === 0 && (
                <span className="text-[var(--text-tertiary)]">classic action-only recording</span>
              )}
              {timeline.parse_errors > 0 && (
                <span className="text-[var(--status-error)]">{timeline.parse_errors} unparseable lines</span>
              )}
            </div>

            {timeline.frames.length === 0 ? (
              <div className="rounded-md border border-dashed border-[var(--border-subtle)] px-6 py-16 text-center text-sm text-[var(--text-tertiary)]">
                This recording has no frames yet.
              </div>
            ) : (
              <>
                {/* Scrubbable frame strip */}
                <div
                  ref={stripRef}
                  className="flex gap-2 overflow-x-auto rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-2"
                >
                  {timeline.frames.map((frame, index) => (
                    <button
                      key={index}
                      type="button"
                      data-frame-index={index}
                      onClick={() => selectFrame(index)}
                      className={cn(
                        'flex w-28 shrink-0 flex-col gap-1 rounded-md border p-1 text-left',
                        index === selectedIndex
                          ? 'border-[var(--accent-primary)] ring-1 ring-[var(--accent-primary)]'
                          : 'border-[var(--border-subtle)] hover:border-[var(--border-strong)]',
                      )}
                    >
                      <div className="flex h-16 w-full items-center justify-center overflow-hidden rounded-sm bg-black">
                        {frame.kind === 'action' && frame.screenshot_data_url ? (
                          <img
                            src={frame.screenshot_data_url}
                            alt=""
                            className="h-full w-full object-cover object-left-top"
                          />
                        ) : (
                          <Wrench size={16} className="text-[var(--text-tertiary)]" />
                        )}
                      </div>
                      <div className="flex items-center justify-between px-0.5 text-[10px] text-[var(--text-tertiary)]">
                        <span>#{frame.step}</span>
                        <span>{formatOffset(offsets[index])}</span>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Current frame + step controls */}
                <div className="flex items-stretch gap-3">
                  <div className="flex flex-col justify-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Previous frame"
                      disabled={selectedIndex === 0}
                      onClick={() => stepTo(-1)}
                    >
                      <CaretLeft size={14} />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Next frame"
                      disabled={selectedIndex >= timeline.frames.length - 1}
                      onClick={() => stepTo(1)}
                    >
                      <CaretRight size={14} />
                    </Button>
                  </div>
                  <div className="min-h-72 flex-1 overflow-hidden rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)]">
                    {videoSrc ? (
                      <video
                        ref={videoRef}
                        src={videoSrc}
                        controls
                        className="h-full max-h-[28rem] w-full bg-black object-contain"
                        onTimeUpdate={handleVideoTimeUpdate}
                        onError={() => revokeVideo()}
                      />
                    ) : (
                      selectedFrame && <FrameViewer frame={selectedFrame} />
                    )}
                  </div>
                </div>

                {/* Tool-call / action track */}
                <div ref={trackRef} className="max-h-72 overflow-y-auto rounded-md border border-[var(--border-subtle)]">
                  {timeline.frames.map((frame, index) => (
                    <button
                      key={index}
                      type="button"
                      data-frame-index={index}
                      onClick={() => selectFrame(index)}
                      className={cn(
                        'flex w-full items-center gap-3 border-b border-[var(--border-subtle)] px-3 py-2 text-left text-sm last:border-b-0',
                        index === selectedIndex
                          ? 'bg-[var(--surface-hover)]'
                          : 'hover:bg-[var(--bg-primary)]',
                      )}
                    >
                      <span className="w-10 shrink-0 text-[11px] text-[var(--text-tertiary)]">
                        {formatOffset(offsets[index])}
                      </span>
                      {frame.kind === 'tool_call' ? (
                        <Wrench size={13} className="shrink-0 text-[var(--text-secondary)]" />
                      ) : (
                        <Robot size={13} className="shrink-0 text-[var(--text-secondary)]" />
                      )}
                      <span className="flex-1 truncate">
                        {frameLabel(frame)}
                        {frame.kind === 'tool_call' && frame.redacted && (
                          <span className="ml-2 text-[10px] text-[var(--text-tertiary)]">(redacted)</span>
                        )}
                      </span>
                      <span className="w-16 shrink-0 text-right text-[11px] text-[var(--text-tertiary)]">
                        step {frame.step}
                      </span>
                      <span className="w-14 shrink-0 text-right">
                        <StatusBadge ok={frameSucceeded(frame)} />
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
