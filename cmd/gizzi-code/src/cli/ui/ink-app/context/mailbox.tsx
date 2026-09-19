import React, { createContext, useContext, useMemo } from 'react';
import { Mailbox } from '../utils/mailbox';
const MailboxContext = createContext<Mailbox | undefined>(undefined);
type Props = {
  children: React.ReactNode;
};
export function MailboxProvider({
    children
}: Props) {
  const t1 = new Mailbox();

  const mailbox = t1;
  const t2 = <MailboxContext.Provider value={mailbox}>{children}</MailboxContext.Provider>;

  return t2;
}
export function useMailbox() {
  const mailbox = useContext(MailboxContext);
  if (!mailbox) {
    throw new Error("useMailbox must be used within a MailboxProvider");
  }
  return mailbox;
}
