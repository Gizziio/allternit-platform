import React from 'react';
import { handlePlanModeTransition } from '../../../bootstrap/state';
import { Box, Text } from '../../../ink';
import { type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS, logEvent } from '../../../services/analytics/index';
import { useAppState } from '../../../state/AppState';
import { isPlanModeInterviewPhaseEnabled } from '../../../utils/planModeV2';
import { Select } from '../../CustomSelect/index';
import { PermissionDialog } from '../PermissionDialog';
import type { PermissionRequestProps } from '../PermissionRequest';
export function EnterPlanModePermissionRequest(t0) {
  const {
    toolUseConfirm,
    onDone,
    onReject,
    workerBadge
  } = t0;
  const toolPermissionContextMode = useAppState(_temp);
  const t1 = function handleResponse(value) {
      if (value === "yes") {
        logEvent("tengu_plan_enter", {
          interviewPhaseEnabled: isPlanModeInterviewPhaseEnabled(),
          entryMethod: "tool" as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
        });
        handlePlanModeTransition(toolPermissionContextMode, "plan");
        onDone();
        toolUseConfirm.onAllow({}, [{
          type: "setMode",
          mode: "plan",
          destination: "session"
        }]);
      } else {
        onDone();
        onReject();
        toolUseConfirm.onReject();
      }
    };

  const handleResponse = t1;
  const t2 = <Text>Gizzi wants to enter plan mode to explore and design an implementation approach.</Text>;

  const t3 = <Box marginTop={1} flexDirection="column"><Text dimColor={true}>In plan mode, Gizzi will:</Text><Text dimColor={true}> · Explore the codebase thoroughly</Text><Text dimColor={true}> · Identify existing patterns</Text><Text dimColor={true}> · Design an implementation strategy</Text><Text dimColor={true}> · Present a plan for your approval</Text></Box>;

  const t4 = <Box marginTop={1}><Text dimColor={true}>No code changes will be made until you approve the plan.</Text></Box>;

  const t5 = {
      label: "Yes, enter plan mode",
      value: "yes" as const
    };

  const t6 = [t5, {
      label: "No, start implementing now",
      value: "no" as const
    }];

  const t7 = () => handleResponse("no");

  const t8 = <Box flexDirection="column" marginTop={1} paddingX={1}>{t2}{t3}{t4}<Box marginTop={1}><Select options={t6} onChange={handleResponse} onCancel={t7} /></Box></Box>;

  const t9 = <PermissionDialog color="planMode" title="Enter plan mode?" workerBadge={workerBadge}>{t8}</PermissionDialog>;

  return t9;
}
function _temp(s) {
  return s.toolPermissionContext.mode;
}
