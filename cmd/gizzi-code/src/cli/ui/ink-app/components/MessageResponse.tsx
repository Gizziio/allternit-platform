import * as React from 'react';
import { useContext } from 'react';
import { Box, NoSelect, Text } from '../ink';
import { Ratchet } from './design-system/Ratchet';
type Props = {
  children: React.ReactNode;
  height?: number;
};
export function MessageResponse({
    children,
    height
}: Props) {
  const isMessageResponse = useContext(MessageResponseContext);
  if (isMessageResponse) {
    return children;
  }
  const t1 = <NoSelect fromLeftEdge={true} flexShrink={0}><Text dimColor={true}>{"  "}⎿  </Text></NoSelect>;

  const t2 = <Box flexShrink={1} flexGrow={1}>{children}</Box>;

  const t3 = <MessageResponseProvider><Box flexDirection="row" height={height} overflowY="hidden">{t1}{t2}</Box></MessageResponseProvider>;

  const content = t3;
  if (height !== undefined) {
    return content;
  }
  const t4 = <Ratchet lock="offscreen">{content}</Ratchet>;

  return t4;
}

// This is a context that is used to determine if the message response
// is rendered as a descendant of another MessageResponse. We use it
// to avoid rendering nested ⎿ characters.
const MessageResponseContext = React.createContext(false);
function MessageResponseProvider({
    children
}: Props) {
  const t1 = <MessageResponseContext.Provider value={true}>{children}</MessageResponseContext.Provider>;

  return t1;
}
