// @ts-nocheck
import { describe, expect, test } from "bun:test"
import path from "path"
import fs from "fs/promises"
import { tmpdir } from "../fixture/fixture"
import { Instance } from "../../src/runtime/context/project/instance"
import { ProviderAuth } from "../../src/runtime/providers/adapters/auth"

describe("plugin.auth-override", () => {
  test("user plugin overrides built-in github-copilot auth", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        const pluginDir = path.join(dir, ".gizzi", "plugin")
        await fs.mkdir(pluginDir, { recursive: true })

        const pluginPath = path.join(pluginDir, "custom-copilot-auth.ts")
        await Bun.write(
          pluginPath,
          [
            "export default async () => ({",
            "  auth: {",
            '    provider: "github-copilot",',
            "    methods: [",
            '      { type: "api", label: "Test Override Auth" },',
            "    ],",
            "    loader: async () => ({ access: 'test-token' }),",
            "  },",
            "})",
            "",
          ].join("\n"),
        )

        await Bun.write(
          path.join(dir, "gizzi.json"),
          JSON.stringify({
            $schema: "https://gizzi.io/config.json",
            plugin: [pluginPath],
          }),
        )
      },
    })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const methods = await ProviderAuth.methods()
        const copilot = methods["github-copilot"]
        expect(copilot).toBeDefined()
        expect(copilot.length).toBe(1)
        expect(copilot[0].label).toBe("Test Override Auth")
      },
    })
  }, 30000) // Increased timeout for plugin installation
})
