import { afterEach, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import { WorkspaceRegistry } from "@/runtime/workspace/registry"

const roots: string[] = []
afterEach(async () => Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))))

describe("workspace registry", () => {
  test("folds symlink aliases and supports reversible soft deletion", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "gizzi-workspaces-"))
    roots.push(root)
    const workspace = path.join(root, "workspace")
    const alias = path.join(root, "alias")
    const file = path.join(root, "registry.json")
    await fs.mkdir(workspace)
    await fs.symlink(workspace, alias)
    const first = await WorkspaceRegistry.register({ path: workspace, file })
    const second = await WorkspaceRegistry.register({ path: alias, file })
    expect(second.id).toBe(first.id)
    expect(await WorkspaceRegistry.list({ file })).toHaveLength(1)
    expect(await WorkspaceRegistry.remove(first.id, file)).toBe(true)
    expect(await WorkspaceRegistry.list({ file })).toEqual([])
    expect(await WorkspaceRegistry.list({ file, includeDeleted: true })).toHaveLength(1)
  })
})
