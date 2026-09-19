import * as React from 'react';
import { useCallback } from 'react';
import { Select } from '../../../components/CustomSelect/select';
import { Box, Text } from '../../../ink';
import type { ToolPermissionContext } from '../../../Tool';
import { applyPermissionUpdate } from '../../../utils/permissions/PermissionUpdate';
import { Dialog } from '../../design-system/Dialog';
type Props = {
  directoryPath: string;
  onRemove: () => void;
  onCancel: () => void;
  permissionContext: ToolPermissionContext;
  setPermissionContext: (context: ToolPermissionContext) => void;
};
export function RemoveWorkspaceDirectory({
    directoryPath,
    onRemove,
    onCancel,
    permissionContext,
    setPermissionContext
}: Props) {
  const t1 = () => {
      const updatedContext = applyPermissionUpdate(permissionContext, {
        type: "removeDirectories",
        directories: [directoryPath],
        destination: "session"
      });
      setPermissionContext(updatedContext);
      onRemove();
    };

  const handleRemove = t1;
  const t2 = value => {
      if (value === "yes") {
        handleRemove();
      } else {
        onCancel();
      }
    };

  const handleSelect = t2;
  const t3 = <Box marginX={2} flexDirection="column"><Text bold={true}>{directoryPath}</Text></Box>;

  const t4 = <Text>Gizzi Code will no longer have access to files in this directory.</Text>;

  const t5 = [{
      label: "Yes",
      value: "yes"
    }, {
      label: "No",
      value: "no"
    }];

  const t6 = <Select onChange={handleSelect} onCancel={onCancel} options={t5} />;

  const t7 = <Dialog title="Remove directory from workspace?" onCancel={onCancel} color="error">{t3}{t4}{t6}</Dialog>;

  return t7;
}
