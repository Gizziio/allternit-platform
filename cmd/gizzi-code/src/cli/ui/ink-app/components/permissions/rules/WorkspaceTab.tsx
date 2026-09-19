import figures from 'figures';
import * as React from 'react';
import { useCallback, useEffect } from 'react';
import { getOriginalCwd } from '../../../bootstrap/state';
import type { CommandResultDisplay } from '../../../commands';
import { Select } from '../../../components/CustomSelect/select';
import { Box, Text } from '../../../ink';
import type { ToolPermissionContext } from '../../../Tool';
import { useTabHeaderFocus } from '../../design-system/Tabs';
type Props = {
  onExit: (result?: string, options?: {
    display?: CommandResultDisplay;
  }) => void;
  toolPermissionContext: ToolPermissionContext;
  onRequestAddDirectory: () => void;
  onRequestRemoveDirectory: (path: string) => void;
  onHeaderFocusChange?: (focused: boolean) => void;
};
type DirectoryItem = {
  path: string;
  isCurrent: boolean;
  isDeletable: boolean;
};
export function WorkspaceTab({
    onExit,
    toolPermissionContext,
    onRequestAddDirectory,
    onRequestRemoveDirectory,
    onHeaderFocusChange
}: Props) {
  const {
    headerFocused,
    focusHeader
  } = useTabHeaderFocus();
  const t1 = () => {
      onHeaderFocusChange?.(headerFocused);
    };
  const t2 = [headerFocused, onHeaderFocusChange];

  useEffect(t1, t2);
  const t3 = Array.from(toolPermissionContext.additionalWorkingDirectories.keys()).map(_temp);

  const additionalDirectories = t3;
  const t4 = selectedValue => {
      if (selectedValue === "add-directory") {
        onRequestAddDirectory();
        return;
      }
      const directory = additionalDirectories.find(d => d.path === selectedValue);
      if (directory && directory.isDeletable) {
        onRequestRemoveDirectory(directory.path);
      }
    };

  const handleDirectorySelect = t4;
  const t5 = () => onExit("Workspace dialog dismissed", {
      display: "system"
    });

  const handleCancel = t5;
  const opts = additionalDirectories.map(_temp2);
  const t6 = {
        label: `Add directory${figures.ellipsis}`,
        value: "add-directory"
      };

  opts.push(t6);

  const options = opts;
  const t6_2 = <Box flexDirection="row" marginTop={1} marginLeft={2} gap={1}><Text>{`-  ${getOriginalCwd()}`}</Text><Text dimColor={true}>(Original working directory)</Text></Box>;

  const t7 = Math.min(10, options.length);
  const t8 = <Box flexDirection="column" marginBottom={1}>{t6_2}<Select options={options} onChange={handleDirectorySelect} onCancel={handleCancel} visibleOptionCount={t7} onUpFromFirstItem={focusHeader} isDisabled={headerFocused} /></Box>;

  return t8;
}
function _temp2(dir) {
  return {
    label: dir.path,
    value: dir.path
  };
}
function _temp(path) {
  return {
    path,
    isCurrent: false,
    isDeletable: true
  };
}
