/**
 * E2E test for the Desktop Cloud agent tool.
 *
 * This test exercises the full gizzi-code desktop tool lifecycle against the
 * real Allternit Desktop Cloud API. It is skipped unless the required env vars
 * are present, so it does not run in normal CI.
 *
 * Required environment:
 *   ALLTERNIT_GATEWAY_URL          - API base URL
 *   ALLTERNIT_SELF_HOSTED_TOKEN    - Self-hosted auth token
 *
 * The test provisions a Tart desktop, installs the minimal packages needed for
 * screenshot/mouse/keyboard automation, runs each action, and deprovisions.
 */

import { describe, expect, test, beforeAll } from "bun:test"
import { DesktopTool } from "@/runtime/tools/builtins/desktop"

const API_BASE_URL = process.env.ALLTERNIT_GATEWAY_URL
const API_TOKEN = process.env.ALLTERNIT_SELF_HOSTED_TOKEN
const BOT_ID = "623f4106-6276-46f5-9321-842bab50f9f3"
const TEMPLATE_ID = "dtpl-6103a35a19314647b4708f5c156a2d47"

const describeE2E = API_BASE_URL && API_TOKEN ? describe : describe.skip

describeE2E("desktop tool e2e", () => {
  let tool: Awaited<ReturnType<typeof DesktopTool.init>>
  const ctx = {
    sessionID: "desktop-e2e-session",
    messageID: "desktop-e2e-message",
    agent: "desktop-e2e-agent",
    abort: new AbortController().signal,
    messages: [],
    metadata: () => {},
    ask: async () => {},
  } as any

  beforeAll(async () => {
    tool = await DesktopTool.init()
  })

  test("full lifecycle", async () => {
    // 1. Provision
    const provisioned = await tool.execute(
      {
        bot_id: BOT_ID,
        action: "provision",
        os: "macos",
        template_id: TEMPLATE_ID,
      },
      ctx,
    )
    expect(provisioned.metadata.result.status).toBe("running")
    expect(provisioned.metadata.result.provider).toBe("tart")
    const sandboxId = provisioned.metadata.result.sandbox_id as string
    expect(sandboxId).toBeTruthy()

    // 2. Install desktop automation dependencies inside the guest
    for (const cmd of [
      ["sudo", "apt-get", "update"],
      ["sudo", "apt-get", "install", "-y", "scrot", "xvfb", "xdotool"],
    ]) {
      const r = await tool.execute(
        { bot_id: BOT_ID, action: "shell", sandbox_id: sandboxId, command: cmd },
        ctx,
      )
      expect(r.metadata.result.exit_code).toBe(0)
    }

    // 3. Start a virtual X display for screenshot/mouse/keyboard
    const xvfb = await tool.execute(
      {
        bot_id: BOT_ID,
        action: "shell",
        sandbox_id: sandboxId,
        command: [
          "bash",
          "-c",
          "pkill Xvfb 2>/dev/null; (setsid nohup Xvfb :0 -ac -screen 0 1024x768x24 >/tmp/xvfb.log 2>&1 &); sleep 2; ps aux | grep Xvfb | grep -v grep",
        ],
      },
      ctx,
    )
    expect(xvfb.metadata.result.exit_code).toBe(0)
    expect(xvfb.output).toContain("Xvfb :0")

    // 4. Shell: verify OS
    const shell = await tool.execute(
      {
        bot_id: BOT_ID,
        action: "shell",
        sandbox_id: sandboxId,
        command: ["uname", "-a"],
      },
      ctx,
    )
    expect(shell.metadata.result.exit_code).toBe(0)
    expect(shell.output).toContain("Linux")

    // 5. Screenshot
    const screenshot = await tool.execute(
      { bot_id: BOT_ID, action: "screenshot", sandbox_id: sandboxId },
      ctx,
    )
    expect(screenshot.attachments).toHaveLength(1)
    expect(screenshot.attachments![0].type).toBe("image")
    expect(screenshot.attachments![0].content.length).toBeGreaterThan(1000)

    // 6. Mouse
    const mouse = await tool.execute(
      {
        bot_id: BOT_ID,
        action: "mouse",
        sandbox_id: sandboxId,
        mouse_action: "move",
        x: 100,
        y: 200,
      },
      ctx,
    )
    expect(mouse.metadata.result.success).toBe(true)

    // 7. Keyboard
    const keyboard = await tool.execute(
      {
        bot_id: BOT_ID,
        action: "keyboard",
        sandbox_id: sandboxId,
        keyboard_action: "type",
        keyboard_input: "hello from desktop tool e2e",
      },
      ctx,
    )
    expect(keyboard.metadata.result.success).toBe(true)

    // 8. File upload
    const uploadContent = Buffer.from("hello from desktop cloud").toString("base64")
    const upload = await tool.execute(
      {
        bot_id: BOT_ID,
        action: "files/upload",
        sandbox_id: sandboxId,
        path: "/tmp/uploaded.txt",
        content_base64: uploadContent,
      },
      ctx,
    )
    expect(upload.metadata.result.success).toBe(true)

    // 9. File download
    const download = await tool.execute(
      {
        bot_id: BOT_ID,
        action: "files/download",
        sandbox_id: sandboxId,
        path: "/tmp/uploaded.txt",
      },
      ctx,
    )
    expect(download.attachments).toHaveLength(1)
    expect(download.attachments![0].type).toBe("file")
    const decoded = Buffer.from(download.attachments![0].content, "base64").toString("utf-8")
    expect(decoded).toBe("hello from desktop cloud")

    // 10. Deprovision
    const deprovisioned = await tool.execute(
      { bot_id: BOT_ID, action: "deprovision", sandbox_id: sandboxId },
      ctx,
    )
    expect(deprovisioned.output).toContain("Deprovisioned sandbox")
  }, 600000)
})
