import React, { useRef } from 'react';
import type { RemoteAgentTaskState } from './../../tasks/RemoteAgentTask/RemoteAgentTask.tsx';
import type { DeepImmutable } from './../../types/utils.ts';
import { DIAMOND_FILLED, DIAMOND_OPEN } from '../../constants/figures';
import { useSettings } from '../../hooks/useSettings';
import { Text, useAnimationFrame } from '../../ink';
import { count } from '../../utils/array';
import { getRainbowColor } from '../../utils/thinking';
const TICK_MS = 80;
type ReviewStage = NonNullable<NonNullable<RemoteAgentTaskState['reviewProgress']>['stage']>;

/**
 * Stage-appropriate counts line for a running review. Shared between the
 * one-line pill (below) and RemoteSessionDetailDialog's reviewCountsLine so
 * the two can't drift — they have historically disagreed on whether to show
 * refuted counts and what to call the synthesizing stage.
 *
 * Canonical behavior: word labels (not ✓/✗), hide refuted when 0, "deduping"
 * for the synthesizing stage (matches STAGE_LABELS in the detail dialog).
 */
export function formatReviewStageCounts(stage: ReviewStage | undefined, found: number, verified: number, refuted: number): string {
  // Pre-stage orchestrator images don't write the stage field.
  if (!stage) return `${found} found · ${verified} verified`;
  if (stage === 'synthesizing') {
    const parts = [`${verified} verified`];
    if (refuted > 0) parts.push(`${refuted} refuted`);
    parts.push('deduping');
    return parts.join(' · ');
  }
  if (stage === 'verifying') {
    const parts = [`${found} found`, `${verified} verified`];
    if (refuted > 0) parts.push(`${refuted} refuted`);
    return parts.join(' · ');
  }
  // stage === 'finding'
  return found > 0 ? `${found} found` : 'finding';
}

// Per-character rainbow gradient, same treatment as the ultraplan keyword.
// The phase offset lets the gradient cycle — so the colors sweep along the
// text on each animation frame instead of being static.
function RainbowText(t0) {
  const {
    text,
    phase: t1
  } = t0;
  const phase = t1 === undefined ? 0 : t1;
  const t2 = [...text];

  const t3 = <>{t2.map((ch, i) => <Text key={i} color={getRainbowColor(i + phase)}>{ch}</Text>)}</>;

  return t3;
}

// Smooth-tick a count toward target, +1 per frame. Same pattern as the
// token counter in SpinnerAnimationRow — the ref survives re-renders and
// the animation clock drives the tick. Target jumps (2→5) display as
// 2→3→4→5 instead of snapping. When `snap` is set (reduced motion, or
// the clock is frozen), bypass the tick and jump straight to target —
// otherwise a frozen `time` would leave the ref stuck at its init value.
function useSmoothCount(target: number, time: number, snap: boolean): number {
  const displayed = useRef(target);
  const lastTick = useRef(time);
  if (snap || target < displayed.current) {
    displayed.current = target;
  } else if (target > displayed.current && time !== lastTick.current) {
    displayed.current += 1;
    lastTick.current = time;
  }
  return displayed.current;
}
function ReviewRainbowLine(t0) {
  const {
    session
  } = t0;
  const settings = useSettings();
  const reducedMotion = settings.prefersReducedMotion ?? false;
  const p = session.reviewProgress;
  const running = session.status === "running";
  const [, time] = useAnimationFrame(running && !reducedMotion ? TICK_MS : null);
  const targetFound = p?.bugsFound ?? 0;
  const targetVerified = p?.bugsVerified ?? 0;
  const targetRefuted = p?.bugsRefuted ?? 0;
  const snap = reducedMotion || !running;
  const found = useSmoothCount(targetFound, time, snap);
  const verified = useSmoothCount(targetVerified, time, snap);
  const refuted = useSmoothCount(targetRefuted, time, snap);
  const phase = Math.floor(time / (TICK_MS * 3)) % 7;
  if (session.status === "completed") {
    const t1 = <><Text color="background">{DIAMOND_FILLED} </Text><RainbowText text="ultrareview" phase={0} /><Text dimColor={true}> ready · shift+↓ to view</Text></>;

    return t1;
  }
  if (session.status === "failed") {
    const t1 = <><Text color="background">{DIAMOND_FILLED} </Text><RainbowText text="ultrareview" phase={0} /><Text color="error" dimColor={true}>{" \xB7 "}error</Text></>;

    return t1;
  }
  const t1 = !p ? "setting up" : formatReviewStageCounts(p.stage, found, verified, refuted);

  const tail = t1;
  const t2 = <Text color="background">{DIAMOND_OPEN} </Text>;

  const t3 = running ? phase : 0;
  const t4 = <RainbowText text="ultrareview" phase={t3} />;

  const t5 = <Text dimColor={true}> · {tail}</Text>;

  const t6 = <>{t2}{t4}{t5}</>;

  return t6;
}
export function RemoteSessionProgress(t0) {
  const {
    session
  } = t0;
  if (session.isRemoteReview) {
    const t1 = <ReviewRainbowLine session={session} />;

    return t1;
  }
  if (session.status === "completed") {
    const t1 = <Text bold={true} color="success" dimColor={true}>done</Text>;

    return t1;
  }
  if (session.status === "failed") {
    const t1 = <Text bold={true} color="error" dimColor={true}>error</Text>;

    return t1;
  }
  if (!session.todoList.length) {
    const t1 = <Text dimColor={true}>{session.status}…</Text>;

    return t1;
  }
  const t1 = count(session.todoList, _temp);

  const completed = t1;
  const total = session.todoList.length;
  const t2 = <Text dimColor={true}>{completed}/{total}</Text>;

  return t2;
}
function _temp(_) {
  return _.status === "completed";
}
