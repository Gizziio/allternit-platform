import * as React from 'react';
import { Box, Text } from '../../ink';
import { SandboxManager, shouldAllowManagedSandboxDomainsOnly } from '../../utils/sandbox/sandbox-adapter';
export function SandboxConfigTab() {
  const isEnabled = SandboxManager.isSandboxingEnabled();
  const depCheck = SandboxManager.checkDependencies();
  const t0 = depCheck.warnings.length > 0 ? <Box marginTop={1} flexDirection="column">{depCheck.warnings.map(_temp)}</Box> : null;

  const warningsNote = t0;
  if (!isEnabled) {
    const t1 = <Box flexDirection="column" paddingY={1}><Text color="subtle">Sandbox is not enabled</Text>{warningsNote}</Box>;

    return t1;
  }
  const fsReadConfig = SandboxManager.getFsReadConfig();
  const fsWriteConfig = SandboxManager.getFsWriteConfig();
  const networkConfig = SandboxManager.getNetworkRestrictionConfig();
  const allowUnixSockets = SandboxManager.getAllowUnixSockets();
  const excludedCommands = SandboxManager.getExcludedCommands();
  const globPatternWarnings = SandboxManager.getLinuxGlobPatternWarnings();
  // @ts-expect-error TODO(types) — verbatim upstream: vendored sandbox-adapter exposes deny/allow/allowedDomains shapes, not these upstream names
  const t1 = <Box flexDirection="column" paddingY={1}><Box flexDirection="column"><Text bold={true} color="permission">Excluded Commands:</Text><Text dimColor={true}>{excludedCommands.length > 0 ? excludedCommands.join(", ") : "None"}</Text></Box>{fsReadConfig.denyOnly.length > 0 && <Box marginTop={1} flexDirection="column"><Text bold={true} color="permission">Filesystem Read Restrictions:</Text><Text dimColor={true}>Denied: {fsReadConfig.denyOnly.join(", ")}</Text>{fsReadConfig.allowWithinDeny && fsReadConfig.allowWithinDeny.length > 0 && <Text dimColor={true}>Allowed within denied: {fsReadConfig.allowWithinDeny.join(", ")}</Text>}</Box>}{fsWriteConfig.allowOnly.length > 0 && <Box marginTop={1} flexDirection="column"><Text bold={true} color="permission">Filesystem Write Restrictions:</Text><Text dimColor={true}>Allowed: {fsWriteConfig.allowOnly.join(", ")}</Text>{fsWriteConfig.denyWithinAllow.length > 0 && <Text dimColor={true}>Denied within allowed: {fsWriteConfig.denyWithinAllow.join(", ")}</Text>}</Box>}{(networkConfig.allowedHosts && networkConfig.allowedHosts.length > 0 || networkConfig.deniedHosts && networkConfig.deniedHosts.length > 0) && <Box marginTop={1} flexDirection="column"><Text bold={true} color="permission">Network Restrictions{shouldAllowManagedSandboxDomainsOnly() ? " (Managed)" : ""}:</Text>{networkConfig.allowedHosts && networkConfig.allowedHosts.length > 0 && <Text dimColor={true}>Allowed: {networkConfig.allowedHosts.join(", ")}</Text>}{networkConfig.deniedHosts && networkConfig.deniedHosts.length > 0 && <Text dimColor={true}>Denied: {networkConfig.deniedHosts.join(", ")}</Text>}</Box>}{allowUnixSockets && allowUnixSockets.length > 0 && <Box marginTop={1} flexDirection="column"><Text bold={true} color="permission">Allowed Unix Sockets:</Text><Text dimColor={true}>{allowUnixSockets.join(", ")}</Text></Box>}{globPatternWarnings.length > 0 && <Box marginTop={1} flexDirection="column"><Text bold={true} color="warning">⚠ Warning: Glob patterns not fully supported on Linux</Text><Text dimColor={true}>The following patterns will be ignored:{" "}{globPatternWarnings.slice(0, 3).join(", ")}{globPatternWarnings.length > 3 && ` (${globPatternWarnings.length - 3} more)`}</Text></Box>}{warningsNote}</Box>;

  return t1;
}
function _temp(w, i) {
  return <Text key={i} dimColor={true}>{w}</Text>;
}
