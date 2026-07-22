import fs from "fs/promises"
import path from "path"
import { addSkillDirectories as addRuntimeSkillDirectories } from "@/runtime/skills/loadSkillsDir"
import { Skill } from "@/runtime/skills/skill"

const checked = new Set<string>()

/** Discover nested compatible skill roots between touched files and the workspace. */
export async function discoverSkillDirsForPaths(paths: string[], cwd: string): Promise<string[]> {
  const boundary = path.resolve(cwd)
  const result: string[] = []
  for (const file of paths) {
    let current = path.dirname(path.resolve(file))
    while (current !== boundary && isWithin(boundary, current)) {
      for (const relative of [path.join(".gizzi", "skills"), path.join(".claude", "skills"), path.join(".agents", "skills")]) {
        const candidate = path.join(current, relative)
        if (checked.has(candidate)) continue
        checked.add(candidate)
        if (await fs.stat(candidate).then((stat) => stat.isDirectory()).catch(() => false)) result.push(candidate)
      }
      const parent = path.dirname(current)
      if (parent === current) break
      current = parent
    }
  }
  return result.toSorted((a, b) => b.split(path.sep).length - a.split(path.sep).length)
}

export async function addSkillDirectories(dirs: string[]): Promise<void> {
  await addRuntimeSkillDirectories(dirs.map((dir) => ({ path: dir, name: path.basename(path.dirname(dir)) })))
}

export function activateConditionalSkillsForPaths(paths: string[], _cwd: string): void {
  void Skill.activateForPaths(paths)
}

function isWithin(parent: string, child: string) {
  const relative = path.relative(parent, child)
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))
}
