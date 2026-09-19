import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isFeedbackSurveyDisabled } from './../../services/analytics/config.ts';
import { checkStatsigFeatureGate_CACHED_MAY_BE_STALE } from './../../services/analytics/growthbook.ts';
import { type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS, logEvent } from './../../services/analytics/index.ts';
import { shouldUseSessionMemoryCompaction } from '../../services/compact/sessionMemoryCompact';
import type { Message } from '../../types/message';
import { isEnvTruthy } from '../../utils/envUtils';
import { isCompactBoundaryMessage } from '../../utils/messages';
import { logOTelEvent } from '../../utils/telemetry/events';
import { useSurveyState } from './useSurveyState';
import type { FeedbackSurveyResponse } from './utils';
const HIDE_THANKS_AFTER_MS = 3000;
const POST_COMPACT_SURVEY_GATE = 'tengu_post_compact_survey';
const SURVEY_PROBABILITY = 0.2; // Show survey 20% of the time after compaction

function hasMessageAfterBoundary(messages: Message[], boundaryUuid: string): boolean {
  const boundaryIndex = messages.findIndex(msg => msg.uuid === boundaryUuid);
  if (boundaryIndex === -1) {
    return false;
  }

  // Check if there's a user or assistant message after the boundary
  for (let i = boundaryIndex + 1; i < messages.length; i++) {
    const msg = messages[i];
    if (msg && (msg.type === 'user' || msg.type === 'assistant')) {
      return true;
    }
  }
  return false;
}
export function usePostCompactSurvey(messages, isLoading, t0, t1) {
  const hasActivePrompt = t0 === undefined ? false : t0;
  const t2 = t1 === undefined ? {} : t1;

  const {
    enabled: t3
  } = t2;
  const enabled = t3 === undefined ? true : t3;
  const [gateEnabled, setGateEnabled] = useState(null);
  const t4 = new Set();

  const seenCompactBoundaries = useRef(t4);
  const pendingCompactBoundaryUuid = useRef(null);
  const onOpen = _temp;
  const onSelect = _temp2;
  const t5 = {
      hideThanksAfterMs: HIDE_THANKS_AFTER_MS,
      onOpen,
      onSelect
    };

  const {
    state,
    lastResponse,
    open,
    handleSelect
  } = useSurveyState(t5);
  const t6 = () => {
      if (!enabled) {
        return;
      }
      setGateEnabled(checkStatsigFeatureGate_CACHED_MAY_BE_STALE(POST_COMPACT_SURVEY_GATE));
    };
  const t7 = [enabled];

  useEffect(t6, t7);
  const t8 = new Set(messages.filter(_temp3).map(_temp4));

  const currentCompactBoundaries = t8;
  const t9 = () => {
      if (!enabled) {
        return;
      }
      if (state !== "closed" || isLoading) {
        return;
      }
      if (hasActivePrompt) {
        return;
      }
      if (gateEnabled !== true) {
        return;
      }
      if (isFeedbackSurveyDisabled()) {
        return;
      }
      if (isEnvTruthy(process.env.GIZZI_CODE_DISABLE_FEEDBACK_SURVEY)) {
        return;
      }
      if (pendingCompactBoundaryUuid.current !== null) {
        if (hasMessageAfterBoundary(messages, pendingCompactBoundaryUuid.current)) {
          pendingCompactBoundaryUuid.current = null;
          if (Math.random() < SURVEY_PROBABILITY) {
            open();
          }
          return;
        }
      }
      const newBoundaries = Array.from(currentCompactBoundaries).filter(uuid => !seenCompactBoundaries.current.has(uuid));
      if (newBoundaries.length > 0) {
        seenCompactBoundaries.current = new Set(currentCompactBoundaries);
        pendingCompactBoundaryUuid.current = newBoundaries[newBoundaries.length - 1];
      }
    };
  const t10 = [enabled, currentCompactBoundaries, state, isLoading, hasActivePrompt, gateEnabled, messages, open];

  useEffect(t9, t10);
  const t11 = {
      state,
      lastResponse,
      handleSelect
    };

  return t11;
}
function _temp4(msg_0) {
  return msg_0.uuid;
}
function _temp3(msg) {
  return isCompactBoundaryMessage(msg);
}
function _temp2(appearanceId_0, selected) {
  const smCompactionEnabled_0 = shouldUseSessionMemoryCompaction();
  logEvent("tengu_post_compact_survey_event", {
    event_type: "responded" as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    appearance_id: appearanceId_0 as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    response: selected as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    session_memory_compaction_enabled: smCompactionEnabled_0 as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
  });
  logOTelEvent("feedback_survey", {
    event_type: "responded",
    appearance_id: appearanceId_0,
    response: selected,
    survey_type: "post_compact"
  });
}
function _temp(appearanceId) {
  const smCompactionEnabled = shouldUseSessionMemoryCompaction();
  logEvent("tengu_post_compact_survey_event", {
    event_type: "appeared" as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    appearance_id: appearanceId as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    session_memory_compaction_enabled: smCompactionEnabled as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
  });
  logOTelEvent("feedback_survey", {
    event_type: "appeared",
    appearance_id: appearanceId,
    survey_type: "post_compact"
  });
}
