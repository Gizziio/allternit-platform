import { describe, expect, test } from "bun:test"
import path from "path"
import { tmpdir } from "../fixture/fixture"
import {
  GIZZI_PACKAGE_NAME,
  buildUninstallPlan,
  detectInstallMethod,
  gizziHome,
  packageUninstallCommand,
  planGizziHome,
} from "../../src/cli/commands/uninstallPlan"

describe("detectInstallMethod", () => {
  test("detects curl installs from the binary path", () => {
    expect(detectInstallMethod("/home/u/.gizzi/bin/gizzi", ["gizzi"])).toBe("curl")
    expect(detectInstallMethod("/home/u/.local/bin/gizzi", ["gizzi"])).toBe("curl")
  })

  test("detects npm global installs from the node_modules path", () => {
    expect(
      detectInstallMethod("/usr/local/lib/node_modules/@allternit/gizzi-code/bin/gizzi.js", ["gizzi"]),
    ).toBe("npm")
  })

  test("detects npm installs when the real package path appears in argv (npx-style)", () => {
    expect(
      detectInstallMethod("/usr/local/bin/gizzi", ["/usr/local/bin/gizzi", "/usr/local/lib/node_modules/@allternit/gizzi-code/bin/gizzi.js"]),
    ).toBe("npm")
  })

  test("detects pnpm/bun/yarn/brew/scoop/choco from the binary path", () => {
    expect(detectInstallMethod("/Users/u/Library/pnpm/gizzi", [])).toBe("pnpm")
    expect(detectInstallMethod("/Users/u/.bun/bin/gizzi", [])).toBe("bun")
    expect(detectInstallMethod("/opt/homebrew/Cellar/gizzi/1.0.0/bin/gizzi", [])).toBe("brew")
    expect(detectInstallMethod("C:\\Users\\u\\scoop\\shims\\gizzi.exe", [])).toBe("scoop")
    expect(detectInstallMethod("C:\\ProgramData\\chocolatey\\bin\\gizzi.exe", [])).toBe("choco")
  })

  test("returns unknown for an inconclusive path", () => {
    expect(detectInstallMethod("/usr/bin/gizzi", ["gizzi"])).toBe("unknown")
  })
})

describe("packageUninstallCommand", () => {
  test("npm hint uses the published package name (not legacy @gizzi/tui)", () => {
    expect(packageUninstallCommand("npm")).toBe(`npm uninstall -g ${GIZZI_PACKAGE_NAME}`)
  })

  test("covers the other package managers", () => {
    expect(packageUninstallCommand("pnpm")).toBe(`pnpm uninstall -g ${GIZZI_PACKAGE_NAME}`)
    expect(packageUninstallCommand("bun")).toBe(`bun remove -g ${GIZZI_PACKAGE_NAME}`)
    expect(packageUninstallCommand("yarn")).toBe(`yarn global remove ${GIZZI_PACKAGE_NAME}`)
    expect(packageUninstallCommand("brew")).toBe("brew uninstall gizzi")
  })

  test("returns null when no package manager owns the install", () => {
    expect(packageUninstallCommand("curl")).toBeNull()
    expect(packageUninstallCommand("unknown")).toBeNull()
  })
})

describe("planGizziHome / buildUninstallPlan (injected HOME)", () => {
  test("lists what will be deleted under ~/.gizzi", async () => {
    await using tmp = await tmpdir()
    const home = path.join(tmp.path, "home")
    const root = gizziHome(home)
    await Bun.$`mkdir -p ${root}/credentials ${root}/plugins/my-plugin ${root}/bin`
    await Bun.write(path.join(root, "credentials.json"), "{}")
    await Bun.write(path.join(root, "config.toml"), "[auth]")
    await Bun.write(path.join(root, "IDENTITY.md"), "# identity")

    const plan = await planGizziHome(home)
    expect(plan.exists).toBe(true)
    const byName = Object.fromEntries(plan.entries.map((e) => [e.name, e.kind]))
    expect(byName["credentials.json"]).toBe("credentials")
    expect(byName["credentials"]).toBe("credentials")
    expect(byName["plugins"]).toBe("plugins")
    expect(byName["bin"]).toBe("binary")
    expect(byName["config.toml"]).toBe("config")
    expect(byName["IDENTITY.md"]).toBe("workspace")
  })

  test("reports a missing ~/.gizzi as nothing to delete", async () => {
    await using tmp = await tmpdir()
    const plan = await planGizziHome(path.join(tmp.path, "nope"))
    expect(plan.exists).toBe(false)
    expect(plan.entries).toEqual([])
  })

  test("buildUninstallPlan removes ~/.gizzi unless --keep-config", async () => {
    await using tmp = await tmpdir()
    const home = path.join(tmp.path, "home")
    await Bun.$`mkdir -p ${gizziHome(home)}`
    const base = { home, execPath: "/home/u/.gizzi/bin/gizzi", argv: ["gizzi"] }

    const plan = await buildUninstallPlan({ ...base, keepConfig: false })
    expect(plan.method).toBe("curl")
    expect(plan.removeGizziHome).toBe(true)
    expect(plan.packageHint).toBeNull()

    const kept = await buildUninstallPlan({ ...base, keepConfig: true })
    expect(kept.removeGizziHome).toBe(false)
  })

  test("buildUninstallPlan surfaces the npm hint for npm-installed trees", async () => {
    await using tmp = await tmpdir()
    const plan = await buildUninstallPlan({
      keepConfig: false,
      home: path.join(tmp.path, "home"),
      execPath: "/usr/local/lib/node_modules/@allternit/gizzi-code/bin/gizzi.js",
      argv: ["gizzi"],
    })
    expect(plan.method).toBe("npm")
    expect(plan.packageHint).toBe(`npm uninstall -g ${GIZZI_PACKAGE_NAME}`)
  })
})
