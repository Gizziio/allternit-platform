/**
 * File System Operations
 */

import { readFile, writeFile, mkdir } from 'fs/promises'

export async function readFileSafe(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf-8')
  } catch {
    return null
  }
}

export async function writeFileSafe(path: string, content: string): Promise<boolean> {
  try {
    await writeFile(path, content)
    return true
  } catch {
    return false
  }
}

export async function mkdirSafe(path: string): Promise<boolean> {
  try {
    await mkdir(path, { recursive: true })
    return true
  } catch {
    return false
  }
}
