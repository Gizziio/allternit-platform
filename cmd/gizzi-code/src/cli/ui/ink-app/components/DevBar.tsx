import * as React from 'react';
import { useState } from 'react';
import { getSlowOperations } from '../bootstrap/state';
import { Text, useInterval } from '../ink';

// Show DevBar for dev builds or all ants
function shouldShowDevBar(): boolean {
  return ("production" as string) === 'development' || ("external" as string) === 'ant';
}
export function DevBar() {
  const [slowOps, setSlowOps] = useState(getSlowOperations);
  const t0 = () => {
      setSlowOps(getSlowOperations());
    };

  useInterval(t0, shouldShowDevBar() ? 500 : null);
  if (!shouldShowDevBar() || slowOps.length === 0) {
    return null;
  }
  const t1 = slowOps.slice(-3).map(_temp).join(" \xB7 ");

  const recentOps = t1;
  const t2 = <Text wrap="truncate-end" color="warning">[ANT-ONLY] slow sync: {recentOps}</Text>;

  return t2;
}
function _temp(op) {
  return `${op.operation} (${Math.round(op.durationMs)}ms)`;
}
