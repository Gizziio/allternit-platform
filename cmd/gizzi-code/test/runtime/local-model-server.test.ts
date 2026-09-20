// @ts-nocheck
import { describe, expect, test } from "bun:test"
import { join } from "node:path"
import { tmpdir } from "../fixture/fixture"
import {
  createLocalModelServerManager,
  servedModelMatches,
  type LocalModelServerDeps,
} from "../../src/runtime/local-model-server"

const PROVIDER = "local-mlx"
const BASE_URL = "http://localhost:8081/v1"
const MODEL_A = "/Users/joe/models/gemma-3-4b-it-4bit"
const MODEL_B = "/Users/joe/models/Qwen3.5-4B-4bit"

type Fake = {
  deps: LocalModelServerDeps
  spawned: { argv: string[]; logFile: string }[]
  stateDir: string
  alive: Set<number>
  served: string[] | null
  nextPid: number
  readinessDelay: number
  probesSinceSpawn: number
  spawnImpl?: (argv: string[], opts: { logFile: string }) => any
}

function makeFake(stateDir: string, overrides: Partial<Fake> = {}): Fake {
  const fake: Fake = {
    deps: undefined as any,
    spawned: [],
    stateDir,
    alive: new Set(),
    served: null,
    nextPid: 90001,
    readinessDelay: 1,
    probesSinceSpawn: 0,
  }
  let nowMs = 1_000_000_000

  const respond = () =>
    new Response(JSON.stringify({ data: (fake.served ?? []).map((id) => ({ id })) }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })

  fake.deps = {
    stateDir,
    fetchImpl: (async () => {
      if (fake.served === null && fake.spawned.length > 0) {
        // Simulated server boot: model appears after readinessDelay probes.
        fake.probesSinceSpawn++
        const lastArgv = fake.spawned[fake.spawned.length - 1].argv
        const modelIdx = lastArgv.indexOf("--model")
        if (fake.probesSinceSpawn > fake.readinessDelay) {
          fake.served = [lastArgv[modelIdx + 1]]
        }
      }
      return respond()
    }) as any,
    spawnImpl: (argv, opts) => {
      fake.spawned.push({ argv, logFile: opts.logFile })
      const pid = fake.nextPid++
      fake.alive.add(pid)
      fake.probesSinceSpawn = 0
      if (overrides.spawnImpl) return overrides.spawnImpl(argv, opts)
      return { pid, exit: new Promise(() => {}), kill: () => {} }
    },
    which: async () => "/usr/local/bin/mlx_lm.server",
    sleep: async (ms) => {
      nowMs += ms
    },
    now: () => nowMs,
    isAlive: (pid) => fake.alive.has(pid),
    kill: (pid) => {
      fake.alive.delete(pid)
      if (fake.alive.size === 0) {
        fake.served = null
        fake.probesSinceSpawn = 0
      }
    },
    defaultStartupTimeoutMs: 5_000,
    listenerPid: () => undefined,
  }
  return fake
}

function providerCfg(modelPath: string, modelID = "m") {
  return {
    options: { baseURL: BASE_URL },
    models: { [modelID]: { options: { modelPath } } },
  }
}

describe("servedModelMatches", () => {
  test("matches absolute served path and basename suffix", () => {
    expect(servedModelMatches(["/Users/joe/models/gemma-3-4b-it-4bit"], MODEL_A)).toBe(true)
    expect(servedModelMatches(["mlx-community/gemma-3-4b-it-4bit"], MODEL_A)).toBe(true)
    expect(servedModelMatches(["/other/Qwen3.5-4B-4bit"], MODEL_B)).toBe(true)
    expect(servedModelMatches(["/models/some-other-model"], MODEL_A)).toBe(false)
    expect(servedModelMatches([], MODEL_A)).toBe(false)
  })
})

describe("LocalModelServer.ensure", () => {
  test("unmanaged when model has no modelPath (BYOS pass-through)", async () => {
    await using tmp = await tmpdir()
    const fake = makeFake(join(tmp.path, "state"))
    const mgr = createLocalModelServerManager(fake.deps)
    const res = await mgr.ensure(
      { providerID: PROVIDER, modelID: "m" },
      { options: { baseURL: BASE_URL }, models: { m: { options: {} } } },
    )
    expect(res).toEqual({ managed: false })
    expect(fake.spawned.length).toBe(0)
  })

  test("spawns server on first use and waits for readiness", async () => {
    await using tmp = await tmpdir()
    const fake = makeFake(join(tmp.path, "state"))
    const mgr = createLocalModelServerManager(fake.deps)
    const res = await mgr.ensure({ providerID: PROVIDER, modelID: "m" }, providerCfg(MODEL_A))
    expect(res.managed).toBe(true)
    expect(res.reused).toBe(false)
    expect(fake.spawned.length).toBe(1)
    const { argv } = fake.spawned[0]
    expect(argv[0]).toBe("/usr/local/bin/mlx_lm.server")
    expect(argv).toContain("--model")
    expect(argv).toContain(MODEL_A)
    expect(argv).toContain("--port")
    expect(argv).toContain("8081")
  })

  test("early server exit during startup throws and clears state", async () => {
    await using tmp = await tmpdir()
    const fake = makeFake(join(tmp.path, "state"), {
      spawnImpl: () => {
        const pid = fake.nextPid++
        fake.alive.add(pid)
        return { pid, exit: Promise.resolve({ code: 1 }), kill: () => {} }
      },
    })
    const mgr = createLocalModelServerManager(fake.deps)
    await expect(mgr.ensure({ providerID: PROVIDER, modelID: "m" }, providerCfg(MODEL_A))).rejects.toThrow(
      /exited with code 1/,
    )
  })

  test("startup timeout throws and kills the child", async () => {
    await using tmp = await tmpdir()
    const fake = makeFake(join(tmp.path, "state"))
    fake.readinessDelay = 1_000_000 // never becomes ready
    const mgr = createLocalModelServerManager({
      ...fake.deps,
      isAlive: (pid) => {
        if (!fake.alive.has(pid)) return false
        fake.alive.delete(pid) // observe the timeout kill
        return true
      },
      kill: (pid) => {
        fake.alive.delete(pid)
      },
    })
    await expect(
      mgr.ensure({ providerID: PROVIDER, modelID: "m" }, providerCfg(MODEL_A)),
    ).rejects.toThrow(/not ready within/)
  })

  test("reuses a healthy server for the same model (state pid alive)", async () => {
    await using tmp = await tmpdir()
    const fake = makeFake(join(tmp.path, "state"))
    const mgr = createLocalModelServerManager(fake.deps)
    const first = await mgr.ensure({ providerID: PROVIDER, modelID: "m" }, providerCfg(MODEL_A))
    const second = await mgr.ensure({ providerID: PROVIDER, modelID: "m" }, providerCfg(MODEL_A))
    expect(second).toEqual({ managed: true, reused: true, pid: first.pid })
    expect(fake.spawned.length).toBe(1)
  })

  test("kills the old server and spawns a new one on model switch", async () => {
    await using tmp = await tmpdir()
    const fake = makeFake(join(tmp.path, "state"))
    const mgr = createLocalModelServerManager(fake.deps)
    const first = await mgr.ensure({ providerID: PROVIDER, modelID: "a" }, providerCfg(MODEL_A, "a"))
    const second = await mgr.ensure({ providerID: PROVIDER, modelID: "b" }, providerCfg(MODEL_B, "b"))
    expect(second.reused).toBe(false)
    expect(second.pid).not.toBe(first.pid)
    expect(fake.spawned.length).toBe(2)
    expect(fake.spawned[1].argv).toContain(MODEL_B)
  })

  test("adopts an orphan (state pid alive) serving the same model after abrupt termination", async () => {
    await using tmp = await tmpdir()
    const fake = makeFake(join(tmp.path, "state"))
    const mgr = createLocalModelServerManager(fake.deps)
    const first = await mgr.ensure({ providerID: PROVIDER, modelID: "m" }, providerCfg(MODEL_A))
    // Simulate gizzi SIGKILL: child keeps running, state file persists, but a
    // NEW manager instance (fresh ProcessRegistry view) comes up.
    const orphan = fake.alive.has(first.pid)
    expect(orphan).toBe(true)
    const mgr2 = createLocalModelServerManager(fake.deps)
    const second = await mgr2.ensure({ providerID: PROVIDER, modelID: "m" }, providerCfg(MODEL_A))
    expect(second).toEqual({ managed: true, reused: true, pid: first.pid })
    expect(fake.spawned.length).toBe(1)
  })

  test("kills an orphan serving a different model after abrupt termination", async () => {
    await using tmp = await tmpdir()
    const fake = makeFake(join(tmp.path, "state"))
    const mgr = createLocalModelServerManager(fake.deps)
    await mgr.ensure({ providerID: PROVIDER, modelID: "a" }, providerCfg(MODEL_A, "a"))
    const mgr2 = createLocalModelServerManager(fake.deps)
    const res = await mgr2.ensure({ providerID: PROVIDER, modelID: "b" }, providerCfg(MODEL_B, "b"))
    expect(res.reused).toBe(false)
    expect(fake.spawned.length).toBe(2)
  })

  test("dead pid in state file is cleared and respawned", async () => {
    await using tmp = await tmpdir()
    const fake = makeFake(join(tmp.path, "state"))
    const mgr = createLocalModelServerManager(fake.deps)
    await mgr.ensure({ providerID: PROVIDER, modelID: "a" }, providerCfg(MODEL_A, "a"))
    fake.alive.clear() // server died while gizzi was away
    fake.served = null
    fake.spawned.length = 0
    const mgr2 = createLocalModelServerManager(fake.deps)
    const res = await mgr2.ensure({ providerID: PROVIDER, modelID: "a" }, providerCfg(MODEL_A, "a"))
    expect(res.reused).toBe(false)
    expect(fake.spawned.length).toBe(1)
  })

  test("foreign server on the port serving another model → error, no spawn", async () => {
    await using tmp = await tmpdir()
    const fake = makeFake(join(tmp.path, "state"))
    fake.served = ["/someone/else/model"]
    const mgr = createLocalModelServerManager(fake.deps)
    await expect(mgr.ensure({ providerID: PROVIDER, modelID: "m" }, providerCfg(MODEL_A))).rejects.toThrow(
      /occupied by a server/,
    )
    expect(fake.spawned.length).toBe(0)
  })

  test("matching server with identifiable pid is adopted (ownership transfer)", async () => {
    await using tmp = await tmpdir()
    const fake = makeFake(join(tmp.path, "state"))
    fake.served = [MODEL_A]
    const deps = { ...fake.deps, listenerPid: () => 77777 }
    const mgr = createLocalModelServerManager(deps)
    const res = await mgr.ensure({ providerID: PROVIDER, modelID: "m" }, providerCfg(MODEL_A))
    expect(res).toEqual({ managed: true, reused: true, pid: 77777 })
    expect(fake.spawned.length).toBe(0)
  })

  test("matching server with unknown pid → error (never kill what we cannot identify)", async () => {
    await using tmp = await tmpdir()
    const fake = makeFake(join(tmp.path, "state"))
    fake.served = [MODEL_A]
    const mgr = createLocalModelServerManager(fake.deps) // listenerPid → undefined
    await expect(mgr.ensure({ providerID: PROVIDER, modelID: "m" }, providerCfg(MODEL_A))).rejects.toThrow(
      /process is unknown/,
    )
    expect(fake.spawned.length).toBe(0)
  })

  test("concurrent ensures spawn exactly one server", async () => {
    await using tmp = await tmpdir()
    const fake = makeFake(join(tmp.path, "state"))
    const mgr = createLocalModelServerManager(fake.deps)
    const [r1, r2] = await Promise.all([
      mgr.ensure({ providerID: PROVIDER, modelID: "m" }, providerCfg(MODEL_A)),
      mgr.ensure({ providerID: PROVIDER, modelID: "m" }, providerCfg(MODEL_A)),
    ])
    expect(fake.spawned.length).toBe(1)
    expect(r1.pid).toBe(r2.pid)
  })

  test("custom serverCmd override is honored", async () => {
    await using tmp = await tmpdir()
    const fake = makeFake(join(tmp.path, "state"))
    const mgr = createLocalModelServerManager(fake.deps)
    await mgr.ensure(
      { providerID: PROVIDER, modelID: "m" },
      { options: { baseURL: BASE_URL }, models: { m: { options: { modelPath: MODEL_A, serverCmd: "python3 -m mlx_lm.server" } } } },
    )
    expect(fake.spawned[0].argv.slice(0, 4)).toEqual(["python3", "-m", "mlx_lm.server", "--model"])
  })
})
