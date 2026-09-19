import React, { type ReactNode, useCallback, useMemo, useState } from 'react';
import { Box, Text } from '../../ink';
// keybindings/types is a stub in this fork (never exported KeybindingAction);
// the original upstream type was a keybinding action-name string.
type KeybindingAction = string;
import { useKeybindings } from '../../keybindings/useKeybinding';
import { type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS, logEvent } from '../../services/analytics/index';
import { useSetAppState } from '../../state/AppState';
import { type OptionWithDescription, Select } from '../CustomSelect/select';
export type FeedbackType = 'accept' | 'reject';
export type PermissionPromptOption<T extends string> = {
  value: T;
  label: ReactNode;
  feedbackConfig?: {
    type: FeedbackType;
    placeholder?: string;
  };
  keybinding?: KeybindingAction;
};
export type ToolAnalyticsContext = {
  toolName: string;
  isMcp: boolean;
};
export type PermissionPromptProps<T extends string> = {
  options: PermissionPromptOption<T>[];
  onSelect: (value: T, feedback?: string) => void;
  onCancel?: () => void;
  question?: string | ReactNode;
  toolAnalyticsContext?: ToolAnalyticsContext;
};
const DEFAULT_PLACEHOLDERS: Record<FeedbackType, string> = {
  accept: 'tell Gizzi what to do next',
  reject: 'tell Gizzi what to do differently'
};

/**
 * Shared component for permission prompts with optional feedback input.
 *
 * Handles:
 * - "Do you want to proceed?" question with optional Tab hint
 * - Feature flag check for feedback capability
 * - Input mode toggling (Tab to expand feedback input)
 * - Analytics events for feedback interactions
 * - Transforming options to Select-compatible format
 */
export function PermissionPrompt({
    options,
    onSelect,
    onCancel,
    question: t1,
    toolAnalyticsContext
}: PermissionPromptProps<string>) {
  const question = t1 === undefined ? "Do you want to proceed?" : t1;
  const setAppState = useSetAppState();
  const [acceptFeedback, setAcceptFeedback] = useState("");
  const [rejectFeedback, setRejectFeedback] = useState("");
  const [acceptInputMode, setAcceptInputMode] = useState(false);
  const [rejectInputMode, setRejectInputMode] = useState(false);
  const [focusedValue, setFocusedValue] = useState(null);
  const [acceptFeedbackModeEntered, setAcceptFeedbackModeEntered] = useState(false);
  const [rejectFeedbackModeEntered, setRejectFeedbackModeEntered] = useState(false);
  const t3 = opt => opt.value === focusedValue;

  const t2 = options.find(t3);

  const focusedOption = t2;
  const focusedFeedbackType = focusedOption?.feedbackConfig?.type;
  const showTabHint = focusedFeedbackType === "accept" && !acceptInputMode || focusedFeedbackType === "reject" && !rejectInputMode;
  const t4 = opt_0 => {
        const {
          value,
          label,
          feedbackConfig
        } = opt_0;
        if (!feedbackConfig) {
          return {
            label,
            value
          };
        }
        const {
          type,
          placeholder
        } = feedbackConfig;
        const isInputMode = type === "accept" ? acceptInputMode : rejectInputMode;
        const onChange = type === "accept" ? setAcceptFeedback : setRejectFeedback;
        const defaultPlaceholder = DEFAULT_PLACEHOLDERS[type];
        if (isInputMode) {
          return {
            type: "input" as const,
            label,
            value,
            placeholder: placeholder ?? defaultPlaceholder,
            onChange,
            allowEmptySubmitToCancel: true
          };
        }
        return {
          label,
          value
        };
      };

  const t3_2 = options.map(t4);

  const selectOptions = t3_2;
  const t4_2 = value_0 => {
      const option = options.find(opt_1 => opt_1.value === value_0);
      if (!option?.feedbackConfig) {
        return;
      }
      const {
        type: type_0
      } = option.feedbackConfig;
      const analyticsProps = {
        toolName: toolAnalyticsContext?.toolName as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        isMcp: toolAnalyticsContext?.isMcp ?? false
      };
      if (type_0 === "accept") {
        if (acceptInputMode) {
          setAcceptInputMode(false);
          logEvent("tengu_accept_feedback_mode_collapsed", analyticsProps);
        } else {
          setAcceptInputMode(true);
          setAcceptFeedbackModeEntered(true);
          logEvent("tengu_accept_feedback_mode_entered", analyticsProps);
        }
      } else {
        if (type_0 === "reject") {
          if (rejectInputMode) {
            setRejectInputMode(false);
            logEvent("tengu_reject_feedback_mode_collapsed", analyticsProps);
          } else {
            setRejectInputMode(true);
            setRejectFeedbackModeEntered(true);
            logEvent("tengu_reject_feedback_mode_entered", analyticsProps);
          }
        }
      }
    };

  const handleInputModeToggle = t4_2;
  const t5 = value_1 => {
      const option_0 = options.find(opt_2 => opt_2.value === value_1);
      if (!option_0) {
        return;
      }
      let feedback;
      if (option_0.feedbackConfig) {
        const rawFeedback = option_0.feedbackConfig.type === "accept" ? acceptFeedback : rejectFeedback;
        const trimmedFeedback = rawFeedback.trim();
        if (trimmedFeedback) {
          feedback = trimmedFeedback;
        }
        const analyticsProps_0 = {
          toolName: toolAnalyticsContext?.toolName as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
          isMcp: toolAnalyticsContext?.isMcp ?? false,
          has_instructions: !!trimmedFeedback,
          instructions_length: trimmedFeedback?.length ?? 0,
          entered_feedback_mode: option_0.feedbackConfig.type === "accept" ? acceptFeedbackModeEntered : rejectFeedbackModeEntered
        };
        if (option_0.feedbackConfig.type === "accept") {
          logEvent("tengu_accept_submitted", analyticsProps_0);
        } else {
          if (option_0.feedbackConfig.type === "reject") {
            logEvent("tengu_reject_submitted", analyticsProps_0);
          }
        }
      }
      onSelect(value_1, feedback);
    };

  const handleSelect = t5;
  const handlers = {};
  for (const opt_3 of options) {
      if (opt_3.keybinding) {
        handlers[opt_3.keybinding] = () => handleSelect(opt_3.value);
      }
    }

  const keybindingHandlers = handlers;
  const t6 = {
      context: "Confirmation"
    };

  useKeybindings(keybindingHandlers, t6);
  const t7 = () => {
      logEvent("tengu_permission_request_escape", {});
      setAppState(_temp);
      onCancel?.();
    };

  const handleCancel = t7;
  const t8 = typeof question === "string" ? <Text>{question}</Text> : question;

  const t9 = value_2 => {
      const newOption = options.find(opt_4 => opt_4.value === value_2);
      if (newOption?.feedbackConfig?.type !== "accept" && acceptInputMode && !acceptFeedback.trim()) {
        setAcceptInputMode(false);
      }
      if (newOption?.feedbackConfig?.type !== "reject" && rejectInputMode && !rejectFeedback.trim()) {
        setRejectInputMode(false);
      }
      setFocusedValue(value_2);
    };

  const t10 = <Select options={selectOptions} inlineDescriptions={true} onChange={handleSelect} onCancel={handleCancel} onFocus={t9} onInputModeToggle={handleInputModeToggle} />;

  const t11 = showTabHint && " \xB7 Tab to amend";
  const t12 = <Box marginTop={1}><Text dimColor={true}>Esc to cancel{t11}</Text></Box>;

  const t13 = <Box flexDirection="column">{t8}{t10}{t12}</Box>;

  return t13;
}
function _temp(prev) {
  return {
    ...prev,
    attribution: {
      ...prev.attribution,
      escapeCount: prev.attribution.escapeCount + 1
    }
  };
}
