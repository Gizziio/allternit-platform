import chalk from '@/shared/util/chalk'
import figures from 'figures';
import React, { useEffect } from 'react';
import { getAdditionalDirectoriesForGizziMd, setAdditionalDirectoriesForClaudeMd } from '../../bootstrap/state';
import type { LocalJSXCommandContext } from '../../commands';
import { MessageResponse } from '../../components/MessageResponse';
import { AddWorkspaceDirectory } from '../../components/permissions/rules/AddWorkspaceDirectory';
import { Box, Text } from '../../ink';
import type { LocalJSXCommandOnDone } from '../../types/command';
import { applyPermissionUpdate, persistPermissionUpdate } from '../../utils/permissions/PermissionUpdate';
import type { PermissionUpdateDestination } from '../../utils/permissions/PermissionUpdateSchema';
import { SandboxManager } from '../../utils/sandbox/sandbox-adapter';
import { addDirHelpMessage, validateDirectoryForWorkspace } from './validation';
function AddDirError(t0) {
  const {
    message,
    args,
    onDone
  } = t0;
  const t1 = () => {
      const timer = setTimeout(onDone, 0);
      return () => clearTimeout(timer);
    };
  const t2 = [onDone];

  useEffect(t1, t2);
  const t3 = <Text dimColor={true}>{figures.pointer} /add-dir {args}</Text>;

  const t4 = <MessageResponse><Text>{message}</Text></MessageResponse>;

  const t5 = <Box flexDirection="column">{t3}{t4}</Box>;

  return t5;
}
export async function call(onDone: LocalJSXCommandOnDone, context: LocalJSXCommandContext, args?: string): Promise<React.ReactNode> {
  const directoryPath = (args ?? '').trim();
  const appState = context.getAppState();

  // Helper to handle adding a directory (shared by both with-path and no-path cases)
  const handleAddDirectory = async (path: string, remember = false) => {
    const destination: PermissionUpdateDestination = remember ? 'localSettings' : 'session';
    const permissionUpdate = {
      type: 'addDirectories' as const,
      directories: [path],
      destination
    };

    // Apply to session context
    const latestAppState = context.getAppState();
    const updatedContext = applyPermissionUpdate(latestAppState.toolPermissionContext, permissionUpdate);
    context.setAppState(prev => ({
      ...prev,
      toolPermissionContext: updatedContext
    }));

    // Update sandbox config so Bash commands can access the new directory.
    // Bootstrap state is the source of truth for session-only dirs; persisted
    // dirs are picked up via the settings subscription, but we refresh
    // eagerly here to avoid a race when the user acts immediately.
    const currentDirs = getAdditionalDirectoriesForGizziMd();
    if (!currentDirs.includes(path)) {
      setAdditionalDirectoriesForClaudeMd([...currentDirs, path]);
    }
    SandboxManager.refreshConfig();
    let message: string;
    if (remember) {
      try {
        persistPermissionUpdate(permissionUpdate);
        message = `Added ${chalk.bold(path)} as a working directory and saved to local settings`;
      } catch (error) {
        message = `Added ${chalk.bold(path)} as a working directory. Failed to save to local settings: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    } else {
      message = `Added ${chalk.bold(path)} as a working directory for this session`;
    }
    const messageWithHint = `${message} ${chalk.dim('· /permissions to manage')}`;
    onDone(messageWithHint);
  };

  // When no path is provided, show AddWorkspaceDirectory input form directly
  // and return to REPL after confirmation
  if (!directoryPath) {
    return <AddWorkspaceDirectory permissionContext={appState.toolPermissionContext} onAddDirectory={handleAddDirectory} onCancel={() => {
      onDone('Did not add a working directory.');
    }} />;
  }
  const result = await validateDirectoryForWorkspace(directoryPath, appState.toolPermissionContext);
  if (result.resultType !== 'success') {
    const message = addDirHelpMessage(result);
    return <AddDirError message={message} args={args ?? ''} onDone={() => onDone(message)} />;
  }
  return <AddWorkspaceDirectory directoryPath={result.absolutePath} permissionContext={appState.toolPermissionContext} onAddDirectory={handleAddDirectory} onCancel={() => {
    onDone(`Did not add ${chalk.bold(result.absolutePath)} as a working directory.`);
  }} />;
}
