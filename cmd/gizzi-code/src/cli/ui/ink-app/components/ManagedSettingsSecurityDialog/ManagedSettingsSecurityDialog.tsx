import React from 'react';
import { useExitOnCtrlCDWithKeybindings } from '../../hooks/useExitOnCtrlCDWithKeybindings';
import { Box, Text } from '../../ink';
import { useKeybinding } from '../../keybindings/useKeybinding';
import type { SettingsJson } from '../../utils/settings/types';
import { Select } from '../CustomSelect/index';
import { PermissionDialog } from '../permissions/PermissionDialog';
import { extractDangerousSettings, formatDangerousSettingsList } from './utils';
type Props = {
  settings: SettingsJson;
  onAccept: () => void;
  onReject: () => void;
};
export function ManagedSettingsSecurityDialog({
    settings,
    onAccept,
    onReject
}: Props) {
  const dangerous = extractDangerousSettings(settings);
  const settingsList = formatDangerousSettingsList(dangerous);
  const exitState = useExitOnCtrlCDWithKeybindings();
  const t1 = {
      context: "Confirmation"
    };

  useKeybinding("confirm:no", onReject, t1);
  const t2 = function onChange(value) {
      if (value === "exit") {
        onReject();
        return;
      }
      onAccept();
    };

  const onChange = t2;
  const T0 = PermissionDialog;
  const t3 = "warning";
  const t4 = "warning";
  const t5 = "Managed settings require approval";
  const T1 = Box;
  const t6 = "column";
  const t7 = 1;
  const t8 = 1;
  const t9 = <Text>Your organization has configured managed settings that could allow execution of arbitrary code or interception of your prompts and responses.</Text>;

  const T2 = Box;
  const t10 = "column";
  const t11 = <Text dimColor={true}>Settings requiring approval:</Text>;

  const t12 = settingsList.map(_temp);
  const t13 = <T2 flexDirection={t10}>{t11}{t12}</T2>;

  const t14 = <Text>Only accept if you trust your organization's IT administration and expect these settings to be configured.</Text>;

  const t15 = [{
      label: "Yes, I trust these settings",
      value: "accept"
    }, {
      label: "No, exit Gizzi Code",
      value: "exit"
    }];

  const t16 = <Select options={t15} onChange={value_0 => onChange(value_0 as 'accept' | 'exit')} onCancel={() => onChange("exit")} />;

  const t17 = <Text dimColor={true}>{exitState.pending ? <>Press {exitState.keyName} again to exit</> : <>Enter to confirm · Esc to exit</>}</Text>;

  const t18 = <T1 flexDirection={t6} gap={t7} paddingTop={t8}>{t9}{t13}{t14}{t16}{t17}</T1>;

  const t19 = <T0 color={t3} titleColor={t4} title={t5}>{t18}</T0>;

  return t19;
}
function _temp(item, index) {
  return <Box key={index} paddingLeft={2}><Text><Text dimColor={true}>· </Text><Text>{item}</Text></Text></Box>;
}
