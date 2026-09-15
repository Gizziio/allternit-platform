// @ts-nocheck
import type {
  LocalJSXCommandContext,
  LocalJSXCommandOnDone,
} from '../../types/command.js'
import { getPlan, getPlanFilePath } from '../../utils/plans.js'

export async function call(
  onDone: LocalJSXCommandOnDone,
  _context: LocalJSXCommandContext,
): Promise<null> {
  const planContent = getPlan()
  const planPath = getPlanFilePath()

  if (!planContent) {
    onDone(
      'No saved plan yet. Use /plan to enter plan mode, or /plan <description> to start one.',
      { display: 'system' },
    )
    return null
  }

  onDone(`Current plan (${planPath})\n\n${planContent}`, { display: 'system' })
  return null
}
