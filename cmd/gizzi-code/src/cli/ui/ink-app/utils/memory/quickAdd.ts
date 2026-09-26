import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname } from 'path'
import { getErrnoCode } from '../errors.js'

/**
 * Pure content builder for the `#` memory quick-add: the note is appended to
 * the target file as a single bullet at the end of the file. Empty/missing
 * files start with just the bullet; existing content keeps its bytes and gets
 * the bullet on a new line.
 */
export function buildMemoryQuickAddContent(
  existing: string,
  memoryText: string,
): string {
  const line = `- ${memoryText}`
  const trimmed = existing.trimEnd()
  return trimmed ? `${trimmed}\n${line}\n` : `${line}\n`
}

/**
 * Appends `memoryText` as a bullet to the memory file at `memoryPath`,
 * creating the parent directory and file when missing.
 */
export async function appendToMemoryFile(
  memoryPath: string,
  memoryText: string,
): Promise<void> {
  await mkdir(dirname(memoryPath), { recursive: true })

  let existing = ''
  try {
    existing = await readFile(memoryPath, 'utf8')
  } catch (error) {
    if (getErrnoCode(error) !== 'ENOENT') throw error
  }

  await writeFile(
    memoryPath,
    buildMemoryQuickAddContent(existing, memoryText),
    'utf8',
  )
}

/**
 * Extracts the memory note from a `#`-prefixed prompt input. Returns '' for a
 * bare `#` (the caller routes that to the /memory edit flow instead).
 */
export function extractMemoryQuickAddText(input: string): string {
  return input.replace(/^#+\s*/, '').trim()
}
