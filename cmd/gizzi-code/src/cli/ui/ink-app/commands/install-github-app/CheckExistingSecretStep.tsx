import React, { useCallback, useState } from 'react';
import TextInput from '../../components/TextInput';
import { useTerminalSize } from '../../hooks/useTerminalSize';
import { Box, color, Text, useTheme } from '../../ink';
import { useKeybindings } from '../../keybindings/useKeybinding';
interface CheckExistingSecretStepProps {
  useExistingSecret: boolean;
  secretName: string;
  onToggleUseExistingSecret: (useExisting: boolean) => void;
  onSecretNameChange: (value: string) => void;
  onSubmit: () => void;
}
export function CheckExistingSecretStep({
    useExistingSecret,
    secretName,
    onToggleUseExistingSecret,
    onSecretNameChange,
    onSubmit
}: CheckExistingSecretStepProps) {
  const [cursorOffset, setCursorOffset] = useState(0);
  const terminalSize = useTerminalSize();
  const [theme] = useTheme();
  const t1 = () => onToggleUseExistingSecret(true);

  const handlePrevious = t1;
  const t2 = () => onToggleUseExistingSecret(false);

  const handleNext = t2;
  const t3 = {
      "confirm:previous": handlePrevious,
      "confirm:next": handleNext,
      "confirm:yes": onSubmit
    };

  const t4 = {
      context: "Confirmation",
      isActive: useExistingSecret
    };

  useKeybindings(t3, t4);
  const t5 = {
      "confirm:previous": handlePrevious,
      "confirm:next": handleNext
    };

  const t6 = !useExistingSecret;
  const t7 = {
      context: "Confirmation",
      isActive: t6
    };

  useKeybindings(t5, t7);
  const t8 = <Box flexDirection="column" marginBottom={1}><Text bold={true}>Install GitHub App</Text><Text dimColor={true}>Setup API key secret</Text></Box>;

  const t9 = <Box marginBottom={1}><Text color="warning">ALLTERNIT_API_KEY already exists in repository secrets!</Text></Box>;

  const t10 = <Box marginBottom={1}><Text>Would you like to:</Text></Box>;

  const t11 = useExistingSecret ? color("success", theme)("> ") : "  ";

  const t12 = <Box marginBottom={1}><Text>{t11}Use the existing API key</Text></Box>;

  const t13 = !useExistingSecret ? color("success", theme)("> ") : "  ";

  const t14 = <Box marginBottom={1}><Text>{t13}Create a new secret with a different name</Text></Box>;

  const t15 = !useExistingSecret && <><Box marginBottom={1}><Text>Enter new secret name (alphanumeric with underscores):</Text></Box><TextInput value={secretName} onChange={onSecretNameChange} onSubmit={onSubmit} focus={true} placeholder="e.g., GIZZI_API_KEY" columns={terminalSize.columns} cursorOffset={cursorOffset} onChangeCursorOffset={setCursorOffset} showCursor={true} /></>;

  const t16 = <Box flexDirection="column" borderStyle="round" paddingX={1}>{t8}{t9}{t10}{t12}{t14}{t15}</Box>;

  const t17 = <Box marginLeft={3}><Text dimColor={true}>↑/↓ to select · Enter to continue</Text></Box>;

  const t18 = <>{t16}{t17}</>;

  return t18;
}
