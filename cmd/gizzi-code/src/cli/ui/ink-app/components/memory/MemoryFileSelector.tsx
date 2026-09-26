import { feature } from 'bun:bundle';
import chalk from '@/shared/util/chalk'
import { mkdir } from 'fs/promises';
import { join } from 'path';
import * as React from 'react';
import { use, useEffect, useState } from 'react';
import { getOriginalCwd } from '../../bootstrap/state';
import { useExitOnCtrlCDWithKeybindings } from '../../hooks/useExitOnCtrlCDWithKeybindings';
import { Box, Text } from '../../ink';
import { useKeybinding } from '../../keybindings/useKeybinding';
import { getAutoMemPath, isAutoMemoryEnabled } from '../../memdir/paths';
import { logEvent } from '../../services/analytics/index';
import { isAutoDreamEnabled } from '../../services/autoDream/config';
import { readLastConsolidatedAt } from '../../services/autoDream/consolidationLock';
import { useAppState } from '../../state/AppState';
import { getAgentMemoryDir } from '../../tools/AgentTool/agentMemory';
import { openPath } from '../../utils/browser';
import { getMemoryFiles, type MemoryFileInfo } from '../../utils/gizzimd';
import { getGizziConfigHomeDir } from '../../utils/envUtils';
import { getDisplayPath } from '../../utils/file';
import { formatRelativeTimeAgo } from '../../utils/format';
import { projectIsInGitRepo } from '../../utils/memory/versions';
import { updateSettingsForSource } from '../../utils/settings/settings';
import { Select } from '../CustomSelect/index';
import { ListItem } from '../design-system/ListItem';

/* eslint-disable @typescript-eslint/no-require-imports */
const teamMemPaths = feature('TEAMMEM') ? require('../../memdir/teamMemPaths.js') as typeof import('../../memdir/teamMemPaths.js') : null;
/* eslint-enable @typescript-eslint/no-require-imports */

interface ExtendedMemoryFileInfo extends MemoryFileInfo {
  isNested?: boolean;
  exists: boolean;
}

// Remember last selected path
let lastSelectedPath: string | undefined;
const OPEN_FOLDER_PREFIX = '__open_folder__';
type Props = {
  onSelect: (path: string) => void;
  onCancel: () => void;
  /**
   * 'quick-add' hides the auto-memory/auto-dream toggles and open-folder rows
   * so the selector is just the writable memory files (used by the `#`
   * quick-add flow). Default keeps the /memory editor behavior intact.
   */
  variant?: "quick-add";
};
export function MemoryFileSelector({
    onSelect,
    onCancel,
    variant
}: Props) {
  const existingMemoryFiles = use(getMemoryFiles());
  // GIZZI-first: the "new file" candidates always use the canonical GIZZI.md
  // names (matching pickMemoryFile semantics — a new write target is GIZZI.md).
  // Existing CLAUDE.md files still appear via getMemoryFiles() above, so
  // editing/writing the legacy file remains possible; it is never orphaned.
  const userMemoryPath = join(getGizziConfigHomeDir(), "GIZZI.md");
  const projectMemoryPath = join(getOriginalCwd(), "GIZZI.md");
  const hasUserMemory = existingMemoryFiles.some(f => f.path === userMemoryPath);
  const hasProjectMemory = existingMemoryFiles.some(f_0 => f_0.path === projectMemoryPath);
  const allMemoryFiles = [...existingMemoryFiles.filter(_temp).map(_temp2), ...(hasUserMemory ? [] : [{
    path: userMemoryPath,
    type: "User" as const,
    content: "",
    exists: false
  }]), ...(hasProjectMemory ? [] : [{
    path: projectMemoryPath,
    type: "Project" as const,
    content: "",
    exists: false
  }])];
  const depths = new Map();
  const memoryOptions = allMemoryFiles.map(file => {
    const displayPath = getDisplayPath(file.path);
    const existsLabel = file.exists ? "" : " (new)";
    const depth = file.parent ? (depths.get(file.parent) ?? 0) + 1 : 0;
    depths.set(file.path, depth);
    const indent = depth > 0 ? "  ".repeat(depth - 1) : "";
    let label;
    if (file.type === "User" && !file.isNested && file.path === userMemoryPath) {
      label = "User memory";
    } else {
      if (file.type === "Project" && !file.isNested && file.path === projectMemoryPath) {
        label = "Project memory";
      } else {
        if (depth > 0) {
          label = `${indent}L ${displayPath}${existsLabel}`;
        } else {
          label = `${displayPath}`;
        }
      }
    }
    let description;
    const isGit = projectIsInGitRepo(getOriginalCwd());
    if (file.type === "User" && !file.isNested) {
      description = `Saved in ${displayPath}`;
    } else {
      if (file.type === "Project" && !file.isNested && file.path === projectMemoryPath) {
        description = `${isGit ? "Checked in at" : "Saved in"} ${displayPath}`;
      } else {
        if (file.parent) {
          description = "@-imported";
        } else {
          if (file.isNested) {
            description = "dynamically loaded";
          } else {
            description = "";
          }
        }
      }
    }
    return {
      label,
      value: file.path,
      description
    };
  });
  const folderOptions = [];
  const agentDefinitions = useAppState(_temp3);
  if (isAutoMemoryEnabled()) {
    const t1 = {
        label: "Open auto-memory folder",
        value: `${OPEN_FOLDER_PREFIX}${getAutoMemPath()}`,
        description: ""
      };

    folderOptions.push(t1);
    if (feature("TEAMMEM") && teamMemPaths.isTeamMemoryEnabled()) {
      const t2 = {
          label: "Open team memory folder",
          value: `${OPEN_FOLDER_PREFIX}${teamMemPaths.getTeamMemPath()}`,
          description: ""
        };

      folderOptions.push(t2);
    }
    for (const agent of agentDefinitions.activeAgents) {
      if (agent.memory) {
        const agentDir = getAgentMemoryDir(agent.agentType, agent.memory);
        folderOptions.push({
          label: `Open ${chalk.bold(agent.agentType)} agent memory`,
          value: `${OPEN_FOLDER_PREFIX}${agentDir}`,
          description: `${agent.memory} scope`
        });
      }
    }
  }
  if (variant !== "quick-add") {
    memoryOptions.push(...folderOptions);
  }
  const t1 = lastSelectedPath && memoryOptions.some(_temp4) ? lastSelectedPath : memoryOptions[0]?.value || "";

  const initialPath = t1;
  const [autoMemoryOn, setAutoMemoryOn] = useState(isAutoMemoryEnabled);
  const [autoDreamOn, setAutoDreamOn] = useState(isAutoDreamEnabled);
  const [showDreamRow] = useState(isAutoMemoryEnabled);
  const isDreamRunning = useAppState(_temp6);
  const [lastDreamAt, setLastDreamAt] = useState(null);
  const t2 = () => {
      if (!showDreamRow) {
        return;
      }
      readLastConsolidatedAt().then(setLastDreamAt);
    };

  const t3 = [showDreamRow, isDreamRunning];

  useEffect(t2, t3);
  const t4 = isDreamRunning ? "running" : lastDreamAt === null ? "" : lastDreamAt === 0 ? "never" : `last ran ${formatRelativeTimeAgo(new Date(lastDreamAt))}`;

  const dreamStatus = t4;
  const [focusedToggle, setFocusedToggle] = useState(null);
  const toggleFocused = focusedToggle !== null;
  const lastToggleIndex = showDreamRow ? 1 : 0;
  const t5 = function handleToggleAutoMemory() {
      const newValue = !autoMemoryOn;
      updateSettingsForSource("userSettings", {
        autoMemoryEnabled: newValue
      });
      setAutoMemoryOn(newValue);
      logEvent("tengu_auto_memory_toggled", {
        enabled: newValue
      });
    };

  const handleToggleAutoMemory = t5;
  const t6 = function handleToggleAutoDream() {
      const newValue_0 = !autoDreamOn;
      updateSettingsForSource("userSettings", {
        autoDreamEnabled: newValue_0
      });
      setAutoDreamOn(newValue_0);
      logEvent("tengu_auto_dream_toggled", {
        enabled: newValue_0
      });
    };

  const handleToggleAutoDream = t6;
  useExitOnCtrlCDWithKeybindings();
  const t7 = {
      context: "Confirmation"
    };

  useKeybinding("confirm:no", onCancel, t7);
  const t8 = () => {
      if (focusedToggle === 0) {
        handleToggleAutoMemory();
      } else {
        if (focusedToggle === 1) {
          handleToggleAutoDream();
        }
      }
    };

  const t9 = {
      context: "Confirmation",
      isActive: toggleFocused
    };

  useKeybinding("confirm:yes", t8, t9);
  const t10 = () => {
      setFocusedToggle(prev => prev !== null && prev < lastToggleIndex ? prev + 1 : null);
    };

  const t11 = {
      context: "Select",
      isActive: toggleFocused
    };

  useKeybinding("select:next", t10, t11);
  const t12 = () => {
      setFocusedToggle(_temp7);
    };

  const t13 = {
      context: "Select",
      isActive: toggleFocused
    };

  useKeybinding("select:previous", t12, t13);
  const t14 = focusedToggle === 0;
  const t15 = autoMemoryOn ? "on" : "off";
  const t16 = <Text>Auto-memory: {t15}</Text>;

  const t17 = <ListItem isFocused={t14}>{t16}</ListItem>;

  const t18 = showDreamRow && <ListItem isFocused={focusedToggle === 1} styled={false}><Text color={focusedToggle === 1 ? "suggestion" : undefined}>Auto-dream: {autoDreamOn ? "on" : "off"}{dreamStatus && <Text dimColor={true}> · {dreamStatus}</Text>}{!isDreamRunning && autoDreamOn && <Text dimColor={true}> · /dream to run</Text>}</Text></ListItem>;

  const t19 = <Box flexDirection="column" marginBottom={1}>{t17}{t18}</Box>;

  const t20 = value => {
      if (value.startsWith(OPEN_FOLDER_PREFIX)) {
        const folderPath = value.slice(OPEN_FOLDER_PREFIX.length);
        mkdir(folderPath, {
          recursive: true
        }).catch(_temp8).then(() => openPath(folderPath));
        return;
      }
      lastSelectedPath = value;
      onSelect(value);
    };

  const t21 = () => setFocusedToggle(lastToggleIndex);

  const t22 = <Select defaultFocusValue={initialPath} options={memoryOptions} isDisabled={toggleFocused} onChange={t20} onCancel={onCancel} onUpFromFirstItem={t21} />;

  const t23 = <Box flexDirection="column" width="100%">{variant === "quick-add" ? null : t19}{t22}</Box>;

  return t23;
}
function _temp8() {}
function _temp7(prev_0) {
  return prev_0 !== null && prev_0 > 0 ? prev_0 - 1 : prev_0;
}
function _temp6(s_0) {
  return Object.values(s_0.tasks).some(_temp5);
}
function _temp5(t) {
  return t.type === "dream" && t.status === "running";
}
function _temp4(opt) {
  return opt.value === lastSelectedPath;
}
function _temp3(s) {
  return s.agentDefinitions;
}
function _temp2(f_2) {
  return {
    ...f_2,
    exists: true
  };
}
function _temp(f_1) {
  return f_1.type !== "AutoMem" && f_1.type !== "TeamMem";
}
