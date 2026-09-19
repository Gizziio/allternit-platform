import { feature } from 'bun:bundle';
import * as React from 'react';
import { useSettings } from '../../hooks/useSettings';
import { Box, Text, useAnimationFrame } from '../../ink';
import { interpolateColor, toRGBColor } from '../Spinner/utils';
type Props = {
  voiceState: 'idle' | 'recording' | 'processing';
};

// Processing shimmer colors: dim gray to lighter gray (matches ThinkingShimmerText)
const PROCESSING_DIM = {
  r: 153,
  g: 153,
  b: 153
};
const PROCESSING_BRIGHT = {
  r: 185,
  g: 185,
  b: 185
};
const PULSE_PERIOD_S = 2; // 2 second period for all pulsing animations

export function VoiceIndicator(props) {
  if (!feature("VOICE_MODE")) {
    return null;
  }
  const t0 = <VoiceIndicatorImpl {...props} />;

  return t0;
}
function VoiceIndicatorImpl({
    voiceState
}: Props) {
  switch (voiceState) {
    case "recording":
      {
        const t1 = <Text dimColor={true}>listening…</Text>;

        return t1;
      }
    case "processing":
      {
        const t1 = <ProcessingShimmer />;

        return t1;
      }
    case "idle":
      {
        return null;
      }
  }
}

// Static — the warmup window (~120ms between space #2 and activation)
// is too brief for a 1s-period shimmer to register, and a 50ms animation
// timer here runs concurrently with auto-repeat spaces arriving every
// 30-80ms, compounding re-renders during an already-busy window.
export function VoiceWarmupHint() {
  if (!feature("VOICE_MODE")) {
    return null;
  }
  const t0 = <Text dimColor={true}>keep holding…</Text>;

  return t0;
}
function ProcessingShimmer() {
  const settings = useSettings();
  const reducedMotion = settings.prefersReducedMotion ?? false;
  const [ref, time] = useAnimationFrame(reducedMotion ? null : 50);
  if (reducedMotion) {
    const t0 = <Text color="warning">Voice: processing…</Text>;

    return t0;
  }
  const elapsedSec = time / 1000;
  const opacity = (Math.sin(elapsedSec * Math.PI * 2 / PULSE_PERIOD_S) + 1) / 2;
  const t0 = toRGBColor(interpolateColor(PROCESSING_DIM, PROCESSING_BRIGHT, opacity));

  const color = t0;
  const t1 = <Text color={color}>Voice: processing…</Text>;

  const t2 = <Box ref={ref}>{t1}</Box>;

  return t2;
}
