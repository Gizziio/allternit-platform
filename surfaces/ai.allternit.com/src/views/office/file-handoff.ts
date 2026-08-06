/**
 * File handoff between the office launcher and the editor routes.
 *
 * A File picked in the launcher can't cross a route navigation, so the bytes
 * are stashed module-side under a one-shot id passed via router state.
 */

export interface HandedOffFile {
  name: string
  bytes: Uint8Array
}

const stash = new Map<string, HandedOffFile>()

export function stashFile(file: HandedOffFile): string {
  const id = crypto.randomUUID()
  stash.set(id, file)
  return id
}

/** Read and consume a stashed file (one-shot). */
export function takeFile(id: string): HandedOffFile | undefined {
  const file = stash.get(id)
  if (file) stash.delete(id)
  return file
}
