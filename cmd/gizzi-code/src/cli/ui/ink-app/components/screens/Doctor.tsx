import figures from 'figures';
import { join } from 'path';
import React, { Suspense, use, useCallback, useEffect, useMemo, useState } from 'react';
import { KeybindingWarnings } from '../vendor/components/KeybindingWarnings';
import { McpParsingWarnings } from '../vendor/components/mcp/McpParsingWarnings';
import { getModelMaxOutputTokens } from '../vendor/utils/context';
import { getClaudeConfigHomeDir } from '../vendor/utils/envUtils';
import type { SettingSource } from '../vendor/utils/settings/constants';
import { getOriginalCwd } from './vendor/bootstrap/state';
import type { CommandResultDisplay } from './vendor/commands';
import { Pane } from './components/vendored/design-system/Pane';
import { PressEnterToContinue } from './components/vendored/PressEnterToContinue';
import { SandboxDoctorSection } from './components/vendored/sandbox/SandboxDoctorSection';
import { ValidationErrorsList } from './components/vendored/ValidationErrorsList';
import { useSettingsErrors } from './hooks/vendored/notifs/useSettingsErrors';
import { useExitOnCtrlCDWithKeybindings } from './hooks/vendored/useExitOnCtrlCDWithKeybindings';
import { Box, Text } from './core/ink';
import { useKeybindings } from '../keybindings/useKeybinding';
import { useAppState } from '../state/AppState';
import { getPluginErrorMessage } from './vendor/types/plugin';
import { getGcsDistTags, getNpmDistTags, type NpmDistTags } from './vendor/utils/autoUpdater';
import { type ContextWarnings, checkContextWarnings } from './vendor/utils/doctorContextWarnings';
import { type DiagnosticInfo, getDoctorDiagnostic } from './vendor/utils/doctorDiagnostic';
import { validateBoundedIntEnvVar } from './vendor/utils/envValidation';
import { pathExists } from './vendor/utils/file';
import { cleanupStaleLocks, getAllLockInfo, isPidBasedLockingEnabled, type LockInfo } from './vendor/utils/nativeInstaller/pidLock';
import { getInitialSettings } from './vendor/utils/settings/settings';
import { BASH_MAX_OUTPUT_DEFAULT, BASH_MAX_OUTPUT_UPPER_LIMIT } from './vendor/utils/shell/outputLimits';
import { TASK_MAX_OUTPUT_DEFAULT, TASK_MAX_OUTPUT_UPPER_LIMIT } from './vendor/utils/task/outputFormatting';
import { getXDGStateHome } from './vendor/utils/xdg';

type Props = {
  onDone: (result?: string, options?: {
    display?: CommandResultDisplay;
  }) => void;
};

type AgentInfo = {
  activeAgents: Array<{
    agentType: string;
    source: SettingSource | 'built-in' | 'plugin';
  }>;
  userAgentsDir: string;
  projectAgentsDir: string;
  userDirExists: boolean;
  projectDirExists: boolean;
  failedFiles?: Array<{
    path: string;
    error: string;
  }>;
};

type VersionLockInfo = {
  enabled: boolean;
  locks: LockInfo[];
  locksDir: string;
  staleLocksCleaned: number;
};

function DistTagsDisplay({ promise }: { promise: Promise<NpmDistTags> }) {
  const distTags = use(promise);
  
  if (!distTags.latest) {
    return <Text dimColor={true}>└ Failed to fetch versions</Text>;
  }
  
  return (
    <>
      {distTags.stable && <Text>└ Stable version: {distTags.stable}</Text>}
      <Text>└ Latest version: {distTags.latest}</Text>
    </>
  );
}

export function Doctor({ onDone }: Props) {
  const agentDefinitions = useAppState(s => s.agentDefinitions);
  const mcpTools = useAppState(s => s.mcp.tools);
  const toolPermissionContext = useAppState(s => s.toolPermissionContext);
  const pluginsErrors = useAppState(s => s.plugins.errors);
  
  useExitOnCtrlCDWithKeybindings();
  
  const tools = mcpTools || [];
  const [diagnostic, setDiagnostic] = useState<DiagnosticInfo | null>(null);
  const [agentInfo, setAgentInfo] = useState<AgentInfo | null>(null);
  const [contextWarnings, setContextWarnings] = useState<ContextWarnings | null>(null);
  const [versionLockInfo, setVersionLockInfo] = useState<VersionLockInfo | null>(null);
  const validationErrors = useSettingsErrors();
  
  const distTagsPromise = useMemo(() => {
    return getDoctorDiagnostic().then(diag => {
      const fetchDistTags = diag.installationType === "native" ? getGcsDistTags : getNpmDistTags;
      return fetchDistTags().catch(() => ({ latest: null, stable: null }));
    });
  }, []);
  
  const autoUpdatesChannel = getInitialSettings()?.autoUpdatesChannel ?? "latest";
  
  const errorsExcludingMcp = useMemo(() => {
    return validationErrors.filter(error => error.mcpErrorMetadata === undefined);
  }, [validationErrors]);
  
  const envValidationErrors = useMemo(() => {
    const envVars = [
      {
        name: "BASH_MAX_OUTPUT_LENGTH",
        default: BASH_MAX_OUTPUT_DEFAULT,
        upperLimit: BASH_MAX_OUTPUT_UPPER_LIMIT
      },
      {
        name: "TASK_MAX_OUTPUT_LENGTH",
        default: TASK_MAX_OUTPUT_DEFAULT,
        upperLimit: TASK_MAX_OUTPUT_UPPER_LIMIT
      },
      {
        name: "CLAUDE_CODE_MAX_OUTPUT_TOKENS",
        ...getModelMaxOutputTokens("claude-opus-4")
      }
    ];
    return envVars.map(v => {
      const value = process.env[v.name];
      const result = validateBoundedIntEnvVar(v.name, value, v.default, v.upperLimit);
      return {
        name: v.name,
        ...result
      };
    }).filter(v => v.status !== "valid");
  }, []);
  
  useEffect(() => {
    getDoctorDiagnostic().then(setDiagnostic);
    
    (async () => {
      const userAgentsDir = join(getClaudeConfigHomeDir(), "agents");
      const projectAgentsDir = join(getOriginalCwd(), ".claude", "agents");
      const { activeAgents, allAgents, failedFiles } = agentDefinitions;
      const [userDirExists, projectDirExists] = await Promise.all([
        pathExists(userAgentsDir),
        pathExists(projectAgentsDir)
      ]);
      
      const agentInfoData: AgentInfo = {
        activeAgents: activeAgents.map(a => ({
          agentType: a.agentType,
          source: a.source
        })),
        userAgentsDir,
        projectAgentsDir,
        userDirExists,
        projectDirExists,
        failedFiles
      };
      setAgentInfo(agentInfoData);
      
      const warnings = await checkContextWarnings(tools, {}, async () => toolPermissionContext);
      setContextWarnings(warnings);
      
      if (isPidBasedLockingEnabled()) {
        const locksDir = join(getXDGStateHome(), "claude", "locks");
        const staleLocksCleaned = cleanupStaleLocks(locksDir);
        const locks = getAllLockInfo(locksDir);
        setVersionLockInfo({
          enabled: true,
          locks,
          locksDir,
          staleLocksCleaned
        });
      } else {
        setVersionLockInfo({
          enabled: false,
          locks: [],
          locksDir: "",
          staleLocksCleaned: 0
        });
      }
    })();
  }, [toolPermissionContext, tools, agentDefinitions]);
  
  const handleDismiss = useCallback(() => {
    onDone("Claude Code diagnostics dismissed", { display: "system" });
  }, [onDone]);
  
  useKeybindings({
    "confirm:yes": handleDismiss,
    "confirm:no": handleDismiss
  }, { context: "Confirmation" });
  
  if (!diagnostic) {
    return (
      <Pane>
        <Text dimColor={true}>Checking installation status…</Text>
      </Pane>
    );
  }
  
  const t16 = diagnostic.ripgrepStatus.working ? "OK" : "Not working";
  const t17 = diagnostic.ripgrepStatus.mode === "embedded" ? "bundled" : 
               diagnostic.ripgrepStatus.mode === "builtin" ? "vendor" : 
               diagnostic.ripgrepStatus.systemPath || "system";
  
  return (
    <Pane>
      <Box flexDirection="column">
        <Text bold={true}>Diagnostics</Text>
        <Text>└ Currently running: {diagnostic.installationType} ({diagnostic.version})</Text>
        {diagnostic.packageManager && <Text>└ Package manager: {diagnostic.packageManager}</Text>}
        <Text>└ Path: {diagnostic.installationPath}</Text>
        <Text>└ Invoked: {diagnostic.invokedBinary}</Text>
        <Text>└ Config install method: {diagnostic.configInstallMethod}</Text>
        <Text>└ Search: {t16} ({t17})</Text>
        {diagnostic.recommendation && (
          <>
            <Text />
            <Text color="warning">Recommendation: {diagnostic.recommendation.split("\n")[0]}</Text>
            <Text dimColor={true}>{diagnostic.recommendation.split("\n")[1]}</Text>
          </>
        )}
        {diagnostic.multipleInstallations.length > 1 && (
          <>
            <Text />
            <Text color="warning">Warning: Multiple installations found</Text>
            {diagnostic.multipleInstallations.map((install, i) => (
              <Text key={i}>└ {install.type} at {install.path}</Text>
            ))}
          </>
        )}
        {diagnostic.warnings.length > 0 && (
          <>
            <Text />
            {diagnostic.warnings.map((warning, i) => (
              <Box key={i} flexDirection="column">
                <Text color="warning">Warning: {warning.issue}</Text>
                <Text>Fix: {warning.fix}</Text>
              </Box>
            ))}
          </>
        )}
        {errorsExcludingMcp.length > 0 && (
          <Box flexDirection="column" marginTop={1} marginBottom={1}>
            <Text bold={true}>Invalid Settings</Text>
            <ValidationErrorsList errors={errorsExcludingMcp} />
          </Box>
        )}
      </Box>
      
      <Box flexDirection="column">
        <Text bold={true}>Updates</Text>
        <Text>└ Auto-updates:{" "}{diagnostic.packageManager ? "Managed by package manager" : diagnostic.autoUpdates}</Text>
        {diagnostic.hasUpdatePermissions !== null && (
          <Text>└ Update permissions:{" "}{diagnostic.hasUpdatePermissions ? "Yes" : "No (requires sudo)"}</Text>
        )}
        <Text>└ Auto-update channel: {autoUpdatesChannel}</Text>
        <Suspense fallback={null}>
          <DistTagsDisplay promise={distTagsPromise} />
        </Suspense>
      </Box>
      
      <SandboxDoctorSection />
      <McpParsingWarnings />
      <KeybindingWarnings />
      
      {envValidationErrors.length > 0 && (
        <Box flexDirection="column">
          <Text bold={true}>Environment Variables</Text>
          {envValidationErrors.map((validation, i) => (
            <Text key={i}>
              └ {validation.name}:{" "}
              <Text color={validation.status === "capped" ? "warning" : "error"}>
                {validation.message}
              </Text>
            </Text>
          ))}
        </Box>
      )}
      
      {versionLockInfo?.enabled && (
        <Box flexDirection="column">
          <Text bold={true}>Version Locks</Text>
          {versionLockInfo.staleLocksCleaned > 0 && (
            <Text dimColor={true}>└ Cleaned {versionLockInfo.staleLocksCleaned} stale lock(s)</Text>
          )}
          {versionLockInfo.locks.length === 0 ? (
            <Text dimColor={true}>└ No active version locks</Text>
          ) : (
            versionLockInfo.locks.map((lock, i) => (
              <Text key={i}>
                └ {lock.version}: PID {lock.pid}{" "}
                {lock.isProcessRunning ? <Text>(running)</Text> : <Text color="warning">(stale)</Text>}
              </Text>
            ))
          )}
        </Box>
      )}
      
      {agentInfo?.failedFiles && agentInfo.failedFiles.length > 0 && (
        <Box flexDirection="column">
          <Text bold={true} color="error">Agent Parse Errors</Text>
          <Text color="error">└ Failed to parse {agentInfo.failedFiles.length} agent file(s):</Text>
          {agentInfo.failedFiles.map((file, i) => (
            <Text key={i} dimColor={true}>
              {"  "}└ {file.path}: {file.error}
            </Text>
          ))}
        </Box>
      )}
      
      {pluginsErrors.length > 0 && (
        <Box flexDirection="column">
          <Text bold={true} color="error">Plugin Errors</Text>
          <Text color="error">└ {pluginsErrors.length} plugin error(s) detected:</Text>
          {pluginsErrors.map((error, i) => (
            <Text key={i} dimColor={true}>
              {"  "}└ {error.source || "unknown"}
              {"plugin" in error && error.plugin ? ` [${error.plugin}]` : ""}:{" "}
              {getPluginErrorMessage(error)}
            </Text>
          ))}
        </Box>
      )}
      
      {contextWarnings?.unreachableRulesWarning && (
        <Box flexDirection="column">
          <Text bold={true} color="warning">Unreachable Permission Rules</Text>
          <Text>
            └{" "}
            <Text color="warning">{figures.warning}{" "}{contextWarnings.unreachableRulesWarning.message}</Text>
          </Text>
          {contextWarnings.unreachableRulesWarning.details.map((detail, i) => (
            <Text key={i} dimColor={true}>{"  "}└ {detail}</Text>
          ))}
        </Box>
      )}
      
      {contextWarnings && (contextWarnings.claudeMdWarning || contextWarnings.agentWarning || contextWarnings.mcpWarning) && (
        <Box flexDirection="column">
          <Text bold={true}>Context Usage Warnings</Text>
          {contextWarnings.claudeMdWarning && (
            <>
              <Text>
                └{" "}
                <Text color="warning">{figures.warning} {contextWarnings.claudeMdWarning.message}</Text>
              </Text>
              <Text>{"  "}└ Files:</Text>
              {contextWarnings.claudeMdWarning.details.map((detail, i) => (
                <Text key={i} dimColor={true}>{"    "}└ {detail}</Text>
              ))}
            </>
          )}
          {contextWarnings.agentWarning && (
            <>
              <Text>
                └{" "}
                <Text color="warning">{figures.warning} {contextWarnings.agentWarning.message}</Text>
              </Text>
              <Text>{"  "}└ Top contributors:</Text>
              {contextWarnings.agentWarning.details.map((detail, i) => (
                <Text key={i} dimColor={true}>{"    "}└ {detail}</Text>
              ))}
            </>
          )}
          {contextWarnings.mcpWarning && (
            <>
              <Text>
                └{" "}
                <Text color="warning">{figures.warning} {contextWarnings.mcpWarning.message}</Text>
              </Text>
              <Text>{"  "}└ MCP servers:</Text>
              {contextWarnings.mcpWarning.details.map((detail, i) => (
                <Text key={i} dimColor={true}>{"    "}└ {detail}</Text>
              ))}
            </>
          )}
        </Box>
      )}
      
      <Box>
        <PressEnterToContinue />
      </Box>
    </Pane>
  );
}
