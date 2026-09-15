// @ts-nocheck
import { stat } from 'fs/promises'
import { isAbsolute, resolve } from 'path'
import type { LocalCommandCall } from '../../types/command.js'
import { getCwdState } from '../../bootstrap/state.js'
import { setCwd } from '../../utils/Shell.js'

export const call: LocalCommandCall = async (args, context) => {
  const target = String(args ?? '').trim()
  if (!target) {
    return {
      type: 'text',
      value: `Current directory: ${getCwdState()}\nUsage: /cd <path>`,
    }
  }

  const base = getCwdState()
  const resolved = isAbsolute(target) ? target : resolve(base, target)

  try {
    const stats = await stat(resolved)
    if (!stats.isDirectory()) {
      return { type: 'text', value: `/cd: not a directory: ${resolved}` }
    }
  } catch {
    return { type: 'text', value: `/cd: no such directory: ${resolved}` }
  }

  // setCwd resolves symlinks and validates existence again; surface its
  // error as a friendly message instead of a local-command stderr dump.
  try {
    setCwd(resolved)
  } catch (error) {
    return {
      type: 'text',
      value: `/cd: ${error instanceof Error ? error.message : String(error)}`,
    }
  }

  // Stale read-state entries from the old cwd should not leak into the new one
  context.readFileState.clear()

  return {
    type: 'text',
    value:
      `cwd: ${getCwdState()}\n` +
      'Tools and the statusline now use this directory. ' +
      'The transcript location and /clear reset stay anchored to the original project directory.',
  }
}
