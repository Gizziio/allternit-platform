import * as React from 'react';
import { Box } from '../ink';
type QueuedMessageContextValue = {
  isQueued: boolean;
  isFirst: boolean;
  /** Width reduction for container padding (e.g., 4 for paddingX={2}) */
  paddingWidth: number;
};
const QueuedMessageContext = React.createContext<QueuedMessageContextValue | undefined>(undefined);
export function useQueuedMessage() {
  return React.useContext(QueuedMessageContext);
}
const PADDING_X = 2;
type Props = {
  isFirst: boolean;
  useBriefLayout?: boolean;
  children: React.ReactNode;
};
export function QueuedMessageProvider({
    isFirst,
    useBriefLayout,
    children
}: Props) {
  const padding = useBriefLayout ? 0 : PADDING_X;
  const t1 = padding * 2;
  const t2 = {
      isQueued: true,
      isFirst,
      paddingWidth: t1
    };

  const value = t2;
  const t3 = <Box paddingX={padding}>{children}</Box>;

  const t4 = <QueuedMessageContext.Provider value={value}>{t3}</QueuedMessageContext.Provider>;

  return t4;
}
