import React from 'react';
import { type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS, logEvent } from './../../services/analytics/index.ts';
import { Box, Text } from '../../ink';
import { FeedbackSurveyView, isValidResponseInput } from './FeedbackSurveyView';
import type { TranscriptShareResponse } from './TranscriptSharePrompt';
import { TranscriptSharePrompt } from './TranscriptSharePrompt';
import { useDebouncedDigitInput } from './useDebouncedDigitInput';
import type { FeedbackSurveyResponse } from './utils';
type Props = {
  state: 'closed' | 'open' | 'thanks' | 'transcript_prompt' | 'submitting' | 'submitted';
  lastResponse: FeedbackSurveyResponse | null;
  handleSelect: (selected: FeedbackSurveyResponse) => void;
  handleTranscriptSelect?: (selected: TranscriptShareResponse) => void;
  inputValue: string;
  setInputValue: (value: string) => void;
  onRequestFeedback?: () => void;
  message?: string;
};
export function FeedbackSurvey({
    state,
    lastResponse,
    handleSelect,
    handleTranscriptSelect,
    inputValue,
    setInputValue,
    onRequestFeedback,
    message
}: Props) {
  if (state === "closed") {
    return null;
  }
  if (state === "thanks") {
    const t1 = <FeedbackSurveyThanks lastResponse={lastResponse} inputValue={inputValue} setInputValue={setInputValue} onRequestFeedback={onRequestFeedback} />;

    return t1;
  }
  if (state === "submitted") {
    const t1 = <Box marginTop={1}><Text color="success">{"\u2713"} Thanks for sharing your transcript!</Text></Box>;

    return t1;
  }
  if (state === "submitting") {
    const t1 = <Box marginTop={1}><Text dimColor={true}>Sharing transcript{"\u2026"}</Text></Box>;

    return t1;
  }
  if (state === "transcript_prompt") {
    if (!handleTranscriptSelect) {
      return null;
    }
    if (inputValue && !["1", "2", "3"].includes(inputValue)) {
      return null;
    }
    const t1 = <TranscriptSharePrompt onSelect={handleTranscriptSelect} inputValue={inputValue} setInputValue={setInputValue} />;

    return t1;
  }
  if (inputValue && !isValidResponseInput(inputValue)) {
    return null;
  }
  const t1 = <FeedbackSurveyView onSelect={handleSelect} inputValue={inputValue} setInputValue={setInputValue} message={message} />;

  return t1;
}
type ThanksProps = {
  lastResponse: FeedbackSurveyResponse | null;
  inputValue: string;
  setInputValue: (value: string) => void;
  onRequestFeedback?: () => void;
};
const isFollowUpDigit = (char: string): char is '1' => char === '1';
function FeedbackSurveyThanks({
    lastResponse,
    inputValue,
    setInputValue,
    onRequestFeedback
}: ThanksProps) {
  const showFollowUp = onRequestFeedback && lastResponse === "good";
  const t1 = Boolean(showFollowUp);
  const t2 = () => {
      logEvent("tengu_feedback_survey_event", {
        event_type: "followup_accepted" as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        response: lastResponse as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
      });
      onRequestFeedback?.();
    };

  const t3 = {
      inputValue,
      setInputValue,
      isValidDigit: isFollowUpDigit,
      enabled: t1,
      once: true,
      onDigit: t2
    };

  useDebouncedDigitInput(t3);
  const feedbackCommand = false ? "/issue" : "/feedback";
  const t4 = <Text color="success">Thanks for the feedback!</Text>;

  const t5 = <Box marginTop={1} flexDirection="column">{t4}{showFollowUp ? <Text dimColor={true}>(Optional) Press [<Text color="ansi:cyan">1</Text>] to tell us what went well {" \xB7 "}{feedbackCommand}</Text> : lastResponse === "bad" ? <Text dimColor={true}>Use /issue to report model behavior issues.</Text> : <Text dimColor={true}>Use {feedbackCommand} to share detailed feedback anytime.</Text>}</Box>;

  return t5;
}
