import React, { useCallback } from 'react';
import { Text } from '../ink';
import { getGlobalConfig, saveGlobalConfig } from '../utils/config';
import { isSupportedTerminal } from '../utils/ide';
import { Select } from './CustomSelect/index';
import { Dialog } from './design-system/Dialog';
type IdeAutoConnectDialogProps = {
  onComplete: () => void;
};
export function IdeAutoConnectDialog({
    onComplete
}: IdeAutoConnectDialogProps) {
  const t1 = async value => {
      const autoConnect = value === "yes";
      saveGlobalConfig(current => ({
        ...current,
        autoConnectIde: autoConnect,
        hasIdeAutoConnectDialogBeenShown: true
      }));
      onComplete();
    };

  const handleSelect = t1;
  const t2 = [{
      label: "Yes",
      value: "yes"
    }, {
      label: "No",
      value: "no"
    }];

  const options = t2;
  const t3 = <Select options={options} onChange={handleSelect} defaultValue="yes" />;

  const t4 = <Text dimColor={true}>You can also configure this in /config or with the --ide flag</Text>;

  const t5 = <Dialog title="Do you wish to enable auto-connect to IDE?" color="ide" onCancel={onComplete}>{t3}{t4}</Dialog>;

  return t5;
}
export function shouldShowAutoConnectDialog(): boolean {
  const config = getGlobalConfig();
  return !isSupportedTerminal() && config.autoConnectIde !== true && config.hasIdeAutoConnectDialogBeenShown !== true;
}
type IdeDisableAutoConnectDialogProps = {
  onComplete: (disableAutoConnect: boolean) => void;
};
export function IdeDisableAutoConnectDialog({
    onComplete
}: IdeDisableAutoConnectDialogProps) {
  const t1 = value => {
      const disableAutoConnect = value === "yes";
      if (disableAutoConnect) {
        saveGlobalConfig(_temp);
      }
      onComplete(disableAutoConnect);
    };

  const handleSelect = t1;
  const t2 = () => {
      onComplete(false);
    };

  const handleCancel = t2;
  const t3 = [{
      label: "No",
      value: "no"
    }, {
      label: "Yes",
      value: "yes"
    }];

  const options = t3;
  const t4 = <Select options={options} onChange={handleSelect} defaultValue="no" />;

  const t5 = <Dialog title="Do you wish to disable auto-connect to IDE?" subtitle="You can also configure this in /config" onCancel={handleCancel} color="ide">{t4}</Dialog>;

  return t5;
}
function _temp(current) {
  return {
    ...current,
    autoConnectIde: false
  };
}
export function shouldShowDisableAutoConnectDialog(): boolean {
  const config = getGlobalConfig();
  return !isSupportedTerminal() && config.autoConnectIde === true;
}
