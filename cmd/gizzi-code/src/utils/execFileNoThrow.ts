/**
 * Exec File without throwing
 */

import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export async function execFileNoThrow(
  command: string,
  args?: string[]
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const { stdout, stderr } = await execFileAsync(command, args)
    return { stdout, stderr, exitCode: 0 }
  } catch (error: any) {
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || '',
      exitCode: error.code || 1,
    }
  }
}

// Merge-by-re-export: complete counterpart (local exports win on conflict)
export * from '../shared/utils/execFileNoThrow.js'
