// Blender MCP driver.
// Talks to a Blender Model Context Protocol server for 3D renders/animations.

import type { MediaDriver, MediaGenerateInput, MediaGenerateResult, MediaArtifact } from "../types"

export function driver(): MediaDriver {
  return {
    async generate(input: MediaGenerateInput): Promise<MediaGenerateResult> {
      // TODO: dispatch to the Blender MCP server once the MCP routing layer is exposed.
      const artifact: MediaArtifact = {
        id: `blender-mcp_${Date.now()}`,
        url: "",
        mimeType: input.fps ? "video/mp4" : "image/png",
        metadata: {
          provider: "blender-mcp",
          prompt: input.prompt,
          stub: true,
          setup: "Configure a Blender MCP server in .mcp.json to enable 3D renders.",
        },
      }
      return { artifacts: [artifact], prompt: input.prompt }
    },
  }
}
