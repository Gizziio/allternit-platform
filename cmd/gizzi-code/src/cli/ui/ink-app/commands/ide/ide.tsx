import chalk from '@/shared/util/chalk'
import * as path from 'path';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { logEvent } from './../../services/analytics/index.ts';
import type { CommandResultDisplay, LocalJSXCommandContext } from '../../commands';
import { Select } from '../../components/CustomSelect/index';
import { Dialog } from '../../components/design-system/Dialog';
import { IdeAutoConnectDialog, IdeDisableAutoConnectDialog, shouldShowAutoConnectDialog, shouldShowDisableAutoConnectDialog } from '../../components/IdeAutoConnectDialog';
import { Box, Text } from '../../ink';
import { clearServerCache } from '../../services/mcp/client';
import type { ScopedMcpServerConfig } from '../../services/mcp/types';
import { useAppState, useSetAppState } from '../../state/AppState';
import { getCwd } from '../../utils/cwd';
import { execFileNoThrow } from '../../utils/execFileNoThrow';
import { type DetectedIDEInfo, detectIDEs, detectRunningIDEs, type IdeType, isJetBrainsIde, isSupportedJetBrainsTerminal, isSupportedTerminal, toIDEDisplayName } from '../../utils/ide';
import { getCurrentWorktreeSession } from '../../utils/worktree';
type IDEScreenProps = {
  availableIDEs: DetectedIDEInfo[];
  unavailableIDEs: DetectedIDEInfo[];
  selectedIDE?: DetectedIDEInfo | null;
  onClose: () => void;
  onSelect: (ide?: DetectedIDEInfo) => void;
};
function IDEScreen({
    availableIDEs,
    unavailableIDEs,
    selectedIDE,
    onClose,
    onSelect
}: IDEScreenProps) {
  const t1 = selectedIDE?.port?.toString() ?? "None";

  const [selectedValue, setSelectedValue] = useState(t1);
  const [showAutoConnectDialog, setShowAutoConnectDialog] = useState(false);
  const [showDisableAutoConnectDialog, setShowDisableAutoConnectDialog] = useState(false);
  const t2 = value => {
      if (value !== "None" && shouldShowAutoConnectDialog()) {
        setShowAutoConnectDialog(true);
      } else {
        if (value === "None" && shouldShowDisableAutoConnectDialog()) {
          setShowDisableAutoConnectDialog(true);
        } else {
          onSelect(availableIDEs.find(ide => ide.port === parseInt(value)));
        }
      }
    };

  const handleSelectIDE = t2;
  const t3 = availableIDEs.reduce(_temp, {});

  const ideCounts = t3;
  const t5 = ide_1 => {
        const hasMultipleInstances = (ideCounts[ide_1.name] || 0) > 1;
        const showWorkspace = hasMultipleInstances && ide_1.workspaceFolders.length > 0;
        return {
          label: ide_1.name,
          value: ide_1.port.toString(),
          description: showWorkspace ? formatWorkspaceFolders(ide_1.workspaceFolders) : undefined
        };
      };

  const t4 = availableIDEs.map(t5).concat([{
      label: "None",
      value: "None",
      description: undefined
    }]);

  const options = t4;
  if (showAutoConnectDialog) {
    const t5 = <IdeAutoConnectDialog onComplete={() => handleSelectIDE(selectedValue)} />;

    return t5;
  }
  if (showDisableAutoConnectDialog) {
    const t5 = <IdeDisableAutoConnectDialog onComplete={() => {
        onSelect(undefined);
      }} />;

    return t5;
  }
  const t5_2 = availableIDEs.length === 0 && <Text dimColor={true}>{isSupportedJetBrainsTerminal() ? "No available IDEs detected. Please install the plugin and restart your IDE:\nhttps://docs.gizziio.com" : "No available IDEs detected. Make sure your IDE has the gizzi-code extension or plugin installed and is running."}</Text>;

  const t6 = availableIDEs.length !== 0 && <Select defaultValue={selectedValue} defaultFocusValue={selectedValue} options={options} onChange={value_0 => {
      setSelectedValue(value_0);
      handleSelectIDE(value_0);
    }} />;

  const t7 = availableIDEs.length !== 0 && availableIDEs.some(_temp2) && <Box marginTop={1}><Text color="warning">Note: Only one Gizzi Code instance can be connected to VS Code at a time.</Text></Box>;

  const t8 = availableIDEs.length !== 0 && !isSupportedTerminal() && <Box marginTop={1}><Text dimColor={true}>Tip: You can enable auto-connect to IDE in /config or with the --ide flag</Text></Box>;

  const t9 = unavailableIDEs.length > 0 && <Box marginTop={1} flexDirection="column"><Text dimColor={true}>Found {unavailableIDEs.length} other running IDE(s). However, their workspace/project directories do not match the current cwd.</Text><Box marginTop={1} flexDirection="column">{unavailableIDEs.map(_temp3)}</Box></Box>;

  const t10 = <Box flexDirection="column">{t5_2}{t6}{t7}{t8}{t9}</Box>;

  const t11 = <Dialog title="Select IDE" subtitle="Connect to an IDE for integrated development features." onCancel={onClose} color="ide">{t10}</Dialog>;

  return t11;
}
function _temp3(ide_3, index) {
  return <Box key={index} paddingLeft={3}><Text dimColor={true}>• {ide_3.name}: {formatWorkspaceFolders(ide_3.workspaceFolders)}</Text></Box>;
}
function _temp2(ide_2) {
  return ide_2.name === "VS Code" || ide_2.name === "Visual Studio Code";
}
function _temp(acc, ide_0) {
  acc[ide_0.name] = (acc[ide_0.name] || 0) + 1;
  return acc;
}
async function findCurrentIDE(availableIDEs: DetectedIDEInfo[], dynamicMcpConfig?: Record<string, ScopedMcpServerConfig>): Promise<DetectedIDEInfo | null> {
  const currentConfig = dynamicMcpConfig?.ide;
  if (!currentConfig || currentConfig.type !== 'sse-ide' && currentConfig.type !== 'ws-ide') {
    return null;
  }
  for (const ide of availableIDEs) {
    if (ide.url === currentConfig.url) {
      return ide;
    }
  }
  return null;
}
type IDEOpenSelectionProps = {
  availableIDEs: DetectedIDEInfo[];
  onSelectIDE: (ide?: DetectedIDEInfo) => void;
  onDone: (result?: string, options?: {
    display?: CommandResultDisplay;
  }) => void;
};
function IDEOpenSelection({
    availableIDEs,
    onSelectIDE,
    onDone
}: IDEOpenSelectionProps) {
  const t1 = availableIDEs[0]?.port?.toString() ?? "";

  const [selectedValue, setSelectedValue] = useState(t1);
  const t2 = value => {
      const selectedIDE = availableIDEs.find(ide => ide.port === parseInt(value));
      onSelectIDE(selectedIDE);
    };

  const handleSelectIDE = t2;
  const t3 = availableIDEs.map(_temp4);

  const options = t3;
  const t4 = function handleCancel() {
      onDone("IDE selection cancelled", {
        display: "system"
      });
    };

  const handleCancel = t4;
  const t5 = value_0 => {
      setSelectedValue(value_0);
      handleSelectIDE(value_0);
    };

  const t6 = <Select defaultValue={selectedValue} defaultFocusValue={selectedValue} options={options} onChange={t5} />;

  const t7 = <Dialog title="Select an IDE to open the project" onCancel={handleCancel} color="ide">{t6}</Dialog>;

  return t7;
}
function _temp4(ide_0) {
  return {
    label: ide_0.name,
    value: ide_0.port.toString()
  };
}
function RunningIDESelector(t0) {
  const {
    runningIDEs,
    onSelectIDE,
    onDone
  } = t0;
  const [selectedValue, setSelectedValue] = useState(runningIDEs[0] ?? "");
  const t1 = value => {
      onSelectIDE(value as IdeType);
    };

  const handleSelectIDE = t1;
  const t2 = runningIDEs.map(_temp5);

  const options = t2;
  const t3 = function handleCancel() {
      onDone("IDE selection cancelled", {
        display: "system"
      });
    };

  const handleCancel = t3;
  const t4 = value_0 => {
      setSelectedValue(value_0);
      handleSelectIDE(value_0);
    };

  const t5 = <Select defaultFocusValue={selectedValue} options={options} onChange={t4} />;

  const t6 = <Dialog title="Select IDE to install extension" onCancel={handleCancel} color="ide">{t5}</Dialog>;

  return t6;
}
function _temp5(ide) {
  return {
    label: toIDEDisplayName(ide),
    value: ide
  };
}
function InstallOnMount(t0) {
  const {
    ide,
    onInstall
  } = t0;
  const t1 = () => {
      onInstall(ide);
    };
  const t2 = [ide, onInstall];

  useEffect(t1, t2);
  return null;
}
export async function call(onDone: (result?: string, options?: {
  display?: CommandResultDisplay;
}) => void, context: LocalJSXCommandContext, args: string): Promise<React.ReactNode | null> {
  logEvent('tengu_ext_ide_command', {});
  const {
    options: {
      dynamicMcpConfig
    },
    onChangeDynamicMcpConfig
  } = context;

  // Handle 'open' argument
  if (args?.trim() === 'open') {
    const worktreeSession = getCurrentWorktreeSession();
    const targetPath = worktreeSession ? worktreeSession.worktreePath : getCwd();

    // Detect available IDEs
    const detectedIDEs = await detectIDEs(true);
    const availableIDEs = detectedIDEs.filter(ide => ide.isValid);
    if (availableIDEs.length === 0) {
      onDone('No IDEs with Gizzi Code extension detected.');
      return null;
    }

    // Return IDE selection component
    return <IDEOpenSelection availableIDEs={availableIDEs} onSelectIDE={async (selectedIDE?: DetectedIDEInfo) => {
      if (!selectedIDE) {
        onDone('No IDE selected.');
        return;
      }

      // Try to open the project in the selected IDE
      if (selectedIDE.name.toLowerCase().includes('vscode') || selectedIDE.name.toLowerCase().includes('cursor') || selectedIDE.name.toLowerCase().includes('windsurf')) {
        // VS Code-based IDEs
        const {
          code
        } = await execFileNoThrow('code', [targetPath]);
        if (code === 0) {
          onDone(`Opened ${worktreeSession ? 'worktree' : 'project'} in ${chalk.bold(selectedIDE.name)}`);
        } else {
          onDone(`Failed to open in ${selectedIDE.name}. Try opening manually: ${targetPath}`);
        }
      } else if (isSupportedJetBrainsTerminal()) {
        // JetBrains IDEs - they usually open via their CLI tools
        onDone(`Please open the ${worktreeSession ? 'worktree' : 'project'} manually in ${chalk.bold(selectedIDE.name)}: ${targetPath}`);
      } else {
        onDone(`Please open the ${worktreeSession ? 'worktree' : 'project'} manually in ${chalk.bold(selectedIDE.name)}: ${targetPath}`);
      }
    }} onDone={() => {
      onDone('Exited without opening IDE', {
        display: 'system'
      });
    }} />;
  }
  const detectedIDEs = await detectIDEs(true);

  // If no IDEs with extensions detected, check for running IDEs and offer to install
  if (detectedIDEs.length === 0 && context.onInstallIDEExtension && !isSupportedTerminal()) {
    const runningIDEs = await detectRunningIDEs();
    const onInstall = (ide: IdeType) => {
      if (context.onInstallIDEExtension) {
        context.onInstallIDEExtension(ide);
        // The completion message will be shown after installation
        if (isJetBrainsIde(ide)) {
          onDone(`Installed plugin to ${chalk.bold(toIDEDisplayName(ide))}\n` + `Please ${chalk.bold('restart your IDE')} completely for it to take effect`);
        } else {
          onDone(`Installed extension to ${chalk.bold(toIDEDisplayName(ide))}`);
        }
      }
    };
    if (runningIDEs.length > 1) {
      // Show selector when multiple IDEs are running
      return <RunningIDESelector runningIDEs={runningIDEs} onSelectIDE={onInstall} onDone={() => {
        onDone('No IDE selected.', {
          display: 'system'
        });
      }} />;
    } else if (runningIDEs.length === 1) {
      return <InstallOnMount ide={runningIDEs[0]!} onInstall={onInstall} />;
    }
  }
  const availableIDEs = detectedIDEs.filter(ide => ide.isValid);
  const unavailableIDEs = detectedIDEs.filter(ide => !ide.isValid);
  const currentIDE = await findCurrentIDE(availableIDEs, dynamicMcpConfig);
  return <IDECommandFlow availableIDEs={availableIDEs} unavailableIDEs={unavailableIDEs} currentIDE={currentIDE} dynamicMcpConfig={dynamicMcpConfig} onChangeDynamicMcpConfig={onChangeDynamicMcpConfig} onDone={onDone} />;
}

// Connection timeout slightly longer than the 30s MCP connection timeout
const IDE_CONNECTION_TIMEOUT_MS = 35000;
type IDECommandFlowProps = {
  availableIDEs: DetectedIDEInfo[];
  unavailableIDEs: DetectedIDEInfo[];
  currentIDE: DetectedIDEInfo | null;
  dynamicMcpConfig?: Record<string, ScopedMcpServerConfig>;
  onChangeDynamicMcpConfig?: (config: Record<string, ScopedMcpServerConfig>) => void;
  onDone: (result?: string, options?: {
    display?: CommandResultDisplay;
  }) => void;
};
function IDECommandFlow({
  availableIDEs,
  unavailableIDEs,
  currentIDE,
  dynamicMcpConfig,
  onChangeDynamicMcpConfig,
  onDone
}: IDECommandFlowProps): React.ReactNode {
  const [connectingIDE, setConnectingIDE] = useState<DetectedIDEInfo | null>(null);
  const ideClient = useAppState(s => s.mcp.clients.find(c => c.name === 'ide'));
  const setAppState = useSetAppState();
  const isFirstCheckRef = useRef(true);

  // Watch for connection result
  useEffect(() => {
    if (!connectingIDE) return;
    // Skip the first check — it reflects stale state from before the
    // config change was dispatched
    if (isFirstCheckRef.current) {
      isFirstCheckRef.current = false;
      return;
    }
    if (!ideClient || ideClient.type === 'pending') return;
    if (ideClient.type === 'connected') {
      onDone(`Connected to ${connectingIDE.name}.`);
    } else if (ideClient.type === 'failed') {
      onDone(`Failed to connect to ${connectingIDE.name}.`);
    }
  }, [ideClient, connectingIDE, onDone]);

  // Timeout fallback
  useEffect(() => {
    if (!connectingIDE) return;
    const timer = setTimeout(onDone, IDE_CONNECTION_TIMEOUT_MS, `Connection to ${connectingIDE.name} timed out.`);
    return () => clearTimeout(timer);
  }, [connectingIDE, onDone]);
  const handleSelectIDE = useCallback((selectedIDE?: DetectedIDEInfo) => {
    if (!onChangeDynamicMcpConfig) {
      onDone('Error connecting to IDE.');
      return;
    }
    const newConfig = {
      ...(dynamicMcpConfig || {})
    };
    if (currentIDE) {
      delete newConfig.ide;
    }
    if (!selectedIDE) {
      // Close the MCP transport and remove the client from state
      if (ideClient && ideClient.type === 'connected' && currentIDE) {
        // Null out onclose to prevent auto-reconnection
        ideClient.client.onclose = () => {};
        void clearServerCache('ide', ideClient.config);
        setAppState(prev => ({
          ...prev,
          mcp: {
            ...prev.mcp,
            clients: prev.mcp.clients.filter(c_0 => c_0.name !== 'ide'),
            tools: prev.mcp.tools.filter(t => !t.name?.startsWith('mcp__ide__')),
            commands: prev.mcp.commands.filter(c_1 => !c_1.name?.startsWith('mcp__ide__'))
          }
        }));
      }
      onChangeDynamicMcpConfig(newConfig);
      onDone(currentIDE ? `Disconnected from ${currentIDE.name}.` : 'No IDE selected.');
      return;
    }
    const url = selectedIDE.url;
    newConfig.ide = {
      type: url.startsWith('ws:') ? 'ws-ide' : 'sse-ide',
      url: url,
      ideName: selectedIDE.name,
      authToken: selectedIDE.authToken,
      ideRunningInWindows: selectedIDE.ideRunningInWindows,
      scope: 'dynamic' as const
    } as ScopedMcpServerConfig;
    isFirstCheckRef.current = true;
    setConnectingIDE(selectedIDE);
    onChangeDynamicMcpConfig(newConfig);
  }, [dynamicMcpConfig, currentIDE, ideClient, setAppState, onChangeDynamicMcpConfig, onDone]);
  if (connectingIDE) {
    return <Text dimColor>Connecting to {connectingIDE.name}…</Text>;
  }
  return <IDEScreen availableIDEs={availableIDEs} unavailableIDEs={unavailableIDEs} selectedIDE={currentIDE} onClose={() => onDone('IDE selection cancelled', {
    display: 'system'
  })} onSelect={handleSelectIDE} />;
}

/**
 * Formats workspace folders for display, stripping cwd and showing tail end of paths
 * @param folders Array of folder paths
 * @param maxLength Maximum total length of the formatted string
 * @returns Formatted string with folder paths
 */
export function formatWorkspaceFolders(folders: string[], maxLength: number = 100): string {
  if (folders.length === 0) return '';
  const cwd = getCwd();

  // Only show first 2 workspaces
  const foldersToShow = folders.slice(0, 2);
  const hasMore = folders.length > 2;

  // Account for ", …" if there are more folders
  const ellipsisOverhead = hasMore ? 3 : 0; // ", …"

  // Account for commas and spaces between paths (", " = 2 chars per separator)
  const separatorOverhead = (foldersToShow.length - 1) * 2;
  const availableLength = maxLength - separatorOverhead - ellipsisOverhead;
  const maxLengthPerPath = Math.floor(availableLength / foldersToShow.length);
  const cwdNFC = cwd.normalize('NFC');
  const formattedFolders = foldersToShow.map(folder => {
    // Strip cwd from the beginning if present
    // Normalize both to NFC for consistent comparison (macOS uses NFD paths)
    const folderNFC = folder.normalize('NFC');
    if (folderNFC.startsWith(cwdNFC + path.sep)) {
      folder = folderNFC.slice(cwdNFC.length + 1);
    }
    if (folder.length <= maxLengthPerPath) {
      return folder;
    }
    return '…' + folder.slice(-(maxLengthPerPath - 1));
  });
  let result = formattedFolders.join(', ');
  if (hasMore) {
    result += ', …';
  }
  return result;
}
