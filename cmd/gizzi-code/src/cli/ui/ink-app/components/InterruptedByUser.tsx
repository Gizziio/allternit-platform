import * as React from 'react';
import { Text } from '../ink';
export function InterruptedByUser() {
  const t0 = <><Text dimColor={true}>Interrupted </Text>{false ? <Text dimColor={true}>· [ANT-ONLY] /issue to report a model issue</Text> : <Text dimColor={true}>· What should Gizzi do instead?</Text>}</>;

  return t0;
}
