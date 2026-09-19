import figures from 'figures';
import * as React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDebounceCallback } from 'usehooks-ts';
import { addDirHelpMessage, validateDirectoryForWorkspace } from '../../../commands/add-dir/validation';
import TextInput from '../../../components/TextInput';
import type { KeyboardEvent } from '../../../ink/events/keyboard-event';
import { Box, Text } from '../../../ink';
import { useKeybinding } from '../../../keybindings/useKeybinding';
import type { ToolPermissionContext } from '../../../Tool';
import { getDirectoryCompletions } from '../../../utils/suggestions/directoryCompletion';
import { ConfigurableShortcutHint } from '../../ConfigurableShortcutHint';
import { Select } from '../../CustomSelect/select';
import { Byline } from '../../design-system/Byline';
import { Dialog } from '../../design-system/Dialog';
import { KeyboardShortcutHint } from '../../design-system/KeyboardShortcutHint';
import { PromptInputFooterSuggestions, type SuggestionItem } from '../../PromptInput/PromptInputFooterSuggestions';
type Props = {
  onAddDirectory: (path: string, remember?: boolean) => void;
  onCancel: () => void;
  permissionContext: ToolPermissionContext;
  directoryPath?: string; // When directoryPath is provided, show selection options instead of input
};
type RememberDirectoryOption = 'yes-session' | 'yes-remember' | 'no';
const REMEMBER_DIRECTORY_OPTIONS: Array<{
  value: RememberDirectoryOption;
  label: string;
}> = [{
  value: 'yes-session',
  label: 'Yes, for this session'
}, {
  value: 'yes-remember',
  label: 'Yes, and remember this directory'
}, {
  value: 'no',
  label: 'No'
}];
function PermissionDescription() {
  const t0 = <Text dimColor={true}>Gizzi Code will be able to read files in this directory and make edits when auto-accept edits is on.</Text>;

  return t0;
}
function DirectoryDisplay(t0) {
  const {
    path
  } = t0;
  const t1 = <Text color="permission">{path}</Text>;

  const t2 = <PermissionDescription />;

  const t3 = <Box flexDirection="column" paddingX={2} gap={1}>{t1}{t2}</Box>;

  return t3;
}
function DirectoryInput(t0) {
  const {
    value,
    onChange,
    onSubmit,
    error,
    suggestions,
    selectedSuggestion
  } = t0;
  const t1 = <Text>Enter the path to the directory:</Text>;

  const t2 = <Box borderDimColor={true} borderStyle="round" marginY={1} paddingLeft={1}><TextInput showCursor={true} placeholder={`Directory path${figures.ellipsis}`} value={value} onChange={onChange} onSubmit={onSubmit} columns={80} cursorOffset={value.length} onChangeCursorOffset={_temp} /></Box>;

  const t3 = suggestions.length > 0 && <Box marginBottom={1}><PromptInputFooterSuggestions suggestions={suggestions} selectedSuggestion={selectedSuggestion} /></Box>;

  const t4 = error && <Text color="error">{error}</Text>;

  const t5 = <Box flexDirection="column">{t1}{t2}{t3}{t4}</Box>;

  return t5;
}
function _temp() {}
export function AddWorkspaceDirectory({
    onAddDirectory,
    onCancel,
    permissionContext,
    directoryPath
}: Props) {
  const [directoryInput, setDirectoryInput] = useState("");
  const [error, setError] = useState(null);
  const t1 = [];

  const [suggestions, setSuggestions] = useState(t1);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const t2 = async path => {
      if (!path) {
        setSuggestions([]);
        setSelectedSuggestion(0);
        return;
      }
      const completions = await getDirectoryCompletions(path);
      setSuggestions(completions);
      setSelectedSuggestion(0);
    };

  const fetchSuggestions = t2;
  const debouncedFetchSuggestions = useDebounceCallback(fetchSuggestions, 100);
  const t3 = () => {
      debouncedFetchSuggestions(directoryInput);
    };
  const t4 = [directoryInput, debouncedFetchSuggestions];

  useEffect(t3, t4);
  const t5 = suggestion => {
      const newPath = suggestion.id + "/";
      setDirectoryInput(newPath);
      setError(null);
    };

  const applySuggestion = t5;
  const t6 = async newPath_0 => {
      const result = await validateDirectoryForWorkspace(newPath_0, permissionContext);
      if (result.resultType === "success") {
        onAddDirectory(result.absolutePath, false);
      } else {
        setError(addDirHelpMessage(result));
      }
    };

  const handleSubmit = t6;
  const t7 = {
      context: "Settings"
    };

  useKeybinding("confirm:no", onCancel, t7);
  const t8 = e => {
      if (suggestions.length > 0) {
        if (e.key === "tab") {
          e.preventDefault();
          const suggestion_0 = suggestions[selectedSuggestion];
          if (suggestion_0) {
            applySuggestion(suggestion_0);
          }
          return;
        }
        if (e.key === "return") {
          e.preventDefault();
          const suggestion_1 = suggestions[selectedSuggestion];
          if (suggestion_1) {
            handleSubmit(suggestion_1.id + "/");
          }
          return;
        }
        if (e.key === "up" || e.ctrl && e.key === "p") {
          e.preventDefault();
          setSelectedSuggestion(prev => prev <= 0 ? suggestions.length - 1 : prev - 1);
          return;
        }
        if (e.key === "down" || e.ctrl && e.key === "n") {
          e.preventDefault();
          setSelectedSuggestion(prev_0 => prev_0 >= suggestions.length - 1 ? 0 : prev_0 + 1);
          return;
        }
      }
    };

  const handleKeyDown = t8;
  const t9 = value => {
      if (!directoryPath) {
        return;
      }
      const selectionValue = value as RememberDirectoryOption;
      bb64: switch (selectionValue) {
        case "yes-session":
          {
            onAddDirectory(directoryPath, false);
            break bb64;
          }
        case "yes-remember":
          {
            onAddDirectory(directoryPath, true);
            break bb64;
          }
        case "no":
          {
            onCancel();
          }
      }
    };

  const handleSelect = t9;
  const t10 = directoryPath ? undefined : _temp2;
  const t11 = directoryPath ? <Box flexDirection="column" gap={1}><DirectoryDisplay path={directoryPath} /><Select options={REMEMBER_DIRECTORY_OPTIONS} onChange={handleSelect} onCancel={() => handleSelect("no")} /></Box> : <Box flexDirection="column" gap={1} marginX={2}><PermissionDescription /><DirectoryInput value={directoryInput} onChange={setDirectoryInput} onSubmit={handleSubmit} error={error} suggestions={suggestions} selectedSuggestion={selectedSuggestion} /></Box>;

  const t12 = <Dialog title="Add directory to workspace" onCancel={onCancel} color="permission" isCancelActive={false} inputGuide={t10}>{t11}</Dialog>;

  const t13 = <Box flexDirection="column" tabIndex={0} autoFocus={true} onKeyDown={handleKeyDown}>{t12}</Box>;

  return t13;
}
function _temp2(exitState) {
  return exitState.pending ? <Text>Press {exitState.keyName} again to exit</Text> : <Byline><KeyboardShortcutHint shortcut="Tab" action="complete" /><KeyboardShortcutHint shortcut="Enter" action="add" /><ConfigurableShortcutHint action="confirm:no" context="Settings" fallback="Esc" description="cancel" /></Byline>;
}
