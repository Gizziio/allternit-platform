import React from 'react';
import { FpsMetricsProvider } from '../context/fpsMetrics';
import { StatsProvider, type StatsStore } from '../context/stats';
import { type AppState, AppStateProvider } from '../state/AppState';
import { onChangeAppState } from '../state/onChangeAppState';
import type { FpsMetrics } from '../utils/fpsTracker';
type Props = {
  getFpsMetrics: () => FpsMetrics | undefined;
  stats?: StatsStore;
  initialState: AppState;
  children: React.ReactNode;
};

/**
 * Top-level wrapper for interactive sessions.
 * Provides FPS metrics, stats context, and app state to the component tree.
 */
export function App({
    getFpsMetrics,
    stats,
    initialState,
    children
}: Props) {
  const t1 = <AppStateProvider initialState={initialState} onChangeAppState={onChangeAppState}>{children}</AppStateProvider>;

  const t2 = <StatsProvider store={stats}>{t1}</StatsProvider>;

  const t3 = <FpsMetricsProvider getFpsMetrics={getFpsMetrics}>{t2}</FpsMetricsProvider>;

  return t3;
}
