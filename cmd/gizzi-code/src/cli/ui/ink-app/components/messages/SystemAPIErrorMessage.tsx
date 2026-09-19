import type { APIError } from '@allternit/gizzi-sdk/providers/allternit';
import * as React from 'react';
import { useState } from 'react';
import { Box, Text } from './../../ink.ts';
import { formatAPIError } from './../../services/api/errorUtils.ts';
import type { SystemAPIErrorMessage } from './../../types/message.ts';
import { useInterval } from 'usehooks-ts';
import { CtrlOToExpand } from '../CtrlOToExpand';
import { MessageResponse } from '../MessageResponse';
const MAX_API_ERROR_CHARS = 1000;
type Props = {
  message: SystemAPIErrorMessage;
  verbose: boolean;
};
export function SystemAPIErrorMessage({
    message: t1,
    verbose
}: Props) {
  const {
    retryAttempt,
    error,
    retryInMs,
    maxRetries
  } = t1;
  const hidden = true && retryAttempt < 4;
  const [countdownMs, setCountdownMs] = useState(0);
  const done = countdownMs >= retryInMs;
  const t2 = () => setCountdownMs(_temp);

  useInterval(t2, hidden || done ? null : 1000);
  if (hidden) {
    return null;
  }
  const t3 = Math.round((retryInMs - countdownMs) / 1000);

  const retryInSecondsLive = Math.max(0, t3);
  const formatted = formatAPIError(error as APIError);
  const truncated = !verbose && formatted.length > MAX_API_ERROR_CHARS;
  const T2 = MessageResponse;
  const T1 = Box;
  const t6 = "column";
  const T0 = Text;
  const t4 = "error";
  const t5 = truncated ? formatted.slice(0, MAX_API_ERROR_CHARS) + "\u2026" : formatted;

  const t7 = <T0 color={t4}>{t5}</T0>;

  const t8 = truncated && <CtrlOToExpand />;

  const t9 = retryInSecondsLive === 1 ? "second" : "seconds";
  const t10 = <Text dimColor={true}>Retrying in {retryInSecondsLive}{" "}{t9}… (attempt{" "}{retryAttempt}/{maxRetries}){process.env.API_TIMEOUT_MS ? ` · API_TIMEOUT_MS=${process.env.API_TIMEOUT_MS}ms, try increasing it` : ""}</Text>;

  const t11 = <T1 flexDirection={t6}>{t7}{t8}{t10}</T1>;

  const t12 = <T2>{t11}</T2>;

  return t12;
}
function _temp(ms) {
  return ms + 1000;
}
