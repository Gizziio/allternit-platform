// @ts-nocheck
import * as React from 'react';
import type { LocalJSXCommandCall } from '../../types/command';

export const call: LocalJSXCommandCall = async (onDone) => {
  const { QuickOpenDialog } = await import('../../components/QuickOpenDialog.js');
  return <QuickOpenDialog onInsert={() => {}} onDone={onDone} />;
};
