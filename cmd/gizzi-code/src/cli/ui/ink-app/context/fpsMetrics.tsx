import React, { createContext, useContext } from 'react';
import type { FpsMetrics } from '../utils/fpsTracker';
type FpsMetricsGetter = () => FpsMetrics | undefined;
const FpsMetricsContext = createContext<FpsMetricsGetter | undefined>(undefined);
type Props = {
  getFpsMetrics: FpsMetricsGetter;
  children: React.ReactNode;
};
export function FpsMetricsProvider({
    getFpsMetrics,
    children
}: Props) {
  const t1 = <FpsMetricsContext.Provider value={getFpsMetrics}>{children}</FpsMetricsContext.Provider>;

  return t1;
}
export function useFpsMetrics() {
  return useContext(FpsMetricsContext);
}
