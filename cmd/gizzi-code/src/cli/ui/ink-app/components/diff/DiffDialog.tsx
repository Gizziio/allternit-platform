import type { StructuredPatchHunk } from 'diff';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { CommandResultDisplay } from '../../commands';
import { useRegisterOverlay } from '../../context/overlayContext';
import { type DiffData, useDiffData } from '../../hooks/useDiffData';
import { type TurnDiff, useTurnDiffs } from '../../hooks/useTurnDiffs';
import { Box, Text } from '../../ink';
import { useKeybindings } from '../../keybindings/useKeybinding';
import { useShortcutDisplay } from '../../keybindings/useShortcutDisplay';
import type { Message } from '../../types/message';
import { plural } from '../../utils/stringUtils';
import { Byline } from '../design-system/Byline';
import { Dialog } from '../design-system/Dialog';
import { DiffDetailView } from './DiffDetailView';
import { DiffFileList } from './DiffFileList';
type Props = {
  messages: Message[];
  onDone: (result?: string, options?: {
    display?: CommandResultDisplay;
  }) => void;
};
type ViewMode = 'list' | 'detail';
type DiffSource = {
  type: 'current';
} | {
  type: 'turn';
  turn: TurnDiff;
};
function turnDiffToDiffData(turn: TurnDiff): DiffData {
  const files = Array.from(turn.files.values()).map(f => ({
    path: f.filePath,
    linesAdded: f.linesAdded,
    linesRemoved: f.linesRemoved,
    isBinary: false,
    isLargeFile: false,
    isTruncated: false,
    isNewFile: f.isNewFile
  })).sort((a, b) => a.path.localeCompare(b.path));
  const hunks = new Map<string, StructuredPatchHunk[]>();
  for (const f of turn.files.values()) {
    hunks.set(f.filePath, f.hunks);
  }
  return {
    stats: {
      filesCount: turn.stats.filesChanged,
      linesAdded: turn.stats.linesAdded,
      linesRemoved: turn.stats.linesRemoved
    },
    files,
    hunks,
    loading: false
  };
}
export function DiffDialog({
    messages,
    onDone
}: Props) {
  const gitDiffData = useDiffData();
  const turnDiffs = useTurnDiffs(messages);
  const [viewMode, setViewMode] = useState("list");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [sourceIndex, setSourceIndex] = useState(0);
  const t1: DiffSource = {
      type: "current"
    };

  const t2 = [t1, ...turnDiffs.map(_temp)];

  const sources = t2;
  const currentSource = sources[sourceIndex];
  const currentTurn = currentSource?.type === "turn" ? currentSource.turn : null;
  const t3 = currentTurn ? turnDiffToDiffData(currentTurn) : gitDiffData;

  const diffData = t3;
  const selectedFile = diffData.files[selectedIndex];
  const t4 = selectedFile ? diffData.hunks.get(selectedFile.path) || [] : [];

  const selectedHunks = t4;
  const t5 = () => {
      if (sourceIndex >= sources.length) {
        setSourceIndex(Math.max(0, sources.length - 1));
      }
    };
  const t6 = [sources.length, sourceIndex];

  useEffect(t5, t6);
  const prevSourceIndex = useRef(sourceIndex);
  const t7 = () => {
      if (prevSourceIndex.current !== sourceIndex) {
        setSelectedIndex(0);
        prevSourceIndex.current = sourceIndex;
      }
    };
  const t8 = [sourceIndex];

  useEffect(t7, t8);
  useRegisterOverlay("diff-dialog", undefined);
  const t9 = () => {
      if (viewMode === "detail") {
        setViewMode("list");
      } else {
        if (viewMode === "list" && sources.length > 1) {
          setSourceIndex(_temp2);
        }
      }
    };
  const t10 = () => {
      if (viewMode === "list" && sources.length > 1) {
        setSourceIndex(prev_0 => Math.min(sources.length - 1, prev_0 + 1));
      }
    };

  const t11 = () => {
      if (viewMode === "detail") {
        setViewMode("list");
      }
    };

  const t12 = () => {
      if (viewMode === "list" && selectedFile) {
        setViewMode("detail");
      }
    };

  const t13 = () => {
      if (viewMode === "list") {
        setSelectedIndex(_temp3);
      }
    };

  const t14 = () => {
      if (viewMode === "list") {
        setSelectedIndex(prev_2 => Math.min(diffData.files.length - 1, prev_2 + 1));
      }
    };

  const t15 = {
      "diff:previousSource": t9,
      "diff:nextSource": t10,
      "diff:back": t11,
      "diff:viewDetails": t12,
      "diff:previousFile": t13,
      "diff:nextFile": t14
    };

  const t16 = {
      context: "DiffDialog"
    };

  useKeybindings(t15, t16);
  const t17 = diffData.stats ? <Text dimColor={true}>{diffData.stats.filesCount} {plural(diffData.stats.filesCount, "file")}{" "}changed{diffData.stats.linesAdded > 0 && <Text color="diffAddedWord"> +{diffData.stats.linesAdded}</Text>}{diffData.stats.linesRemoved > 0 && <Text color="diffRemovedWord"> -{diffData.stats.linesRemoved}</Text>}</Text> : null;

  const subtitle = t17;
  const headerTitle = currentTurn ? `Turn ${currentTurn.turnIndex}` : "Uncommitted changes";
  const headerSubtitle = currentTurn ? currentTurn.userPromptPreview ? `"${currentTurn.userPromptPreview}"` : "" : "(git diff HEAD)";
  const t18 = sources.length > 1 ? <Box>{sourceIndex > 0 && <Text dimColor={true}>◀ </Text>}{sources.map((source, i) => {
        const isSelected = i === sourceIndex;
        const label = source.type === "current" ? "Current" : `T${source.turn.turnIndex}`;
        return <Text key={i} dimColor={!isSelected} bold={isSelected}>{i > 0 ? " \xB7 " : ""}{label}</Text>;
      })}{sourceIndex < sources.length - 1 && <Text dimColor={true}> ▶</Text>}</Box> : null;

  const sourceSelector = t18;
  const dismissShortcut = useShortcutDisplay("diff:dismiss", "DiffDialog", "esc");
  let t19;
  bb0: {
    if (diffData.loading) {
      t19 = "Loading diff\u2026";
      break bb0;
    }
    if (currentTurn) {
      t19 = "No file changes in this turn";
      break bb0;
    }
    if (diffData.stats && diffData.stats.filesCount > 0 && diffData.files.length === 0) {
      t19 = "Too many files to display details";
      break bb0;
    }
    t19 = "Working tree is clean";
  }
  const emptyMessage = t19;
  const t20 = headerSubtitle && <Text dimColor={true}> {headerSubtitle}</Text>;

  const t21 = <Text>{headerTitle}{t20}</Text>;

  const title = t21;
  const t22 = function handleCancel() {
      if (viewMode === "detail") {
        setViewMode("list");
      } else {
        onDone("Diff dialog dismissed", {
          display: "system"
        });
      }
    };

  const handleCancel = t22;
  const t23 = exitState => exitState.pending ? <Text>Press {exitState.keyName} again to exit</Text> : viewMode === "list" ? <Byline>{sources.length > 1 && <Text>←/→ source</Text>}<Text>↑/↓ select</Text><Text>Enter view</Text><Text>{dismissShortcut} close</Text></Byline> : <Byline><Text>← back</Text><Text>{dismissShortcut} close</Text></Byline>;

  const t24 = diffData.files.length === 0 ? <Box marginTop={1}><Text dimColor={true}>{emptyMessage}</Text></Box> : viewMode === "list" ? <Box flexDirection="column" marginTop={1}><DiffFileList files={diffData.files} selectedIndex={selectedIndex} /></Box> : <Box flexDirection="column" marginTop={1}><DiffDetailView filePath={selectedFile?.path || ""} hunks={selectedHunks} isLargeFile={selectedFile?.isLargeFile} isBinary={selectedFile?.isBinary} isTruncated={selectedFile?.isTruncated} isUntracked={selectedFile?.isUntracked} /></Box>;

  const t25 = <Dialog title={title} onCancel={handleCancel} color="background" inputGuide={t23}>{sourceSelector}{subtitle}{t24}</Dialog>;

  return t25;
}
function _temp3(prev_1) {
  return Math.max(0, prev_1 - 1);
}
function _temp2(prev) {
  return Math.max(0, prev - 1);
}
function _temp(turn): DiffSource {
  return {
    type: "turn",
    turn
  };
}
