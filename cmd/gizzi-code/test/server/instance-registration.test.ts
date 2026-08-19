// @ts-nocheck
// Smoke test for instance-registration env-token precedence (BYO-VPS flow):
// the bootstrap injects the box's runtime device token into the systemd env
// file as ALLTERNIT_API_TOKEN. A device-prefixed token (allternit_runtime_…)
// is durable, so registration must refresh on an interval; any other env
// token stays one-shot. The "registry" is a local Bun.serve recorder.
//
// Flag.GIZZI_PLATFORM_API_URL and the refresh interval are read at module
// load, so the fake registry and the env are set up once for the whole file.
import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import * as fs from "fs/promises"
import os from "os"
import path from "path"
import { Log } from "../../src/shared/util/log"

Log.init({ print: false })

type RecordedPut = { authorization: string | null; body: any }

let home: string
let server: ReturnType<typeof Bun.serve>
let recorded: RecordedPut[] = []

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

beforeAll(async () => {
  // Isolate xdg state so Pairing.load()/Auth.all() find nothing and the env
  // token is the only credential in play.
  home = await fs.mkdtemp(path.join(os.tmpdir(), "gizzi-reg-test-"))
  process.env.XDG_DATA_HOME = path.join(home, "share")
  process.env.XDG_CONFIG_HOME = path.join(home, "config")
  process.env.GIZZI_REGISTER_INTERVAL_MS = "40"

  server = Bun.serve({
    port: 0,
    async fetch(req) {
      const url = new URL(req.url)
      if (req.method === "PUT" && url.pathname === "/api/v1/gizzi-instances/self") {
        recorded.push({ authorization: req.headers.get("authorization"), body: await req.json() })
        return Response.json({ id: "gi_test", name: "byo-vps-1", status: "online" })
      }
      return new Response("not found", { status: 404 })
    },
  })
  process.env.GIZZI_PLATFORM_API_URL = `http://127.0.0.1:${server.port}`
})

afterAll(async () => {
  server.stop(true)
  delete process.env.ALLTERNIT_API_TOKEN
  delete process.env.GIZZI_PLATFORM_API_URL
  await fs.rm(home, { recursive: true, force: true })
})

async function registerFor(token: string, ms: number) {
  process.env.ALLTERNIT_API_TOKEN = token
  const { InstanceRegistration } = await import("../../src/runtime/server/instance-registration")
  await InstanceRegistration.register({ url: "http://100.64.0.7:4096", name: "byo-vps-1" })
  await wait(ms)
  InstanceRegistration.stop()
}

describe.skip("InstanceRegistration env token precedence", () => {
  test("device-prefixed ALLTERNIT_API_TOKEN gets the durable refresh loop", async () => {
    recorded = []
    await registerFor("allternit_runtime_smoketest", 160)

    expect(recorded.length).toBeGreaterThanOrEqual(2)
    for (const put of recorded) {
      expect(put.authorization).toBe("Bearer allternit_runtime_smoketest")
      expect(put.body.url).toBe("http://100.64.0.7:4096")
    }
  })

  test("non-device ALLTERNIT_API_TOKEN stays one-shot", async () => {
    recorded = []
    await registerFor("clerk-like-opaque-token", 160)

    expect(recorded.length).toBe(1)
    expect(recorded[0].authorization).toBe("Bearer clerk-like-opaque-token")
  })
})
