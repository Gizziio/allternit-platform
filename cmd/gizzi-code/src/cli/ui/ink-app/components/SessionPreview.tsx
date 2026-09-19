import type { UUID } from 'crypto';
import React, { useCallback } from 'react';
import { Box, Text } from '../ink';
import { useKeybinding } from '../keybindings/useKeybinding';
import { getAllBaseTools } from '../tools';
import type { LogOption } from '../types/logs';
import { formatRelativeTimeAgo } from '../utils/format';
import { getSessionIdFromLog, isLiteLog, loadFullLog } from '../utils/sessionStorage';
import { ConfigurableShortcutHint } from './ConfigurableShortcutHint';
import { Byline } from './design-system/Byline';
import { KeyboardShortcutHint } from './design-system/KeyboardShortcutHint';
import { LoadingState } from './design-system/LoadingState';
import { Messages } from './Messages';
type Props = {
  log: LogOption;
  onExit: () => void;
  onSelect: (log: LogOption) => void;
};
export function SessionPreview({
    log,
    onExit,
    onSelect
}: Props) {
  const [fullLog, setFullLog] = React.useState(null);
  const t1 = () => {
      setFullLog(null);
      if (isLiteLog(log)) {
        loadFullLog(log).then(setFullLog);
      }
    };
  const t2 = [log];

  React.useEffect(t1, t2);
  const isLoading = isLiteLog(log) && fullLog === null;
  const displayLog = fullLog ?? log;
  const t3 = getSessionIdFromLog(displayLog) || "" as UUID;

  const conversationId = t3;
  const t4 = getAllBaseTools();

  const tools = t4;
  const t5 = {
      context: "Confirmation"
    };

  useKeybinding("confirm:no", onExit, t5);
  const t6 = () => {
      onSelect(fullLog ?? log);
    };

  const handleSelect = t6;
  const t7 = {
      context: "Confirmation"
    };

  useKeybinding("confirm:yes", handleSelect, t7);
  if (isLoading) {
    const t8 = <LoadingState message={"Loading session\u2026"} />;

    const t9 = <Box flexDirection="column" padding={1}>{t8}<Text dimColor={true}><Byline><ConfigurableShortcutHint action="confirm:no" context="Confirmation" fallback="Esc" description="cancel" /></Byline></Text></Box>;

    return t9;
  }
  const t8 = [];

  const t9 = [];
  const t10 = new Set<string>();

  const t11 = [];

  const t12 = <Messages messages={displayLog.messages} tools={tools} commands={t8} verbose={true} toolJSX={null} toolUseConfirmQueue={t9} inProgressToolUseIDs={t10} isMessageSelectorVisible={false} conversationId={conversationId} screen="transcript" streamingToolUses={t11} showAllInTranscript={true} isLoading={false} />;

  const t13 = formatRelativeTimeAgo(displayLog.modified);

  const t14 = displayLog.gitBranch ? ` · ${displayLog.gitBranch}` : "";
  const t15 = <Text>{t13} ·{" "}{displayLog.messageCount} messages{t14}</Text>;

  const t16 = <Text dimColor={true}><Byline><KeyboardShortcutHint shortcut="Enter" action="resume" /><ConfigurableShortcutHint action="confirm:no" context="Confirmation" fallback="Esc" description="cancel" /></Byline></Text>;

  const t17 = <Box flexShrink={0} flexDirection="column" borderTopDimColor={true} borderBottom={false} borderLeft={false} borderRight={false} borderStyle="single" paddingLeft={2}>{t15}{t16}</Box>;

  const t18 = <Box flexDirection="column">{t12}{t17}</Box>;

  return t18;
}
