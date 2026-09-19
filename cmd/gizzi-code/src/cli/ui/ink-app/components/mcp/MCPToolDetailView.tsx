import React from 'react';
import { Box, Text } from '../../ink';
import { extractMcpToolDisplayName, getMcpDisplayName } from '../../services/mcp/mcpStringUtils';
import type { Tool } from '../../Tool';
import { ConfigurableShortcutHint } from '../ConfigurableShortcutHint';
import { Dialog } from '../design-system/Dialog';
import type { ServerInfo } from './types';
type Props = {
  tool: Tool;
  server: ServerInfo;
  onBack: () => void;
};
export function MCPToolDetailView({
    tool,
    server,
    onBack
}: Props) {
  const [toolDescription, setToolDescription] = React.useState("");
  const toolName = getMcpDisplayName(tool.name, server.name);
  const fullDisplayName = tool.userFacingName ? tool.userFacingName({}) : toolName;
  const t1 = extractMcpToolDisplayName(fullDisplayName);

  const displayName = t1;
  const t2 = tool.isReadOnly?.({}) ?? false;

  const isReadOnly = t2;
  const t3 = tool.isDestructive?.({}) ?? false;

  const isDestructive = t3;
  const t4 = tool.isOpenWorld?.({}) ?? false;

  const isOpenWorld = t4;
  const t5 = () => {
      const loadDescription = async function loadDescription() {
        try {
          const desc = await tool.description({}, {
            isNonInteractiveSession: false,
            toolPermissionContext: {
              mode: "default" as const,
              additionalWorkingDirectories: new Map(),
              alwaysAllowRules: {},
              alwaysDenyRules: {},
              alwaysAskRules: {},
              isBypassPermissionsModeAvailable: false
            },
            tools: []
          });
          setToolDescription(desc);
        } catch {
          setToolDescription("Failed to load description");
        }
      };
      loadDescription();
    };
  const t6 = [tool];

  React.useEffect(t5, t6);
  const t7 = isReadOnly && <Text color="success"> [read-only]</Text>;

  const t8 = isDestructive && <Text color="error"> [destructive]</Text>;

  const t9 = isOpenWorld && <Text dimColor={true}> [open-world]</Text>;

  const t10 = <>{displayName}{t7}{t8}{t9}</>;

  const titleContent = t10;
  const t11 = <Text bold={true}>Tool name: </Text>;

  const t12 = <Box>{t11}<Text dimColor={true}>{toolName}</Text></Box>;

  const t13 = <Text bold={true}>Full name: </Text>;

  const t14 = <Box>{t13}<Text dimColor={true}>{tool.name}</Text></Box>;

  const t15 = toolDescription && <Box flexDirection="column" marginTop={1}><Text bold={true}>Description:</Text><Text wrap="wrap">{toolDescription}</Text></Box>;

  const t16 = tool.inputJSONSchema && tool.inputJSONSchema.properties && Object.keys(tool.inputJSONSchema.properties).length > 0 && <Box flexDirection="column" marginTop={1}><Text bold={true}>Parameters:</Text><Box marginLeft={2} flexDirection="column">{Object.entries(tool.inputJSONSchema.properties).map(t17 => {
          const [key, value] = t17;
          const required = tool.inputJSONSchema?.required as string[] | undefined;
          const isRequired = required?.includes(key);
          return <Text key={key}>• {key}{isRequired && <Text dimColor={true}> (required)</Text>}:{" "}<Text dimColor={true}>{typeof value === "object" && value && "type" in value ? String(value.type) : "unknown"}</Text>{typeof value === "object" && value && "description" in value && <Text dimColor={true}> - {String(value.description)}</Text>}</Text>;
        })}</Box></Box>;

  const t17 = <Box flexDirection="column">{t12}{t14}{t15}{t16}</Box>;

  const t18 = <Dialog title={titleContent} subtitle={server.name} onCancel={onBack} inputGuide={_temp}>{t17}</Dialog>;

  return t18;
}
function _temp(exitState) {
  return exitState.pending ? <Text>Press {exitState.keyName} again to exit</Text> : <ConfigurableShortcutHint action="confirm:no" context="Confirmation" fallback="Esc" description="go back" />;
}
