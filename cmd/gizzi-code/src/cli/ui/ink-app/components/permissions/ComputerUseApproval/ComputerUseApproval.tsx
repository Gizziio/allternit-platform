import { getSentinelCategory } from '../../../utils/computerUse/engine/sentinel.js';
import type { CuPermissionRequest, CuPermissionResponse } from '../../../utils/computerUse/engine/types.js';
import { DEFAULT_GRANT_FLAGS } from '../../../utils/computerUse/engine/types.js';
import figures from 'figures';
import * as React from 'react';
import { useMemo, useState } from 'react';
import { Box, Text } from '../../../ink';
import { execFileNoThrow } from '../../../utils/execFileNoThrow';
import { plural } from '../../../utils/stringUtils';
import type { OptionWithDescription } from '../../CustomSelect/select';
import { Select } from '../../CustomSelect/select';
import { Dialog } from '../../design-system/Dialog';
type ComputerUseApprovalProps = {
  request: CuPermissionRequest;
  onDone: (response: CuPermissionResponse) => void;
};
const DENY_ALL_RESPONSE: CuPermissionResponse = {
  granted: [],
  denied: [],
  flags: DEFAULT_GRANT_FLAGS
};

/**
 * Two-panel dispatcher. When `request.tccState` is present, macOS permissions
 * (Accessibility / Screen Recording) are missing and the app list is
 * irrelevant — show a TCC panel that opens System Settings. Otherwise show the
 * app allowlist + grant-flags panel.
 */
export function ComputerUseApproval({
    request,
    onDone
}: ComputerUseApprovalProps) {
  const t1 = request.tccState ? <ComputerUseTccPanel tccState={request.tccState} onDone={() => onDone(DENY_ALL_RESPONSE)} /> : <ComputerUseAppListPanel request={request} onDone={onDone} />;

  return t1;
}

// ── TCC panel ─────────────────────────────────────────────────────────────

type TccOption = 'open_accessibility' | 'open_screen_recording' | 'retry';
function ComputerUseTccPanel(t0) {
  const {
    tccState,
    onDone
  } = t0;
  const opts = [];
  if (!tccState.accessibility) {
      const t1 = {
          label: "Open System Settings \u2192 Accessibility",
          value: "open_accessibility"
        };

      opts.push(t1);
    }
  if (!tccState.screenRecording) {
      const t1 = {
          label: "Open System Settings \u2192 Screen Recording",
          value: "open_screen_recording"
        };

      opts.push(t1);
    }
  const t1 = {
        label: "Try again",
        value: "retry"
      };

  opts.push(t1);

  const options = opts;
  const t1_2 = function onChange(value) {
      switch (value) {
        case "open_accessibility":
          {
            execFileNoThrow("open", ["x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"], {
              useCwd: false
            });
            return;
          }
        case "open_screen_recording":
          {
            execFileNoThrow("open", ["x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"], {
              useCwd: false
            });
            return;
          }
        case "retry":
          {
            onDone();
            return;
          }
      }
    };

  const onChange = t1_2;
  const t2 = tccState.accessibility ? `${figures.tick} granted` : `${figures.cross} not granted`;
  const t3 = <Text>Accessibility:{" "}{t2}</Text>;

  const t4 = tccState.screenRecording ? `${figures.tick} granted` : `${figures.cross} not granted`;
  const t5 = <Text>Screen Recording:{" "}{t4}</Text>;

  const t6 = <Box flexDirection="column">{t3}{t5}</Box>;

  const t7 = <Text dimColor={true}>Grant the missing permissions in System Settings, then select "Try again". macOS may require you to restart Gizzi Code after granting Screen Recording.</Text>;

  const t8 = <Select options={options} onChange={onChange} onCancel={onDone} />;

  const t9 = <Box flexDirection="column" paddingX={1} paddingY={1} gap={1}>{t6}{t7}{t8}</Box>;

  const t10 = <Dialog title="Computer Use needs macOS permissions" onCancel={onDone}>{t9}</Dialog>;

  return t10;
}

// ── App allowlist panel ───────────────────────────────────────────────────

type AppListOption = 'allow_all' | 'deny';
const SENTINEL_WARNING: Record<NonNullable<ReturnType<typeof getSentinelCategory>>, string> = {
  shell: 'equivalent to shell access',
  filesystem: 'can read/write any file',
  system_settings: 'can change system settings'
};
function ComputerUseAppListPanel({
    request,
    onDone
}: ComputerUseApprovalProps) {
  const t1 = () => new Set(request.apps.flatMap(_temp));

  const [checked] = useState(t1);
  const t2 = ["clipboardRead", "clipboardWrite", "systemKeyCombos"];

  const ALL_FLAG_KEYS = t2;
  const t3 = ALL_FLAG_KEYS.filter(k => request.requestedFlags[k]);

  const requestedFlagKeys = t3;
  const t4 = checked.size;
  const t5 = plural(checked.size, "app");

  const t6 = `Allow for this session (${t4} ${t5})`;
  const t7 = {
      label: t6,
      value: "allow_all"
    };

  const t8 = {
      label: <Text>Deny, and tell Gizzi what to do differently <Text bold={true}>(esc)</Text></Text>,
      value: "deny"
    };

  const t9 = [t7, t8];

  const options = t9;
  const t10 = function respond(allow) {
      if (!allow) {
        onDone(DENY_ALL_RESPONSE);
        return;
      }
      const now = Date.now();
      const granted = request.apps.flatMap(a_0 => a_0.resolved && checked.has(a_0.resolved.bundleId) ? [{
        bundleId: a_0.resolved.bundleId,
        displayName: a_0.resolved.displayName,
        grantedAt: now
      }] : []);
      const denied = request.apps.filter(a_1 => !a_1.resolved || !checked.has(a_1.resolved.bundleId)).map(_temp2);
      const flags = {
        ...DEFAULT_GRANT_FLAGS,
        ...Object.fromEntries(requestedFlagKeys.map(_temp3))
      };
      onDone({
        granted,
        denied,
        flags
      });
    };

  const respond = t10;
  const t11 = () => respond(false);

  const t12 = request.reason ? <Text dimColor={true}>{request.reason}</Text> : null;

  const t14 = a_3 => {
        const resolved = a_3.resolved;
        if (!resolved) {
          return <Text key={a_3.requestedName} dimColor={true}>{"  "}{figures.circle} {a_3.requestedName}{" "}<Text dimColor={true}>(not installed)</Text></Text>;
        }
        if (a_3.alreadyGranted) {
          return <Text key={resolved.bundleId} dimColor={true}>{"  "}{figures.tick} {resolved.displayName}{" "}<Text dimColor={true}>(already granted)</Text></Text>;
        }
        const sentinel = getSentinelCategory(resolved.bundleId);
        const isChecked = checked.has(resolved.bundleId);
        return <Box key={resolved.bundleId} flexDirection="column"><Text>{"  "}{isChecked ? figures.circleFilled : figures.circle}{" "}{resolved.displayName}</Text>{sentinel ? <Text bold={true}>{"    "}{figures.warning} {SENTINEL_WARNING[sentinel]}</Text> : null}</Box>;
      };

  const t13 = request.apps.map(t14);

  const t14_2 = <Box flexDirection="column">{t13}</Box>;

  const t15 = requestedFlagKeys.length > 0 ? <Box flexDirection="column"><Text dimColor={true}>Also requested:</Text>{requestedFlagKeys.map(_temp4)}</Box> : null;

  const t16 = request.willHide && request.willHide.length > 0 ? <Text dimColor={true}>{request.willHide.length} other{" "}{plural(request.willHide.length, "app")} will be hidden while Claude works.</Text> : null;

  const t17 = v => respond(v === "allow_all");
  const t18 = () => respond(false);

  const t19 = <Select options={options} onChange={t17} onCancel={t18} />;

  const t20 = <Box flexDirection="column" paddingX={1} paddingY={1} gap={1}>{t12}{t14_2}{t15}{t16}{t19}</Box>;

  const t21 = <Dialog title="Computer Use wants to control these apps" onCancel={t11}>{t20}</Dialog>;

  return t21;
}
function _temp4(flag) {
  return <Text key={flag} dimColor={true}>{"  "}· {flag}</Text>;
}
function _temp3(k_0) {
  return [k_0, true] as const;
}
function _temp2(a_2) {
  return {
    bundleId: a_2.resolved?.bundleId ?? a_2.requestedName,
    reason: a_2.resolved ? "user_denied" as const : "not_installed" as const
  };
}
function _temp(a) {
  return a.resolved && !a.alreadyGranted ? [a.resolved.bundleId] : [];
}
