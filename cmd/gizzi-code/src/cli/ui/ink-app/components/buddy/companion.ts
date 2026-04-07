/**
 * Companion Module
 * TEMPORARY SHIM
 */

export interface Companion {
  name: string
  level: number
}

export function createCompanion(name: string): Companion {
  return { name, level: 1 }
}

export function levelUp(companion: Companion): Companion {
  return { ...companion, level: companion.level + 1 }
}

export default { createCompanion, levelUp }
