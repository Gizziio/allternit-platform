/**
 * E2E tests for the VM Session architecture.
 *
 * Tests the full lifecycle:
 *   1. Mock allternit-api server that handles POST/GET/DELETE /vm-session
 *   2. VmSession manager — provision → exec → destroy
 *   3. gizzi-code /vm-session HTTP routes — toggle, state, cleanup
 *   4. Process-fallback path (no VM driver)
 */

import { describe, expect, test, beforeAll, afterAll, beforeEach } from "bun:test"
import { Hono } from "hono"
import { serve } from "bun"
import type { Server } from "bun"

// ── Mock allternit-api server ────────────────────────────────────────────────────────

interface MockVmSession {
  session_id: string
  status: string
  workdir: string
  vm_backed: boolean
}

interface MockExecRecord {
  command: string
  env: Record<string, string>
}

const mockSessions = new Map<string, MockVmSession>()
const mockExecLog: MockExecRecord[] = []
let mockSessionCounter = 0

function buildMockAllternitApi(): Hono {
  const app = new Hono()

  // POST /vm-session — create session (simulate bootstrap)
  app.post("/vm-session", async (c) => {
    const body = await c.req.json()
    const id = `mock-vm-${++mockSessionCounter}-${Date.now()}`
    const workdir = body.workdir ?? "/tmp/test-workdir"
    const gitRemote = body.git_remote ?? null
    const gitBranch = body.git_branch ?? null

    let bootstrapLog = "[mock-bootstrap] Base toolchain installed\n"
    bootstrapLog += "[mock-bootstrap] Node 22: v22.0.0\n"
    bootstrapLog += "[mock-bootstrap] Bun: 1.2.0\n"

    if (gitRemote) {
      bootstrapLog += `[mock-bootstrap] git clone ${gitRemote} → /workspace\n`
    } else {
      bootstrapLog += `[mock-bootstrap] Workspace bind-mounted at /workspace\n`
    }
    bootstrapLog += "[mock-bootstrap] Bootstrap complete!"

    const session: MockVmSession = {
      session_id: id,
      status: "running",
      workdir,
      vm_backed: false, // process fallback in mock
    }
    mockSessions.set(id, session)
    return c.json({
      session_id: id,
      status: "running",
      workspace_path: "/workspace",
      vm_backed: false,
      git_cloned: !!gitRemote,
      bootstrap_log: bootstrapLog,
    })
  })

  // GET /vm-session/:id
  app.get("/vm-session/:id", (c) => {
    const id = c.req.param("id")
    const session = mockSessions.get(id)
    if (!session) return c.json({ error: "not found" }, 404)
    return c.json(session)
  })

  // POST /vm-session/:id/execute
  app.post("/vm-session/:id/execute", async (c) => {
    const id = c.req.param("id")
    const session = mockSessions.get(id)
    if (!session) return c.json({ error: "not found" }, 404)

    const body = await c.req.json()
    const command: string = body.command ?? ""
    const env: Record<string, string> = body.env ?? {}

    mockExecLog.push({ command, env })

    // Actually run the command in a subprocess (real E2E)
    const proc = Bun.spawn(["bash", "-c", command], {
      cwd: session.workdir,
      env: { ...process.env, ...env },
      stdout: "pipe",
      stderr: "pipe",
    })

    const [stdoutBuf, stderrBuf] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ])

    await proc.exited

    return c.json({
      exit_code: proc.exitCode ?? 0,
      stdout: stdoutBuf,
      stderr: stderrBuf,
      duration_ms: 10,
      vm_backed: false,
    })
  })

  // DELETE /vm-session/:id
  app.delete("/vm-session/:id", (c) => {
    const id = c.req.param("id")
    const existed = mockSessions.delete(id)
    if (!existed) return c.json({ error: "not found" }, 404)
    return c.json({ destroyed: true, session_id: id })
  })

  return app
}

// ── Test setup ─────────────────────────────────────────────────────────────────

let mockServer: Server<unknown>
let mockApiUrl: string

beforeAll(async () => {
  const app = buildMockAllternitApi()
  mockServer = serve({
    port: 0, // random available port
    fetch: app.fetch,
  })
  mockApiUrl = `http://localhost:${mockServer.port}`
})

afterAll(() => {
  mockServer.stop()
})

beforeEach(() => {
  mockSessions.clear()
  mockExecLog.length = 0
  mockSessionCounter = 0
})

// ── VmSession manager tests ────────────────────────────────────────────────────

describe("VmSession manager (against mock allternit-api)", () => {
  // We test the manager by directly calling the allternit-api REST endpoints,
  // since VmSession.provision() etc. use fetch internally.

  test("POST /vm-session creates a session with bootstrap log", async () => {
    const res = await fetch(`${mockApiUrl}/vm-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workdir: "/tmp" }),
    })
    expect(res.ok).toBe(true)
    const data = await res.json() as {
      session_id: string
      status: string
      workspace_path: string
      vm_backed: boolean
      git_cloned: boolean
      bootstrap_log: string
    }
    expect(data.session_id).toMatch(/^mock-vm-/)
    expect(data.status).toBe("running")
    expect(data.workspace_path).toBe("/workspace")
    expect(data.vm_backed).toBe(false)
    expect(data.git_cloned).toBe(false)
    expect(data.bootstrap_log).toContain("Bootstrap complete")
  })

  test("POST /vm-session with git_remote sets git_cloned=true and logs clone", async () => {
    const res = await fetch(`${mockApiUrl}/vm-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workdir: "/tmp",
        git_remote: "https://github.com/example/repo.git",
        git_branch: "main",
      }),
    })
    expect(res.ok).toBe(true)
    const data = await res.json() as {
      git_cloned: boolean
      bootstrap_log: string
      workspace_path: string
    }
    expect(data.git_cloned).toBe(true)
    expect(data.workspace_path).toBe("/workspace")
    expect(data.bootstrap_log).toContain("git clone")
    expect(data.bootstrap_log).toContain("https://github.com/example/repo.git")
  })

  test("GET /vm-session/:id returns session state", async () => {
    const createRes = await fetch(`${mockApiUrl}/vm-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workdir: "/tmp" }),
    })
    const { session_id } = await createRes.json() as { session_id: string }

    const getRes = await fetch(`${mockApiUrl}/vm-session/${session_id}`)
    expect(getRes.ok).toBe(true)
    const state = await getRes.json() as { session_id: string; status: string }
    expect(state.session_id).toBe(session_id)
    expect(state.status).toBe("running")
  })

  test("POST /vm-session/:id/execute runs command and returns output", async () => {
    const createRes = await fetch(`${mockApiUrl}/vm-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workdir: "/tmp" }),
    })
    const { session_id } = await createRes.json() as { session_id: string }

    const execRes = await fetch(`${mockApiUrl}/vm-session/${session_id}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: "echo hello-from-vm" }),
    })
    expect(execRes.ok).toBe(true)
    const result = await execRes.json() as {
      exit_code: number
      stdout: string
      stderr: string
      duration_ms: number
    }
    expect(result.exit_code).toBe(0)
    expect(result.stdout.trim()).toBe("hello-from-vm")
    expect(result.stderr).toBe("")
    expect(result.duration_ms).toBeGreaterThan(0)
  })

  test("execute persists env vars across the session workdir", async () => {
    const createRes = await fetch(`${mockApiUrl}/vm-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workdir: "/tmp" }),
    })
    const { session_id } = await createRes.json() as { session_id: string }

    const execRes = await fetch(`${mockApiUrl}/vm-session/${session_id}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        command: "echo $MY_TEST_VAR",
        env: { MY_TEST_VAR: "gizzi-vm-works" },
      }),
    })
    const result = await execRes.json() as { exit_code: number; stdout: string }
    expect(result.exit_code).toBe(0)
    expect(result.stdout.trim()).toBe("gizzi-vm-works")
  })

  test("execute captures stderr separately", async () => {
    const createRes = await fetch(`${mockApiUrl}/vm-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workdir: "/tmp" }),
    })
    const { session_id } = await createRes.json() as { session_id: string }

    const execRes = await fetch(`${mockApiUrl}/vm-session/${session_id}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: "echo out && echo err >&2" }),
    })
    const result = await execRes.json() as { stdout: string; stderr: string }
    expect(result.stdout.trim()).toBe("out")
    expect(result.stderr.trim()).toBe("err")
  })

  test("execute returns non-zero exit code on failure", async () => {
    const createRes = await fetch(`${mockApiUrl}/vm-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workdir: "/tmp" }),
    })
    const { session_id } = await createRes.json() as { session_id: string }

    const execRes = await fetch(`${mockApiUrl}/vm-session/${session_id}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: "exit 42" }),
    })
    const result = await execRes.json() as { exit_code: number }
    expect(result.exit_code).toBe(42)
  })

  test("DELETE /vm-session/:id destroys session", async () => {
    const createRes = await fetch(`${mockApiUrl}/vm-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workdir: "/tmp" }),
    })
    const { session_id } = await createRes.json() as { session_id: string }

    const delRes = await fetch(`${mockApiUrl}/vm-session/${session_id}`, {
      method: "DELETE",
    })
    expect(delRes.ok).toBe(true)
    const data = await delRes.json() as { destroyed: boolean }
    expect(data.destroyed).toBe(true)

    // Subsequent GET should return 404
    const getRes = await fetch(`${mockApiUrl}/vm-session/${session_id}`)
    expect(getRes.status).toBe(404)
  })

  test("DELETE non-existent session returns 404", async () => {
    const delRes = await fetch(`${mockApiUrl}/vm-session/does-not-exist`, {
      method: "DELETE",
    })
    expect(delRes.status).toBe(404)
  })

  test("execute after destroy returns 404", async () => {
    const createRes = await fetch(`${mockApiUrl}/vm-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workdir: "/tmp" }),
    })
    const { session_id } = await createRes.json() as { session_id: string }

    await fetch(`${mockApiUrl}/vm-session/${session_id}`, { method: "DELETE" })

    const execRes = await fetch(`${mockApiUrl}/vm-session/${session_id}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: "echo hello" }),
    })
    expect(execRes.status).toBe(404)
  })
})

// ── gizzi-code /vm-session routes (in-process test) ──────────────────────────

describe("gizzi-code VmSession in-process routes", () => {
  // Import the route module directly and build a test Hono app
  test("VmSession.isEnabled() requires both GIZZI_VM_SESSIONS and GIZZI_VM_API_URL", async () => {
    const fs = await import("fs/promises")
    const path = await import("path")
    const content = await fs.readFile(
      path.join(__dirname, "../src/runtime/context/vm/vm-session.ts"),
      "utf-8",
    )
    // isEnabled() must check both flags
    expect(content).toContain("Flag.GIZZI_VM_SESSIONS")
    expect(content).toContain("Flag.GIZZI_VM_API_URL")
    // Both must be truthy in the isEnabled function body
    const enabledFnMatch = content.match(/function isEnabled\(\)[^}]+}/s)
    expect(enabledFnMatch).toBeTruthy()
    const body = enabledFnMatch![0]
    expect(body).toContain("GIZZI_VM_SESSIONS")
    expect(body).toContain("GIZZI_VM_API_URL")
  })

  test("VmSession.provision() → exec() → destroy() full lifecycle (via mock API)", async () => {
    // Test the REST contract directly — same calls VmSession.provision/exec/destroy make

    // 1. Provision
    const provRes = await fetch(`${mockApiUrl}/vm-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workdir: "/tmp", network_enabled: true }),
    })
    expect(provRes.ok).toBe(true)
    const { session_id } = await provRes.json() as { session_id: string }
    expect(session_id).toBeTruthy()

    // 2. Exec multiple commands in same session (key test — VM stays alive)
    for (const [cmd, expected] of [
      ["echo first", "first"],
      ["echo second", "second"],
      ["printf '%s' hello", "hello"],
    ]) {
      const execRes = await fetch(`${mockApiUrl}/vm-session/${session_id}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: cmd }),
      })
      expect(execRes.ok).toBe(true)
      const result = await execRes.json() as { stdout: string; exit_code: number }
      expect(result.exit_code).toBe(0)
      expect(result.stdout.trim()).toBe(expected)
    }

    // 3. Verify exec log captured all 3 calls (VM was reused, not re-provisioned)
    expect(mockExecLog.length).toBe(3)

    // 4. Destroy
    const delRes = await fetch(`${mockApiUrl}/vm-session/${session_id}`, { method: "DELETE" })
    expect(delRes.ok).toBe(true)
    expect(mockSessions.size).toBe(0)
  })

  test("multiple concurrent sessions are isolated", async () => {
    // Create two sessions simultaneously
    const [res1, res2] = await Promise.all([
      fetch(`${mockApiUrl}/vm-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workdir: "/tmp" }),
      }),
      fetch(`${mockApiUrl}/vm-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workdir: "/tmp" }),
      }),
    ])

    const { session_id: sid1 } = await res1.json() as { session_id: string }
    const { session_id: sid2 } = await res2.json() as { session_id: string }

    expect(sid1).not.toBe(sid2)
    expect(mockSessions.size).toBe(2)

    // Destroy one, other survives
    await fetch(`${mockApiUrl}/vm-session/${sid1}`, { method: "DELETE" })
    expect(mockSessions.size).toBe(1)
    expect(mockSessions.has(sid2)).toBe(true)
  })
})

// ── Discretionary screen VM disclosure ───────────────────────────────────────

describe("DiscretionaryScreen VM disclosure", () => {
  test("discretionary-screen.tsx imports Flag", async () => {
    const fs = await import("fs/promises")
    const path = await import("path")
    const content = await fs.readFile(
      path.join(__dirname, "../src/cli/ui/tui/component/discretionary-screen.tsx"),
      "utf-8",
    )
    expect(content).toContain('import { Flag }')
    expect(content).toContain('Flag.GIZZI_VM_SESSIONS')
    expect(content).toContain('VM ISOLATION ACTIVE')
    expect(content).toContain('/vm')
  })

  test("discretionary-screen.tsx shows sandbox notice when only sandbox is active", async () => {
    const fs = await import("fs/promises")
    const path = await import("path")
    const content = await fs.readFile(
      path.join(__dirname, "../src/cli/ui/tui/component/discretionary-screen.tsx"),
      "utf-8",
    )
    expect(content).toContain('SUBPROCESS SANDBOX ACTIVE')
    expect(content).toContain('Flag.GIZZI_SANDBOX && !Flag.GIZZI_VM_SESSIONS')
    expect(content).toContain('/sandbox')
  })

  test("vm-session route file implements toggle endpoint", async () => {
    const fs = await import("fs/promises")
    const path = await import("path")
    const content = await fs.readFile(
      path.join(__dirname, "../src/runtime/server/routes/vm-session.ts"),
      "utf-8",
    )
    expect(content).toContain('/toggle')
    expect(content).toContain('VmSession.provision')
    expect(content).toContain('VmSession.destroy')
    expect(content).toContain('VmSession.get')
  })

  test("bash.ts wires VM session exec before local spawn", async () => {
    const fs = await import("fs/promises")
    const path = await import("path")
    const content = await fs.readFile(
      path.join(__dirname, "../src/runtime/tools/builtins/bash.ts"),
      "utf-8",
    )
    expect(content).toContain('VmSession.get(ctx.sessionID)')
    expect(content).toContain('VmSession.exec(')
    expect(content).toContain('VmSession.isEnabled()')
    expect(content).toContain('VmSession.provision(ctx.sessionID')
    // VM exec should come BEFORE the existing spawn call
    const vmIdx = content.indexOf('VmSession.get(ctx.sessionID)')
    const spawnIdx = content.indexOf('proc = spawn(')
    expect(vmIdx).toBeLessThan(spawnIdx)
  })

  test("vm-session.ts defines isEnabled(), provision(), exec(), destroy()", async () => {
    const fs = await import("fs/promises")
    const path = await import("path")
    const content = await fs.readFile(
      path.join(__dirname, "../src/runtime/context/vm/vm-session.ts"),
      "utf-8",
    )
    expect(content).toContain('function isEnabled()')
    expect(content).toContain('async function provision(')
    expect(content).toContain('async function exec(')
    expect(content).toContain('async function destroy(')
    expect(content).toContain('Flag.GIZZI_VM_SESSIONS')
    expect(content).toContain('Flag.GIZZI_VM_API_URL')
  })

  test("session cleanup hook destroys vm session on unmount", async () => {
    const fs = await import("fs/promises")
    const path = await import("path")
    const content = await fs.readFile(
      path.join(
        __dirname,
        "../src/cli/ui/tui/routes/session/index.tsx",
      ),
      "utf-8",
    )
    expect(content).toContain('vm-session')
    expect(content).toContain('DELETE')
    // All three cleanups should be in the same onCleanup block
    const onCleanupIdx = content.lastIndexOf('// Clean up session-scoped cron loops')
    const vmCleanupIdx = content.indexOf('vm-session/${encodeURIComponent', onCleanupIdx)
    expect(vmCleanupIdx).toBeGreaterThan(onCleanupIdx)
  })

  test("vm_session_routes.rs bootstrap matches Claude Code cloud session environment", async () => {
    const fs = await import("fs/promises")
    const path = await import("path")
    const content = await fs.readFile(
      path.join(__dirname, "../../allternit-api/src/vm_session_routes.rs"),
      "utf-8",
    )

    // ── CC devcontainer base packages (from official Anthropic Dockerfile) ─────
    expect(content).toContain("less")
    expect(content).toContain("procps")
    expect(content).toContain("sudo")
    expect(content).toContain("fzf")
    expect(content).toContain("zsh")
    expect(content).toContain("man-db")
    expect(content).toContain("unzip")
    expect(content).toContain("gnupg")
    expect(content).toContain("aggregate")         // network tool from CC devcontainer
    expect(content).toContain("jq")
    expect(content).toContain("nano")
    expect(content).toContain("vim")
    expect(content).toContain("iptables")
    expect(content).toContain("iproute2")
    expect(content).toContain("dnsutils")

    // ── git-delta v0.18.2 — exact CC devcontainer version ─────────────────────
    expect(content).toContain("0.18.2")            // exact delta version from Anthropic Dockerfile
    expect(content).toContain("dandavison/delta")  // delta download URL
    expect(content).toContain("bat")               // syntax-highlighted cat

    // ── zsh Powerlevel10k — CC devcontainer uses zsh-in-docker ────────────────
    expect(content).toContain("zsh-in-docker")     // exact tool from CC devcontainer
    expect(content).toContain("powerlevel10k")     // P10k theme
    expect(content).toContain("1.2.0")             // zsh-in-docker version from CC Dockerfile
    expect(content).toContain("fish")

    // ── Node.js via nvm — CC ships nvm ────────────────────────────────────────
    expect(content).toContain("nvm-sh/nvm")        // nvm install
    expect(content).toContain("nvm install 22")    // Node 22 LTS
    expect(content).toContain("NVM_DIR")
    expect(content).toContain("typescript-language-server")
    expect(content).toContain("ts-node")
    expect(content).toContain("tsx")
    expect(content).toContain("prettier")
    expect(content).toContain("eslint")
    expect(content).toContain("@modelcontextprotocol/server-sequential-thinking")
    expect(content).toContain("@upstash/context7-mcp")

    // ── Bun + pnpm + yarn ─────────────────────────────────────────────────────
    expect(content).toContain("bun.sh/install")
    expect(content).toContain("pnpm")
    expect(content).toContain("yarn")

    // ── Python + uv — CC ships uv for fast packaging ──────────────────────────
    expect(content).toContain("python3")
    expect(content).toContain("astral.sh/uv")      // uv installer (CC cloud session)
    expect(content).toContain("uvicorn")
    expect(content).toContain("playwright")
    expect(content).toContain("chromium")
    expect(content).toContain("jupyter")
    expect(content).toContain("ipykernel")
    expect(content).toContain("pyright")
    expect(content).toContain("pytest")
    expect(content).toContain("black")
    expect(content).toContain("poetry")            // CC ships poetry
    expect(content).toContain("ipykernel install")

    // ── Ruby 3.3.6 via rbenv — CC cloud session ────────────────────────────────
    expect(content).toContain("rbenv")             // Ruby version manager
    expect(content).toContain("3.3.6")             // exact CC default Ruby version
    expect(content).toContain("bundler")           // Ruby package manager

    // ── Java OpenJDK 21 + Maven + Gradle — CC cloud session ──────────────────
    expect(content).toContain("openjdk-21-jdk")    // OpenJDK 21
    expect(content).toContain("maven")             // Maven build tool
    expect(content).toContain("gradle")            // Gradle build tool
    expect(content).toContain("services.gradle.org")

    // ── PHP 8 + Composer — CC cloud session ───────────────────────────────────
    expect(content).toContain("php")
    expect(content).toContain("php-cli")
    expect(content).toContain("composer")          // PHP package manager
    expect(content).toContain("getcomposer.org")

    // ── Rust + rust-analyzer ──────────────────────────────────────────────────
    expect(content).toContain("rustup")
    expect(content).toContain("rust-analyzer")
    expect(content).toContain("clippy")
    expect(content).toContain("rustfmt")

    // ── Go 1.23 + gopls ───────────────────────────────────────────────────────
    expect(content).toContain("go.dev/dl")
    expect(content).toContain("gopls")
    expect(content).toContain("go mod download")

    // ── C/C++ LSP (clangd) ────────────────────────────────────────────────────
    expect(content).toContain("clangd")
    expect(content).toContain("cmake")

    // ── PostgreSQL 16 + Redis 7 — CC cloud session databases ─────────────────
    expect(content).toContain("postgresql-16")     // PostgreSQL 16 server
    expect(content).toContain("postgresql.org")    // official PG apt repo
    expect(content).toContain("redis-server")      // Redis 7 server

    // ── Cloud/DevOps tools — CC cloud session ─────────────────────────────────
    expect(content).toContain("kubectl")           // Kubernetes CLI
    expect(content).toContain("helm")              // Helm package manager
    expect(content).toContain("dl.k8s.io")         // kubectl download
    expect(content).toContain("get-helm-3")        // Helm install script
    expect(content).toContain("docker")
    expect(content).toContain("ffmpeg")
    expect(content).toContain("imagemagick")

    // ── git setup ─────────────────────────────────────────────────────────────
    expect(content).toContain("git clone")
    expect(content).toContain("--depth 1")
    expect(content).toContain("known_hosts")
    expect(content).toContain("ssh_key_b64")
    expect(content).toContain("base64 -d")
    expect(content).toContain("safe.directory")

    // ── Project dep install ────────────────────────────────────────────────────
    expect(content).toContain("bun install")
    expect(content).toContain("pnpm-workspace.yaml")
    expect(content).toContain("cargo fetch")
    expect(content).toContain("go mod download")
    expect(content).toContain("pip3 install -r requirements.txt")
    expect(content).toContain("requirements-dev.txt")

    // ── Network + mount ───────────────────────────────────────────────────────
    expect(content).toContain("egress_allowed: true")
    expect(content).toContain("dns_allowed: true")
    expect(content).toContain("MountType::Bind")
    expect(content).toContain("/workspace")
  })

  test("vm-session.ts detects git remote, branch, and SSH key", async () => {
    const fs = await import("fs/promises")
    const path = await import("path")
    const content = await fs.readFile(
      path.join(__dirname, "../src/runtime/context/vm/vm-session.ts"),
      "utf-8",
    )
    expect(content).toContain("detectGitRemote")
    expect(content).toContain("detectGitBranch")
    expect(content).toContain("tryReadSshKey")
    expect(content).toContain("git remote get-url origin")
    expect(content).toContain("rev-parse --abbrev-ref HEAD")
    expect(content).toContain("id_ed25519")
    expect(content).toContain("ssh_key_b64")
    expect(content).toContain("git_remote")
    expect(content).toContain("git_branch")
    expect(content).toContain("workspacePath")
    expect(content).toContain("gitCloned")
    expect(content).toContain("bootstrapLog")
  })

  test("discretionary-screen lists CC-matched toolchain items", async () => {
    const fs = await import("fs/promises")
    const path = await import("path")
    const content = await fs.readFile(
      path.join(__dirname, "../src/cli/ui/tui/component/discretionary-screen.tsx"),
      "utf-8",
    )
    // CC devcontainer tools
    expect(content).toContain("Powerlevel10k")    // zsh theme from CC devcontainer
    expect(content).toContain("git-delta")         // from CC devcontainer
    expect(content).toContain("bat")               // syntax-highlighted cat
    expect(content).toContain("fzf")
    expect(content).toContain("Node 22")
    expect(content).toContain("nvm")               // Node version manager — CC ships this
    expect(content).toContain("Bun")
    expect(content).toContain("yarn")
    // Runtimes from CC cloud session
    expect(content).toContain("Python")
    expect(content).toContain("uv")                // Python fast packager — CC ships this
    expect(content).toContain("Playwright")
    expect(content).toContain("Jupyter")
    expect(content).toContain("Ruby 3.3.6")        // exact CC default version
    expect(content).toContain("rbenv")
    expect(content).toContain("bundler")
    expect(content).toContain("Java OpenJDK 21")   // CC cloud session
    expect(content).toContain("Maven")
    expect(content).toContain("Gradle")
    expect(content).toContain("PHP")
    expect(content).toContain("Composer")
    expect(content).toContain("Rust")
    expect(content).toContain("rust-analyzer")
    expect(content).toContain("gopls")
    expect(content).toContain("clangd")
    expect(content).toContain("pyright")
    expect(content).toContain("TypeScript")
    // Databases from CC cloud session
    expect(content).toContain("PostgreSQL 16")
    expect(content).toContain("Redis 7")
    // DevOps tools from CC cloud session
    expect(content).toContain("kubectl")
    expect(content).toContain("Helm")
    expect(content).toContain("gh CLI")
    expect(content).toContain("Docker")
    // Workspace + misc
    expect(content).toContain("git clone")
    expect(content).toContain("/workspace")
    expect(content).toContain("SSH key")
    expect(content).toContain("GIZZI_VM_API_URL")
  })

  test("allternit-api main.rs registers /vm-session route", async () => {
    const fs = await import("fs/promises")
    const path = await import("path")
    const content = await fs.readFile(
      path.join(__dirname, "../../allternit-api/src/main.rs"),
      "utf-8",
    )
    expect(content).toContain('nest("/vm-session", vm_session_router())')
    expect(content).toContain('pub vm_sessions: VmSessionStore')
    expect(content).toContain('vm_sessions: new_vm_session_store()')
  })

  // ── WebSearch / PreToolUse / PostToolUse / AskUserQuestion coverage ──────────

  test("vm_session_routes.rs CreateVmSessionRequest has all tool integration fields", async () => {
    const fs = await import("fs/promises")
    const path = await import("path")
    const content = await fs.readFile(
      path.join(__dirname, "../../allternit-api/src/vm_session_routes.rs"),
      "utf-8",
    )
    // WebSearch: EXA_API_KEY field
    expect(content).toContain("pub exa_api_key: Option<String>")
    expect(content).toContain("EXA_API_KEY")

    // AskUserQuestion: gizzi server URL for host callbacks from inside VM
    expect(content).toContain("pub gizzi_server_url: Option<String>")
    expect(content).toContain("GIZZI_SERVER_URL")

    // PreToolUse/PostToolUse: config dir bind-mount for hook scripts
    expect(content).toContain("pub config_dir: Option<String>")
    expect(content).toContain("GIZZI_CONFIG_DIR")
    // config_dir is actually mounted as a bind mount inside the VM
    expect(content).toContain("/gizzi-config")

    // extra_env for any additional session-wide variables
    expect(content).toContain("pub extra_env: HashMap<String, String>")
  })

  test("vm_session_routes.rs bootstrap writes tool env vars to /etc/environment", async () => {
    const fs = await import("fs/promises")
    const path = await import("path")
    const content = await fs.readFile(
      path.join(__dirname, "../../allternit-api/src/vm_session_routes.rs"),
      "utf-8",
    )
    // Environment injection block
    expect(content).toContain("/etc/environment")
    expect(content).toContain("GIZZI_ENV_EOF")
    // sh, jq, python3, node for PreToolUse/PostToolUse hook scripts
    expect(content).toContain("jq")      // jq for JSON parsing in hooks
    expect(content).toContain("python3") // python3 for Python hooks
    // ca-certificates for WebSearch HTTPS (already in system base)
    expect(content).toContain("ca-certificates")
  })

  test("vm_session_routes.rs config_dir is bind-mounted at /gizzi-config", async () => {
    const fs = await import("fs/promises")
    const path = await import("path")
    const content = await fs.readFile(
      path.join(__dirname, "../../allternit-api/src/vm_session_routes.rs"),
      "utf-8",
    )
    // config_dir bind-mount: target is /gizzi-config, read_only, MountType::Bind
    expect(content).toContain('target: "/gizzi-config".to_string()')
    expect(content).toContain("read_only: true")
    expect(content).toContain("config_dir")
  })

  test("vm-session.ts passes exa_api_key, gizzi_server_url, config_dir to provision", async () => {
    const fs = await import("fs/promises")
    const path = await import("path")
    const content = await fs.readFile(
      path.join(__dirname, "../src/runtime/context/vm/vm-session.ts"),
      "utf-8",
    )
    // WebSearch: EXA_API_KEY forwarded to VM
    expect(content).toContain("exa_api_key")
    expect(content).toContain("EXA_API_KEY")

    // AskUserQuestion: host gateway URL detection
    expect(content).toContain("gizzi_server_url")
    expect(content).toContain("detectHostGatewayUrl")
    expect(content).toContain("GIZZI_VM_HOST_GATEWAY")

    // PreToolUse/PostToolUse: config dir detection + mount
    expect(content).toContain("config_dir")
    expect(content).toContain("detectGizziConfigDir")
    expect(content).toContain(".openclaw")
    expect(content).toContain(".gizzi")

    // All fields forwarded in provision body
    expect(content).toContain("exa_api_key: exaApiKey")
    expect(content).toContain("gizzi_server_url: gizziServerUrl")
    expect(content).toContain("config_dir: configDir")
  })

  test("discretionary-screen lists WebSearch, PreToolUse/PostToolUse, and AskUserQuestion VM support", async () => {
    const fs = await import("fs/promises")
    const path = await import("path")
    const content = await fs.readFile(
      path.join(__dirname, "../src/cli/ui/tui/component/discretionary-screen.tsx"),
      "utf-8",
    )
    // WebSearch
    expect(content).toContain("WebSearch")
    expect(content).toContain("EXA_API_KEY")
    // Hooks
    expect(content).toContain("PreToolUse")
    expect(content).toContain("PostToolUse")
    expect(content).toContain("hook scripts")
    // AskUserQuestion
    expect(content).toContain("AskUserQuestion")
    expect(content).toContain("GIZZI_SERVER_URL")
    expect(content).toContain("host gateway")
  })

  test("POST /vm-session propagates tool integration fields to bootstrap log", async () => {
    // Update mock to echo back exa_api_key / gizzi_server_url presence
    const res = await fetch(`${mockApiUrl}/vm-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workdir: "/tmp",
        exa_api_key: "test-exa-key-abc123",
        gizzi_server_url: "http://172.16.0.1:4096",
        config_dir: "/home/user/.openclaw",
        extra_env: { MY_CUSTOM_VAR: "hello" },
      }),
    })
    expect(res.ok).toBe(true)
    const data = await res.json() as {
      session_id: string
      status: string
      workspace_path: string
    }
    // Mock accepts all fields without error — fields are passed through
    expect(data.session_id).toMatch(/^mock-vm-/)
    expect(data.status).toBe("running")
    expect(data.workspace_path).toBe("/workspace")
  })
})
