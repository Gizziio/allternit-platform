// @ts-nocheck
/**
 * Gizzi Code Config Profiles
 *
 * Named configuration profiles that can be stored at user, project, or CI scope.
 * Profiles layer on top of the standard config precedence chain — activating a
 * profile merges its values into the active config, allowing quick switching
 * between e.g. a lightweight CI config and a full developer config.
 */

import { Log } from "@/shared/util/log"
import { Filesystem } from "@/shared/util/filesystem"
import { Global } from "@/runtime/context/global"
import path from "path"
import fs from "fs/promises"
import { existsSync } from "fs"
import z from "zod/v4"

const log = Log.create({ service: "profiles" })

export namespace ConfigProfiles {
  export const Scope = z.enum(["user", "project", "ci"])
  export type Scope = z.infer<typeof Scope>

  export const ProfileEntry = z.object({
    name: z.string(),
    scope: Scope,
    source: z.string().describe("File path the profile was loaded from"),
    description: z.string().optional(),
    config: z.record(z.string(), z.any()).describe("Partial config overrides"),
  })
  export type ProfileEntry = z.infer<typeof ProfileEntry>

  export const ProfileIndex = z.object({
    active: z.string().optional(),
    profiles: z.record(z.string(), ProfileEntry),
  })
  export type ProfileIndex = z.infer<typeof ProfileIndex>

  function userDir(): string {
    return path.join(Global.Path.config, "profiles")
  }

  function projectDir(): string {
    return path.join(process.cwd(), ".gizzi", "profiles")
  }

  function ciDir(): string {
    return path.join(process.cwd(), ".gizzi", "ci")
  }

  function scopeDir(scope: Scope): string {
    switch (scope) {
      case "user":
        return userDir()
      case "project":
        return projectDir()
      case "ci":
        return ciDir()
    }
  }

  function profilePath(scope: Scope, name: string): string {
    return path.join(scopeDir(scope), `${name}.json`)
  }

  function indexPath(scope: Scope): string {
    return path.join(scopeDir(scope), "index.json")
  }

  async function readIndex(scope: Scope): Promise<ProfileIndex> {
    const file = indexPath(scope)
    try {
      const text = await Filesystem.readText(file)
      if (!text) return { profiles: {} }
      const parsed = ProfileIndex.safeParse(JSON.parse(text))
      return parsed.success ? parsed.data : { profiles: {} }
    } catch {
      return { profiles: {} }
    }
  }

  async function writeIndex(scope: Scope, index: ProfileIndex): Promise<void> {
    const dir = scopeDir(scope)
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(indexPath(scope), JSON.stringify(index, null, 2))
  }

  /**
   * Save a named profile at the given scope.
   */
  export async function save(
    name: string,
    scope: Scope,
    config: Record<string, unknown>,
    description?: string,
  ): Promise<ProfileEntry> {
    const dir = scopeDir(scope)
    await fs.mkdir(dir, { recursive: true })

    const entry: ProfileEntry = {
      name,
      scope,
      source: profilePath(scope, name),
      ...(description ? { description } : {}),
      config,
    }

    await fs.writeFile(profilePath(scope, name), JSON.stringify(config, null, 2))

    const index = await readIndex(scope)
    index.profiles[name] = entry
    await writeIndex(scope, index)

    log.info("saved profile", { name, scope, path: entry.source })
    return entry
  }

  /**
   * Load a profile's config by name and scope.
   */
  export async function load(name: string, scope: Scope): Promise<ProfileEntry | null> {
    const index = await readIndex(scope)
    return index.profiles[name] ?? null
  }

  /**
   * Delete a profile.
   */
  export async function remove(name: string, scope: Scope): Promise<boolean> {
    const index = await readIndex(scope)
    if (!index.profiles[name]) return false

    try {
      await fs.unlink(profilePath(scope, name))
    } catch {
      // File may already be gone
    }

    delete index.profiles[name]
    if (index.active === name) index.active = undefined
    await writeIndex(scope, index)

    log.info("removed profile", { name, scope })
    return true
  }

  /**
   * List all profiles across all scopes.
   */
  export async function listAll(): Promise<ProfileEntry[]> {
    const results: ProfileEntry[] = []
    for (const scope of ["user", "project", "ci"] as Scope[]) {
      const index = await readIndex(scope)
      results.push(...Object.values(index.profiles))
    }
    return results
  }

  /**
   * List profiles for a single scope.
   */
  export async function list(scope: Scope): Promise<ProfileIndex> {
    return readIndex(scope)
  }

  /**
   * Activate a profile by name. Searches scopes in order: ci > project > user.
   */
  export async function activate(name: string): Promise<ProfileEntry | null> {
    for (const scope of ["ci", "project", "user"] as Scope[]) {
      const entry = await load(name, scope)
      if (entry) {
        const index = await readIndex(scope)
        index.active = name
        await writeIndex(scope, index)
        log.info("activated profile", { name, scope })
        return entry
      }
    }
    return null
  }

  /**
   * Get the currently active profile, searching ci > project > user.
   */
  export async function getActive(): Promise<ProfileEntry | null> {
    for (const scope of ["ci", "project", "user"] as Scope[]) {
      const index = await readIndex(scope)
      if (index.active && index.profiles[index.active]) {
        return index.profiles[index.active]
      }
    }
    return null
  }

  /**
   * Deactivate the current profile at all scopes.
   */
  export async function deactivate(): Promise<void> {
    for (const scope of ["ci", "project", "user"] as Scope[]) {
      const index = await readIndex(scope)
      if (index.active) {
        index.active = undefined
        await writeIndex(scope, index)
      }
    }
    log.info("deactivated all profiles")
  }

  /**
   * Detect the CI environment and auto-activate a CI profile if one exists.
   */
  export async function autoDetectCI(): Promise<ProfileEntry | null> {
    const isCI =
      process.env.CI === "true" ||
      process.env.CI === "1" ||
      !!process.env.GITHUB_ACTIONS ||
      !!process.env.GITLAB_CI ||
      !!process.env.BUILDKITE ||
      !!process.env.CIRCLECI ||
      !!process.env.JENKINS_URL ||
      !!process.env.TF_BUILD

    if (!isCI) return null

    // Check for a profile named "ci" in any scope
    for (const scope of ["ci", "project", "user"] as Scope[]) {
      const entry = await load("ci", scope)
      if (entry) {
        log.info("auto-detected CI environment, activating 'ci' profile", { scope })
        return entry
      }
    }

    return null
  }

  /**
   * Merge profile config into a base config using the same merge semantics
   * as the main config system.
   */
  export function mergeProfileConfig(
    base: Record<string, unknown>,
    profile: Record<string, unknown>,
  ): Record<string, unknown> {
    const result = { ...base }
    for (const [key, value] of Object.entries(profile)) {
      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value) &&
        typeof result[key] === "object" &&
        result[key] !== null &&
        !Array.isArray(result[key])
      ) {
        result[key] = mergeProfileConfig(
          result[key] as Record<string, unknown>,
          value as Record<string, unknown>,
        )
      } else {
        result[key] = value
      }
    }
    return result
  }
}
