/**
 * Skill Eval Store
 *
 * Persists eval reports to:
 *   <XDG_CONFIG>/gizzi-code/evals/<skillName>/<id>.json
 */
import path from "path"
import { mkdir, readdir, readFile, writeFile } from "fs/promises"
import { Log } from "@/shared/util/log"
import { Global } from "@/runtime/context/global"
import type { EvalReport } from "@/runtime/skills/evaluator"

const log = Log.create({ service: "eval-store" })

function evalDir(skillName: string) {
  return path.join(Global.Path.config, "evals", skillName)
}

export namespace EvalStore {
  export async function save(report: EvalReport): Promise<void> {
    const dir = evalDir(report.skillName)
    await mkdir(dir, { recursive: true })
    const file = path.join(dir, `${report.id}.json`)
    await writeFile(file, JSON.stringify(report, null, 2), "utf8")
    log.info("eval saved", { id: report.id, skill: report.skillName, file })
  }

  export async function list(skillName: string): Promise<EvalReport[]> {
    const dir = evalDir(skillName)
    try {
      const files = await readdir(dir)
      const reports = await Promise.all(
        files
          .filter((f) => f.endsWith(".json"))
          .map(async (f) => {
            try {
              const raw = await readFile(path.join(dir, f), "utf8")
              return JSON.parse(raw) as EvalReport
            } catch {
              return null
            }
          }),
      )
      return reports
        .filter((r): r is EvalReport => r !== null)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    } catch {
      return []
    }
  }

  export async function get(skillName: string, id: string): Promise<EvalReport | null> {
    const file = path.join(evalDir(skillName), `${id}.json`)
    try {
      const raw = await readFile(file, "utf8")
      return JSON.parse(raw) as EvalReport
    } catch {
      return null
    }
  }
}
