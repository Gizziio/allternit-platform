import React, { useEffect, useState } from 'react';
import { Box, Link, Text } from '../ink';
import { type AwsAuthStatus, AwsAuthStatusManager } from '../utils/awsAuthStatusManager';
const URL_RE = /https?:\/\/\S+/;
export function AwsAuthStatusBox() {
  const t0 = AwsAuthStatusManager.getInstance().getStatus();

  const [status, setStatus] = useState(t0);
  const t1 = () => {
      const unsubscribe = AwsAuthStatusManager.getInstance().subscribe(setStatus);
      return unsubscribe;
    };
  const t2 = [];

  useEffect(t1, t2);
  if (!status.isAuthenticating && !status.error && status.output.length === 0) {
    return null;
  }
  if (!status.isAuthenticating && !status.error) {
    return null;
  }
  const t3 = <Text bold={true} color="permission">Cloud Authentication</Text>;

  const t4 = status.output.length > 0 && <Box flexDirection="column" marginTop={1}>{status.output.slice(-5).map(_temp)}</Box>;

  const t5 = status.error && <Box marginTop={1}><Text color="error">{status.error}</Text></Box>;

  const t6 = <Box flexDirection="column" borderStyle="round" borderColor="permission" paddingX={1} marginY={1}>{t3}{t4}{t5}</Box>;

  return t6;
}
function _temp(line, index) {
  const m = line.match(URL_RE);
  if (!m) {
    return <Text key={index} dimColor={true}>{line}</Text>;
  }
  const url = m[0];
  const start = m.index ?? 0;
  const before = line.slice(0, start);
  const after = line.slice(start + url.length);
  return <Text key={index} dimColor={true}>{before}<Link url={url}>{url}</Link>{after}</Text>;
}
