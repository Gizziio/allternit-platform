import React, { Suspense, use, useState } from 'react';
import { Box, Text } from '../../ink';
import { useKeybinding } from '../../keybindings/useKeybinding';
import { logEvent } from '../../services/analytics/index';
import type { Message } from '../../types/message';
import { generatePermissionExplanation, isPermissionExplainerEnabled, type PermissionExplanation as PermissionExplanationType, type RiskLevel } from '../../utils/permissions/permissionExplainer';
import { ShimmerChar } from '../Spinner/ShimmerChar';
import { useShimmerAnimation } from '../Spinner/useShimmerAnimation';
const LOADING_MESSAGE = 'Loading explanation…';
function ShimmerLoadingText() {
  const [ref, glimmerIndex] = useShimmerAnimation("responding", LOADING_MESSAGE, false);
  const t0 = LOADING_MESSAGE.split("").map((char, index) => <ShimmerChar key={index} char={char} index={index} glimmerIndex={glimmerIndex} messageColor="inactive" shimmerColor="text" />);

  const t1 = <Text>{t0}</Text>;

  const t2 = <Box ref={ref}>{t1}</Box>;

  return t2;
}
function getRiskColor(riskLevel: RiskLevel): 'success' | 'warning' | 'error' {
  switch (riskLevel) {
    case 'LOW':
      return 'success';
    case 'MEDIUM':
      return 'warning';
    case 'HIGH':
      return 'error';
  }
}
function getRiskLabel(riskLevel: RiskLevel): string {
  switch (riskLevel) {
    case 'LOW':
      return 'Low risk';
    case 'MEDIUM':
      return 'Med risk';
    case 'HIGH':
      return 'High risk';
  }
}
type PermissionExplanationProps = {
  toolName: string;
  toolInput: unknown;
  toolDescription?: string;
  messages?: Message[];
};
type ExplainerState = {
  visible: boolean;
  enabled: boolean;
  promise: Promise<PermissionExplanationType | null> | null;
};

/**
 * Creates an explanation promise that never rejects.
 * Errors are caught and returned as null.
 */
function createExplanationPromise(props: PermissionExplanationProps): Promise<PermissionExplanationType | null> {
  return generatePermissionExplanation({
    toolName: props.toolName,
    toolInput: props.toolInput,
    toolDescription: props.toolDescription,
    messages: props.messages,
    signal: new AbortController().signal // Won't abort - request is fast enough
  }).catch(() => null);
}

/**
 * Hook that manages the permission explainer state.
 * Creates the fetch promise lazily (only when user hits Ctrl+E)
 * to avoid consuming tokens for explanations users never view.
 */
export function usePermissionExplainerUI(props) {
  const t0 = isPermissionExplainerEnabled();

  const enabled = t0;
  const [visible, setVisible] = useState(false);
  const [promise, setPromise] = useState(null);
  const t1 = () => {
      if (!visible) {
        logEvent("tengu_permission_explainer_shortcut_used", {});
        if (!promise) {
          setPromise(createExplanationPromise(props));
        }
      }
      setVisible(_temp);
    };

  const t2 = {
      context: "Confirmation",
      isActive: enabled
    };

  useKeybinding("confirm:toggleExplanation", t1, t2);
  const t3 = {
      visible,
      enabled,
      promise
    };

  return t3;
}

/**
 * Inner component that uses React 19's use() to read the promise.
 * Suspends while loading, returns null on error.
 */
function _temp(v) {
  return !v;
}
function ExplanationResult(t0: {
  promise: Promise<PermissionExplanationType | null> | null;
}) {
  const {
    promise
  } = t0;
  const explanation = use(promise);
  if (!explanation) {
    const t1 = <Box marginTop={1}><Text dimColor={true}>Explanation unavailable</Text></Box>;

    return t1;
  }
  const t1 = <Text>{explanation.explanation}</Text>;

  const t2 = <Box marginTop={1}><Text>{explanation.reasoning}</Text></Box>;

  const t3 = getRiskColor(explanation.riskLevel);

  const t4 = getRiskLabel(explanation.riskLevel);

  const t5 = <Text color={t3}>{t4}:</Text>;

  const t6 = <Text> {explanation.risk}</Text>;

  const t7 = <Box marginTop={1}><Text>{t5}{t6}</Text></Box>;

  const t8 = <Box flexDirection="column" marginTop={1}>{t1}{t2}{t7}</Box>;

  return t8;
}

/**
 * Content component - shows loading (via Suspense) or explanation when visible
 */
export function PermissionExplainerContent(t0) {
  const {
    visible,
    promise
  } = t0;
  if (!visible || !promise) {
    return null;
  }
  const t1 = <Box marginTop={1}><ShimmerLoadingText /></Box>;

  const t2 = <Suspense fallback={t1}><ExplanationResult promise={promise} /></Suspense>;

  return t2;
}
