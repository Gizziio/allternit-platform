/**
 * Recording timeline parser — turns a recording JSONL file into a scrubbable
 * timeline model.
 *
 * On-disk format (domains/computer-use/core/core/action_recorder.py):
 *   Line 0:  RecordingManifest   (_type: "manifest")
 *   Lines 1+: RecordedFrame      (classic action frames — no _type field)
 *   Lines 1+: ToolCallFrame      (_type: "tool_call") — site tool calls
 *
 * Both frame shapes are parsed here; recordings that contain zero tool_call
 * frames (the common case today) parse to an empty `toolCalls` list.
 */

export interface RecordingTimelineManifest {
  recording_id: string;
  task: string;
  session_id: string;
  run_id: string;
  started_at: string;
  completed_at: string | null;
  total_steps: number;
  status: string;
  /** Chrome-stream provider video artifact, when one was recorded. */
  video_path: string | null;
  /** Epoch ms when the video started — converts frame timestamps to offsets. */
  video_start_epoch: number | null;
}

export interface TimelineToolCallFrame {
  kind: 'tool_call';
  /** Position in the recording's chronological frame list. */
  index: number;
  step: number;
  timestamp: string;
  tool_name: string;
  args: Record<string, unknown>;
  result_summary: string;
  latency_ms: number | null;
  error: string | null;
  redacted: boolean;
}

export interface TimelineActionFrame {
  kind: 'action';
  index: number;
  step: number;
  timestamp: string;
  action_type: string;
  action_target: string;
  reasoning: string;
  risk_level: string;
  succeeded: boolean;
  /** before-screenshot (after-screenshot fallback) as a renderable data URL. */
  screenshot_data_url: string | null;
}

export type TimelineFrame = TimelineToolCallFrame | TimelineActionFrame;

export interface RecordingTimeline {
  manifest: RecordingTimelineManifest | null;
  frames: TimelineFrame[];
  toolCalls: TimelineToolCallFrame[];
  actions: TimelineActionFrame[];
  /** Number of lines that failed to parse (skipped, never fatal). */
  parse_errors: number;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asEpochOrNull(value: unknown): number | null {
  const num = asNumberOrNull(value);
  return num !== null && num > 0 ? num : null;
}

function toScreenshotDataUrl(before: string, after: string): string | null {
  const raw = before || after;
  if (!raw) return null;
  if (raw.startsWith('data:')) return raw;
  return `data:image/png;base64,${raw}`;
}

function parseManifest(data: Record<string, unknown>): RecordingTimelineManifest {
  return {
    recording_id: asString(data.recording_id),
    task: asString(data.task),
    session_id: asString(data.session_id),
    run_id: asString(data.run_id),
    started_at: asString(data.started_at),
    completed_at: asOptionalString(data.completed_at),
    total_steps: asNumberOrNull(data.total_steps) ?? 0,
    status: asString(data.status, 'unknown'),
    video_path: asOptionalString(data.video_path),
    video_start_epoch: asEpochOrNull(data.video_start_epoch),
  };
}

/**
 * Parse recording JSONL text into a timeline. Throws only when the text has
 * no parseable JSON lines at all; individual bad lines are counted in
 * `parse_errors` and skipped.
 */
export function parseRecordingTimelineJsonl(text: string): RecordingTimeline {
  const frames: TimelineFrame[] = [];
  let manifest: RecordingTimelineManifest | null = null;
  let parseErrors = 0;
  let sawJsonLine = false;

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    let data: Record<string, unknown>;
    try {
      data = asRecord(JSON.parse(trimmed));
    } catch {
      parseErrors += 1;
      continue;
    }
    if (Object.keys(data).length === 0) continue;
    sawJsonLine = true;

    if (data._type === 'manifest' || (manifest === null && data.recording_id !== undefined && data.step === undefined && data.action_type === undefined && data.tool_name === undefined)) {
      if (manifest === null) manifest = parseManifest(data);
      continue;
    }
    if (data._type === 'tool_call') {
      frames.push({
        kind: 'tool_call',
        index: frames.length,
        step: asNumberOrNull(data.step) ?? frames.length + 1,
        timestamp: asString(data.timestamp),
        tool_name: asString(data.tool_name),
        args: asRecord(data.args),
        result_summary: asString(data.result_summary),
        latency_ms: asNumberOrNull(data.latency_ms),
        error: asOptionalString(data.error),
        redacted: data.redacted === true,
      });
      continue;
    }
    // Classic action frame — no _type discriminator (covers pre-tool_call
    // recordings and any future frame that carries action fields).
    if (data.action_type !== undefined || data.before_screenshot_b64 !== undefined) {
      frames.push({
        kind: 'action',
        index: frames.length,
        step: asNumberOrNull(data.step) ?? frames.length + 1,
        timestamp: asString(data.timestamp),
        action_type: asString(data.action_type),
        action_target: asString(data.action_target),
        reasoning: asString(data.reasoning),
        risk_level: asString(data.risk_level, 'low'),
        succeeded: data.action_succeeded !== false,
        screenshot_data_url: toScreenshotDataUrl(
          asString(data.before_screenshot_b64),
          asString(data.after_screenshot_b64),
        ),
      });
      continue;
    }
    parseErrors += 1;
  }

  if (!sawJsonLine && frames.length === 0) {
    throw new Error('Recording file is empty or has no parseable JSON lines');
  }

  return {
    manifest,
    frames,
    toolCalls: frames.filter((f): f is TimelineToolCallFrame => f.kind === 'tool_call'),
    actions: frames.filter((f): f is TimelineActionFrame => f.kind === 'action'),
    parse_errors: parseErrors,
  };
}

/** Seconds between the manifest start and a frame timestamp, or null. */
export function frameOffsetSeconds(
  startedAt: string,
  timestamp: string,
): number | null {
  if (!startedAt || !timestamp) return null;
  const start = Date.parse(startedAt);
  const at = Date.parse(timestamp);
  if (!Number.isFinite(start) || !Number.isFinite(at)) return null;
  return (at - start) / 1000;
}

export function formatOffset(offsetSeconds: number | null): string {
  if (offsetSeconds === null || !Number.isFinite(offsetSeconds)) return '—';
  const sign = offsetSeconds < 0 ? '-' : '';
  const abs = Math.abs(offsetSeconds);
  const minutes = Math.floor(abs / 60);
  const seconds = abs - minutes * 60;
  return `${sign}${minutes}:${seconds.toFixed(1).padStart(4, '0')}`;
}

/** One-line summary for a track entry. */
export function frameLabel(frame: TimelineFrame): string {
  if (frame.kind === 'tool_call') {
    return frame.tool_name || 'tool call';
  }
  const target = frame.action_target ? ` — ${frame.action_target}` : '';
  return `${frame.action_type || 'action'}${target}`;
}

export function frameSucceeded(frame: TimelineFrame): boolean {
  return frame.kind === 'tool_call' ? frame.error === null : frame.succeeded;
}

/** One entry of the exported tool-call/action track, relative to video start. */
export interface ToolCallTrackEntry {
  /** ms between video start (video_start_epoch) and the frame timestamp. */
  offsetMs: number;
  label: string;
  ok: boolean;
  /** Error text for failed frames, else null. */
  error: string | null;
  /** Position in the parsed frame list, for round-tripping to selection. */
  index: number;
}

/**
 * Export a scrubbable track for video playback: every frame converted to a
 * video-relative offset using the recording's video start epoch
 * (offset_ms = frame_timestamp_ms - video_start_epoch), sorted by offset.
 *
 * Frames whose timestamp cannot be parsed are skipped. When
 * videoStartEpoch is null, offsets fall back to the manifest's started_at
 * (offset from recording start — still scrubbable, just not video-aligned).
 */
export function buildToolCallTrack(
  frames: TimelineFrame[],
  videoStartEpoch: number | null,
  startedAt?: string | null,
): ToolCallTrackEntry[] {
  const fallbackStart = startedAt ? Date.parse(startedAt) : NaN;
  const epoch = videoStartEpoch ?? (Number.isFinite(fallbackStart) ? fallbackStart : null);
  const track: ToolCallTrackEntry[] = [];
  for (const frame of frames) {
    const at = Date.parse(frame.timestamp);
    if (epoch === null || !Number.isFinite(at)) continue;
    track.push({
      offsetMs: Math.max(0, Math.round(at - epoch)),
      label: frameLabel(frame),
      ok: frameSucceeded(frame),
      error: frame.kind === 'tool_call' ? frame.error : frame.succeeded ? null : 'action failed',
      index: frame.index,
    });
  }
  return track.sort((a, b) => a.offsetMs - b.offsetMs);
}
