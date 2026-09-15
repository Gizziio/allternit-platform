// @ts-nocheck
import * as React from 'react'
import { HistorySearchDialog } from '../../components/HistorySearchDialog.js'
import type {
  LocalJSXCommandContext,
  LocalJSXCommandOnDone,
} from '../../types/command.js'
export async function call(
  onDone: LocalJSXCommandOnDone,
  _context: LocalJSXCommandContext,
): Promise<React.ReactNode> {
  return (
    <HistorySearchDialog
      onSelect={entry => {
        onDone(undefined, {
          display: 'skip',
          nextInput: entry.display,
        })
      }}
      onCancel={() => {
        onDone(undefined, { display: 'skip' })
      }}
    />
  )
}
