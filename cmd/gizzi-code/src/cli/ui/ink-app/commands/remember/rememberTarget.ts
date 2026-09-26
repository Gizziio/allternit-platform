/**
 * Argument parsing + content building for `/remember`. Pure — no I/O, no
 * TUI/config imports — so it can be unit-tested in isolation.
 */

export type RememberTarget = 'User' | 'Project' | 'Local'

const TARGET_FLAGS: Record<string, RememberTarget> = {
  '--user': 'User',
  '--project': 'Project',
  '--local': 'Local',
}

export const REMEMBER_USAGE =
  'Usage: /remember [--user|--project|--local] <note>\n' +
  'Example: /remember the staging deploy uses the eu-west cluster\n' +
  'Example: /remember --project run tests with bun test'

export type RememberArgs =
  | { target: RememberTarget; note: string }
  | { error: string }

/**
 * Parses `/remember` args into a target memory file (default: User) plus the
 * note text. Flags may appear anywhere; unknown flags are an error.
 */
export function parseRememberArgs(args: string): RememberArgs {
  let target: RememberTarget = 'User'
  const words = String(args ?? '').split(/\s+/).filter(Boolean)
  const noteWords: string[] = []

  for (const word of words) {
    if (word.startsWith('--')) {
      const flag = TARGET_FLAGS[word]
      if (!flag) {
        return { error: `Unknown flag: ${word}\n${REMEMBER_USAGE}` }
      }
      target = flag
    } else {
      noteWords.push(word)
    }
  }

  const note = noteWords.join(' ').trim()
  if (!note) {
    return { error: REMEMBER_USAGE }
  }
  return { target, note }
}

export const REMEMBER_HEADING = '## Remembered'

/**
 * Inserts the dated bullet under the `## Remembered` heading, creating the
 * heading at the end of the file when absent.
 */
export function buildRememberedContent(
  existing: string,
  note: string,
  stamp: string,
): { next: string; line: string } {
  const line = `- ${stamp}: ${note}`

  if (existing.includes(REMEMBER_HEADING)) {
    const next = existing.replace(REMEMBER_HEADING, `${REMEMBER_HEADING}\n${line}`)
    if (next !== existing) {
      return { next, line }
    }
    return { next: `${existing.trimEnd()}\n${line}\n`, line }
  }

  const prefix = existing.trimEnd()
  return {
    next: `${prefix}${prefix ? '\n\n' : ''}${REMEMBER_HEADING}\n${line}\n`,
    line,
  }
}
