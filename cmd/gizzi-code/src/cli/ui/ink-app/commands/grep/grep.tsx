// @ts-nocheck
import * as React from 'react';
import type { LocalJSXCommandCall } from '../../types/command';

export const call: LocalJSXCommandCall = async (onDone) => {
  const { GlobalSearchDialog } = await import('../../components/GlobalSearchDialog.js');
  return <GlobalSearchDialog onInsert={() => {}} onDone={onDone} />;
};
