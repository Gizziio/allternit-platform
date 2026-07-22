import fs from "fs/promises"
import path from "path"
import type { Dirent } from "fs"

export interface SkillDir {
  path: string
  name: string
}

const conditional = new Map<string, SkillDir>()

export async function loadSkillsDir(root: string): Promise<SkillDir[]> {
  const result: SkillDir[] = []
  let entries: Dirent[]
  try {
    entries = await fs.readdir(root, { withFileTypes: true })
  } catch {
    return result
  }
  for (const entry of entries.toSorted((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue
    const location = path.join(root, entry.name)
    if (entry.isDirectory() && (await exists(path.join(location, "SKILL.md")))) {
      result.push({ path: location, name: entry.name })
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      result.push({ path: location, name: entry.name.slice(0, -3) })
    }
  }
  return result
}

export async function discoverSkillDirsForPaths(paths: string[]): Promise<SkillDir[]> {
  const found = await Promise.all(paths.map(loadSkillsDir))
  return found.flat().filter((entry, index, all) => all.findIndex((other) => other.path === entry.path) === index)
}

export async function addSkillDirectories(dirs: SkillDir[]): Promise<void> {
  for (const dir of dirs) conditional.set(path.resolve(dir.path), { ...dir, path: path.resolve(dir.path) })
}

export async function activateConditionalSkillsForPaths(paths: string[]): Promise<void> {
  const resolved = paths.map((item) => path.resolve(item))
  for (const entry of await discoverSkillDirsForPaths(resolved)) conditional.set(path.resolve(entry.path), entry)
}

export function conditionalSkillDirectories(): readonly SkillDir[] {
  return [...conditional.values()].toSorted((a, b) => a.path.localeCompare(b.path))
}

async function exists(location: string) {
  return fs.stat(location).then((stat) => stat.isFile()).catch(() => false)
}
