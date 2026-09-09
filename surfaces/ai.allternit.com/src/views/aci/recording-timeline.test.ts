import { describe, expect, it } from 'vitest';
import {
  parseRecordingTimelineJsonl,
  frameOffsetSeconds,
  formatOffset,
  frameLabel,
  frameSucceeded,
  buildToolCallTrack,
} from './recording-timeline';

const manifestLine = JSON.stringify({
  _type: 'manifest',
  recording_id: 'rec-test123',
  task: 'Review a pull request',
  session_id: 'sess-1',
  run_id: 'run-1',
  started_at: '2026-09-09T12:00:00+00:00',
  completed_at: '2026-09-09T12:00:42+00:00',
  total_steps: 2,
  status: 'completed',
  gif_path: null,
});

const toolCallLine = JSON.stringify({
  _type: 'tool_call',
  recording_id: 'rec-test123',
  step: 1,
  tool_name: 'gmail.github.review_pr',
  args: { pr_url: 'https://github.com/acme/app/pull/42' },
  result_summary: 'approved with 3 comments',
  latency_ms: 812,
  error: null,
  redacted: false,
  timestamp: '2026-09-09T12:00:10+00:00',
});

const failedToolCallLine = JSON.stringify({
  _type: 'tool_call',
  recording_id: 'rec-test123',
  step: 2,
  tool_name: 'gmail.github.merge_pr',
  args: { token: 'secret-value' },
  result_summary: '',
  latency_ms: null,
  error: 'merge conflict',
  redacted: true,
  timestamp: '2026-09-09T12:00:20+00:00',
});

const actionLine = JSON.stringify({
  recording_id: 'rec-test123',
  step: 3,
  timestamp: '2026-09-09T12:00:30+00:00',
  action_type: 'click',
  action_target: 'button#merge',
  action_params: { x: 10, y: 20 },
  before_screenshot_b64: 'aGVsbG8=',
  after_screenshot_b64: 'd29ybGQ=',
  reasoning: 'merge looks safe',
  reflection: '',
  action_succeeded: true,
  risk_level: 'medium',
  tokens_used: 120,
});

const failedActionLine = JSON.stringify({
  recording_id: 'rec-test123',
  step: 4,
  timestamp: '2026-09-09T12:00:40+00:00',
  action_type: 'type',
  action_target: 'input#comment',
  action_params: {},
  before_screenshot_b64: '',
  after_screenshot_b64: '',
  reasoning: '',
  reflection: '',
  action_succeeded: false,
  risk_level: 'low',
  tokens_used: 0,
});

const mixedJsonl = [manifestLine, toolCallLine, failedToolCallLine, actionLine, failedActionLine].join('\n');

describe('parseRecordingTimelineJsonl', () => {
  it('parses a recording with both tool_call and action frames', () => {
    const timeline = parseRecordingTimelineJsonl(mixedJsonl);
    expect(timeline.manifest?.recording_id).toBe('rec-test123');
    expect(timeline.manifest?.status).toBe('completed');
    expect(timeline.frames).toHaveLength(4);
    expect(timeline.toolCalls).toHaveLength(2);
    expect(timeline.actions).toHaveLength(2);
    expect(timeline.parse_errors).toBe(0);
  });

  it('maps tool_call fields through', () => {
    const timeline = parseRecordingTimelineJsonl(mixedJsonl);
    const [ok, failed] = timeline.toolCalls;
    expect(ok.tool_name).toBe('gmail.github.review_pr');
    expect(ok.latency_ms).toBe(812);
    expect(ok.error).toBeNull();
    expect(ok.redacted).toBe(false);
    expect(failed.error).toBe('merge conflict');
    expect(failed.redacted).toBe(true);
  });

  it('keeps action screenshots as data URLs, preferring before over after', () => {
    const timeline = parseRecordingTimelineJsonl(mixedJsonl);
    const [action] = timeline.actions;
    expect(action.screenshot_data_url).toBe('data:image/png;base64,aGVsbG8=');
    expect(action.kind).toBe('action');
    expect(action.succeeded).toBe(true);
  });

  it('treats actions with action_succeeded false as failed', () => {
    const timeline = parseRecordingTimelineJsonl(mixedJsonl);
    const failed = timeline.actions[1];
    expect(failed.succeeded).toBe(false);
    expect(failed.screenshot_data_url).toBeNull();
  });

  it('handles a classic action-only recording with zero tool_call frames', () => {
    const classic = [manifestLine, actionLine, failedActionLine].join('\n');
    const timeline = parseRecordingTimelineJsonl(classic);
    expect(timeline.toolCalls).toHaveLength(0);
    expect(timeline.actions).toHaveLength(2);
    expect(timeline.frames.every((f) => f.kind === 'action')).toBe(true);
  });

  it('skips blank lines and counts unparseable ones without failing', () => {
    const timeline = parseRecordingTimelineJsonl(`${mixedJsonl}\n\nnot json\n\n`);
    expect(timeline.frames).toHaveLength(4);
    expect(timeline.parse_errors).toBe(1);
  });

  it('throws only when nothing parseable exists', () => {
    expect(() => parseRecordingTimelineJsonl('')).toThrow();
    expect(() => parseRecordingTimelineJsonl('nope\nnada')).toThrow();
  });

  it('tolerates a recording with no manifest line', () => {
    const timeline = parseRecordingTimelineJsonl([toolCallLine, actionLine].join('\n'));
    expect(timeline.manifest).toBeNull();
    expect(timeline.frames).toHaveLength(2);
  });
});

describe('frame helpers', () => {
  it('computes frame offsets from the manifest start', () => {
    expect(frameOffsetSeconds('2026-09-09T12:00:00+00:00', '2026-09-09T12:00:10+00:00')).toBe(10);
    expect(frameOffsetSeconds('', '2026-09-09T12:00:10+00:00')).toBeNull();
    expect(frameOffsetSeconds('nope', '2026-09-09T12:00:10+00:00')).toBeNull();
  });

  it('formats offsets as m:ss.s', () => {
    expect(formatOffset(0)).toBe('0:00.0');
    expect(formatOffset(65.3)).toBe('1:05.3');
    expect(formatOffset(null)).toBe('—');
  });

  it('labels frames for the track', () => {
    const timeline = parseRecordingTimelineJsonl(mixedJsonl);
    expect(frameLabel(timeline.frames[0])).toBe('gmail.github.review_pr');
    expect(frameLabel(timeline.frames[2])).toBe('click — button#merge');
  });

  it('reports success per frame kind', () => {
    const timeline = parseRecordingTimelineJsonl(mixedJsonl);
    expect(frameSucceeded(timeline.frames[0])).toBe(true);
    expect(frameSucceeded(timeline.frames[1])).toBe(false);
    expect(frameSucceeded(timeline.frames[2])).toBe(true);
    expect(frameSucceeded(timeline.frames[3])).toBe(false);
  });
});

describe('manifest video metadata', () => {
  it('parses video_path and video_start_epoch when present', () => {
    const line = JSON.stringify({
      ...JSON.parse(manifestLine),
      video_path: '/home/u/.allternit/recordings/rec-test123.webm',
      video_start_epoch: 1757395200000,
    });
    const timeline = parseRecordingTimelineJsonl([line, toolCallLine].join('\n'));
    expect(timeline.manifest?.video_path).toBe('/home/u/.allternit/recordings/rec-test123.webm');
    expect(timeline.manifest?.video_start_epoch).toBe(1757395200000);
  });

  it('defaults video fields to null when absent (classic recordings)', () => {
    const timeline = parseRecordingTimelineJsonl(mixedJsonl);
    expect(timeline.manifest?.video_path).toBeNull();
    expect(timeline.manifest?.video_start_epoch).toBeNull();
  });
});

describe('buildToolCallTrack', () => {
  const videoStartEpoch = Date.parse('2026-09-09T12:00:00+00:00');

  it('emits video-relative offsets, labels, and ok/error, sorted by offset', () => {
    const timeline = parseRecordingTimelineJsonl(mixedJsonl);
    const track = buildToolCallTrack(timeline.frames, videoStartEpoch);
    expect(track).toEqual([
      { offsetMs: 10_000, label: 'gmail.github.review_pr', ok: true, error: null, index: 0 },
      { offsetMs: 20_000, label: 'gmail.github.merge_pr', ok: false, error: 'merge conflict', index: 1 },
      { offsetMs: 30_000, label: 'click — button#merge', ok: true, error: null, index: 2 },
      { offsetMs: 40_000, label: 'type — input#comment', ok: false, error: 'action failed', index: 3 },
    ]);
    const offsets = track.map((entry) => entry.offsetMs);
    expect([...offsets].sort((a, b) => a - b)).toEqual(offsets);
  });

  it('falls back to the manifest started_at when no video epoch is set', () => {
    const timeline = parseRecordingTimelineJsonl(mixedJsonl);
    const track = buildToolCallTrack(timeline.frames, null, timeline.manifest?.started_at);
    expect(track[0]?.offsetMs).toBe(10_000);
  });

  it('skips frames with unparseable timestamps', () => {
    const bad = JSON.stringify({ ...JSON.parse(toolCallLine), timestamp: 'not-a-date' });
    const timeline = parseRecordingTimelineJsonl([manifestLine, bad, toolCallLine].join('\n'));
    const track = buildToolCallTrack(timeline.frames, videoStartEpoch);
    expect(track).toHaveLength(1);
    expect(track[0].label).toBe('gmail.github.review_pr');
  });

  it('returns an empty track when no epoch or started_at is available', () => {
    const timeline = parseRecordingTimelineJsonl([toolCallLine, actionLine].join('\n'));
    expect(buildToolCallTrack(timeline.frames, null)).toEqual([]);
  });

  it('clamps pre-video frames to offset 0', () => {
    const early = JSON.stringify({
      ...JSON.parse(toolCallLine),
      timestamp: '2026-09-09T11:59:50+00:00',
    });
    const timeline = parseRecordingTimelineJsonl([manifestLine, early].join('\n'));
    const track = buildToolCallTrack(timeline.frames, videoStartEpoch);
    expect(track[0].offsetMs).toBe(0);
  });
});
