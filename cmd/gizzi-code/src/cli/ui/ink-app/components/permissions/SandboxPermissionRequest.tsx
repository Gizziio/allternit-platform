import * as React from 'react';
import { Box, Text } from './../../ink.ts';
import { type NetworkHostPattern, shouldAllowManagedSandboxDomainsOnly } from './../../utils/sandbox/sandbox-adapter.ts';
import { type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS, logEvent } from '../../services/analytics/index';
import { Select } from '../CustomSelect/select';
import { PermissionDialog } from './PermissionDialog';
export type SandboxPermissionRequestProps = {
  hostPattern: NetworkHostPattern;
  onUserResponse: (response: {
    allow: boolean;
    persistToSettings: boolean;
  }) => void;
};
export function SandboxPermissionRequest({
    hostPattern: t1,
    onUserResponse
}: SandboxPermissionRequestProps) {
  const {
    host
  } = t1;
  const t2 = function onSelect(value) {
      bb4: switch (value) {
        case "yes":
          {
            onUserResponse({
              allow: true,
              persistToSettings: false
            });
            break bb4;
          }
        case "yes-dont-ask-again":
          {
            onUserResponse({
              allow: true,
              persistToSettings: true
            });
            break bb4;
          }
        case "no":
          {
            onUserResponse({
              allow: false,
              persistToSettings: false
            });
          }
      }
    };

  const onSelect = t2;
  const t3 = shouldAllowManagedSandboxDomainsOnly();

  const managedDomainsOnly = t3;
  const t4 = {
      label: "Yes",
      value: "yes"
    };

  const t5 = !managedDomainsOnly ? [{
      label: <Text>Yes, and don't ask again for <Text bold={true}>{host}</Text></Text>,
      value: "yes-dont-ask-again"
    }] : [];

  const t6 = {
      label: <Text>No, and tell Gizzi what to do differently <Text bold={true}>(esc)</Text></Text>,
      value: "no"
    };

  const t7 = [t4, ...t5, t6];

  const options = t7;
  const t8 = <Text dimColor={true}>Host:</Text>;

  const t9 = <Box>{t8}<Text> {host}</Text></Box>;

  const t10 = <Box marginTop={1}><Text>Do you want to allow this connection?</Text></Box>;

  const t11 = () => {
      onUserResponse({
        allow: false,
        persistToSettings: false
      });
    };

  const t12 = <Box><Select options={options} onChange={onSelect} onCancel={t11} /></Box>;

  const t13 = <PermissionDialog title="Network request outside of sandbox"><Box flexDirection="column" paddingX={2} paddingY={1}>{t9}{t10}{t12}</Box></PermissionDialog>;

  return t13;
}
