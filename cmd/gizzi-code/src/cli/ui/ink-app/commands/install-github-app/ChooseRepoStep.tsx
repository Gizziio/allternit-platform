import React, { useCallback, useState } from 'react';
import TextInput from '../../components/TextInput';
import { useTerminalSize } from '../../hooks/useTerminalSize';
import { Box, Text } from '../../ink';
import { useKeybindings } from '../../keybindings/useKeybinding';
interface ChooseRepoStepProps {
  currentRepo: string | null;
  useCurrentRepo: boolean;
  repoUrl: string;
  onRepoUrlChange: (value: string) => void;
  onToggleUseCurrentRepo: (useCurrentRepo: boolean) => void;
  onSubmit: () => void;
}
export function ChooseRepoStep({
    currentRepo,
    useCurrentRepo,
    repoUrl,
    onRepoUrlChange,
    onSubmit,
    onToggleUseCurrentRepo
}: ChooseRepoStepProps) {
  const [cursorOffset, setCursorOffset] = useState(0);
  const [showEmptyError, setShowEmptyError] = useState(false);
  const terminalSize = useTerminalSize();
  const textInputColumns = terminalSize.columns;
  const t1 = () => {
      const repoName = useCurrentRepo ? currentRepo : repoUrl;
      if (!repoName?.trim()) {
        setShowEmptyError(true);
        return;
      }
      onSubmit();
    };

  const handleSubmit = t1;
  const isTextInputVisible = !useCurrentRepo || !currentRepo;
  const t2 = () => {
      onToggleUseCurrentRepo(true);
      setShowEmptyError(false);
    };

  const handlePrevious = t2;
  const t3 = () => {
      onToggleUseCurrentRepo(false);
      setShowEmptyError(false);
    };

  const handleNext = t3;
  const t4 = {
      "confirm:previous": handlePrevious,
      "confirm:next": handleNext,
      "confirm:yes": handleSubmit
    };

  const t5 = !isTextInputVisible;
  const t6 = {
      context: "Confirmation",
      isActive: t5
    };

  useKeybindings(t4, t6);
  const t7 = {
      "confirm:previous": handlePrevious,
      "confirm:next": handleNext
    };

  const t8 = {
      context: "Confirmation",
      isActive: isTextInputVisible
    };

  useKeybindings(t7, t8);
  const t9 = <Box flexDirection="column" marginBottom={1}><Text bold={true}>Install GitHub App</Text><Text dimColor={true}>Select GitHub repository</Text></Box>;

  const t10 = currentRepo && <Box marginBottom={1}><Text bold={useCurrentRepo} color={useCurrentRepo ? "permission" : undefined}>{useCurrentRepo ? "> " : "  "}Use current repository: {currentRepo}</Text></Box>;

  const t11 = !useCurrentRepo || !currentRepo;
  const t12 = !useCurrentRepo || !currentRepo ? "permission" : undefined;
  const t13 = !useCurrentRepo || !currentRepo ? "> " : "  ";
  const t14 = currentRepo ? "Enter a different repository" : "Enter repository";
  const t15 = <Box marginBottom={1}><Text bold={t11} color={t12}>{t13}{t14}</Text></Box>;

  const t16 = (!useCurrentRepo || !currentRepo) && <Box marginLeft={2} marginBottom={1}><TextInput value={repoUrl} onChange={value => {
        onRepoUrlChange(value);
        setShowEmptyError(false);
      }} onSubmit={handleSubmit} focus={true} placeholder={"Enter a repo as owner/repo or https://github.com/owner/repo\u2026"} columns={textInputColumns} cursorOffset={cursorOffset} onChangeCursorOffset={setCursorOffset} showCursor={true} /></Box>;

  const t17 = <Box flexDirection="column" borderStyle="round" paddingX={1}>{t9}{t10}{t15}{t16}</Box>;

  const t18 = showEmptyError && <Box marginLeft={3} marginBottom={1}><Text color="error">Please enter a repository name to continue</Text></Box>;

  const t19 = currentRepo ? "\u2191/\u2193 to select \xB7 " : "";
  const t20 = <Box marginLeft={3}><Text dimColor={true}>{t19}Enter to continue</Text></Box>;

  const t21 = <>{t17}{t18}{t20}</>;

  return t21;
}
