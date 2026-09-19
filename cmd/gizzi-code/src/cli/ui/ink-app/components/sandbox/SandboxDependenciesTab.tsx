import React from 'react';
import { Box, Text } from '../../ink';
import { getPlatform } from '../../utils/platform';
import type { SandboxDependencyCheck } from '../../utils/sandbox/sandbox-adapter';
type Props = {
  depCheck: SandboxDependencyCheck;
};
export function SandboxDependenciesTab({
    depCheck
}: Props) {
  const t1 = getPlatform();

  const platform = t1;
  const isMac = platform === "macos";
  const t2 = depCheck.errors.some(_temp);

  const rgMissing = t2;
  const t3 = depCheck.errors.some(_temp2);

  const bwrapMissing = t3;
  const t4 = depCheck.errors.some(_temp3);

  const socatMissing = t4;
  const seccompMissing = depCheck.warnings.length > 0;
  const otherErrors = depCheck.errors.filter(_temp4);
  const rgInstallHint = isMac ? "brew install ripgrep" : "apt install ripgrep";
  const t6 = isMac && <Box flexDirection="column"><Text>seatbelt: <Text color="success">built-in (macOS)</Text></Text></Box>;

  const t7 = <Text>ripgrep (rg):{" "}{rgMissing ? <Text color="error">not found</Text> : <Text color="success">found</Text>}</Text>;
  const t8 = rgMissing && <Text dimColor={true}>{"  "}· {rgInstallHint}</Text>;

  const t9 = <Box flexDirection="column">{t7}{t8}</Box>;

  const t10 = !isMac && <><Box flexDirection="column"><Text>bubblewrap (bwrap):{" "}{bwrapMissing ? <Text color="error">not installed</Text> : <Text color="success">installed</Text>}</Text>{bwrapMissing && <Text dimColor={true}>{"  "}· apt install bubblewrap</Text>}</Box><Box flexDirection="column"><Text>socat:{" "}{socatMissing ? <Text color="error">not installed</Text> : <Text color="success">installed</Text>}</Text>{socatMissing && <Text dimColor={true}>{"  "}· apt install socat</Text>}</Box><Box flexDirection="column"><Text>seccomp filter:{" "}{seccompMissing ? <Text color="warning">not installed</Text> : <Text color="success">installed</Text>}{seccompMissing && <Text dimColor={true}> (required to block unix domain sockets)</Text>}</Text>{seccompMissing && <Box flexDirection="column"><Text dimColor={true}>{"  "}· npm install -g @anthropic-ai/sandbox-runtime</Text><Text dimColor={true}>{"  "}· or copy vendor/seccomp/* from sandbox-runtime and set</Text><Text dimColor={true}>{"    "}sandbox.seccomp.bpfPath and applyPath in settings.json</Text></Box>}</Box></>;
  const t5 = <Box flexDirection="column" paddingY={1} gap={1}>{t6}{t9}{t10}{otherErrors.map(_temp5)}</Box>;
  return t5;
}
function _temp5(err) {
  return <Text key={err} color="error">{err}</Text>;
}
function _temp4(e_2) {
  return !e_2.includes("ripgrep") && !e_2.includes("bwrap") && !e_2.includes("socat");
}
function _temp3(e_1) {
  return e_1.includes("socat");
}
function _temp2(e_0) {
  return e_0.includes("bwrap");
}
function _temp(e) {
  return e.includes("ripgrep");
}
