// @ts-nocheck
import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname } from 'path'
import type { LocalCommandCall } from '../../types/command.js'
import { getMemoryPath } from '../../utils/config.js'
import { getErrnoCode } from '../../utils/errors.js'

const HEADING = '## Remembered'

export const call: LocalCommandCall = async args => {
  const note = String(args ?? '').trim()
  if (!note) {
    return {
      type: 'text',
      value: 'Usage: /remember <note>\nExample: /remember the staging deploy uses the eu-west cluster',
    }
  }

  const memoryPath = getMemoryPath('User')
  await mkdir(dirname(memoryPath), { recursive: true })

  let existing = ''
  try {
    existing = await readFile(memoryPath, 'utf8')
  } catch (error) {
    if (getErrnoCode(error) !== 'ENOENT') throw error
  }

  const stamp = new Date().toISOString().slice(0, 10)
  const line = `- ${stamp}: ${note}`

  let next: string
  if (existing.includes(HEADING)) {
    next = existing.replace(HEADING, `${HEADING}\n${line}`)
    if (next === existing) {
      next = `${existing.trimEnd()}\n${line}\n`
    }
  } else {
    const prefix = existing.trimEnd()
    next = `${prefix}${prefix ? '\n\n' : ''}${HEADING}\n${line}\n`
  }

  await writeFile(memoryPath, next, 'utf8')
  return {
    type: 'text',
    value: `Saved to ${memoryPath}\n${line}`,
  }
}
