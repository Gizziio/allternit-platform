import React from 'react';
import { Text } from '../ink';
import { Select } from './CustomSelect/index';
import { Dialog } from './design-system/Dialog';
export type ChannelDowngradeChoice = 'downgrade' | 'stay' | 'cancel';
type Props = {
  currentVersion: string;
  onChoice: (choice: ChannelDowngradeChoice) => void;
};

/**
 * Dialog shown when switching from latest to stable channel.
 * Allows user to choose whether to downgrade or stay on current version.
 */
export function ChannelDowngradeDialog({
    currentVersion,
    onChoice
}: Props) {
  const t1 = function handleSelect(value) {
      onChoice(value);
    };

  const handleSelect = t1;
  const t2 = function handleCancel() {
      onChoice("cancel");
    };

  const handleCancel = t2;
  const t3 = <Text>The stable channel may have an older version than what you're currently running ({currentVersion}).</Text>;

  const t4 = <Text dimColor={true}>How would you like to handle this?</Text>;

  const t5 = {
      label: "Allow possible downgrade to stable version",
      value: "downgrade" as ChannelDowngradeChoice
    };

  const t6 = `Stay on current version (${currentVersion}) until stable catches up`;
  const t7 = [t5, {
      label: t6,
      value: "stay" as ChannelDowngradeChoice
    }];

  const t8 = <Select options={t7} onChange={handleSelect} />;

  const t9 = <Dialog title="Switch to Stable Channel" onCancel={handleCancel} color="permission" hideBorder={true} hideInputGuide={true}>{t3}{t4}{t8}</Dialog>;

  return t9;
}
