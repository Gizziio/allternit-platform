// MiniMax video generation driver.
// Extracted from the legacy /provider/video/generate route so the route stays generic.

import { Auth } from "@/runtime/integrations/auth"
import type { MediaDriver, MediaGenerateInput, MediaGenerateResult, MediaArtifact } from "../types"

export function driver(): MediaDriver {
  return {
    async generate(input: MediaGenerateInput): Promise<MediaGenerateResult> {
      const auth = await Auth.get("minimax")
      if (!auth || auth.type !== "api" || !auth.key) {
        throw new Error("Connect MiniMax in Models & Providers first.")
      }

      const providerHeaders = { Authorization: `Bearer ${auth.key}`, "Content-Type": "application/json" }
      const submit = await fetch("https://api.minimax.io/v1/video_generation", {
        method: "POST",
        headers: providerHeaders,
        body: JSON.stringify({
          model: input.model ?? "MiniMax-Hailuo-2.3",
          prompt: input.prompt,
          duration: input.duration ?? 6,
          resolution: (input.resolution ?? "1080p").toUpperCase(),
        }),
      })

      if (!submit.ok) {
        const detail = await submit.json().catch(() => ({}))
        throw new Error(detail?.message ?? submit.statusText)
      }

      const taskID = (await submit.json())?.task_id
      if (!taskID) throw new Error("MiniMax returned no task ID.")

      const deadline = Date.now() + 5 * 60 * 1000
      while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 10_000))
        const status = await fetch(
          `https://api.minimax.io/v1/query/video_generation?task_id=${encodeURIComponent(taskID)}`,
          { headers: { Authorization: `Bearer ${auth.key}` } },
        )
        if (!status.ok) continue
        const state = await status.json()
        if (state.status === "Fail") {
          throw new Error(state.error_message ?? "MiniMax generation failed.")
        }
        if (state.status !== "Success" || !state.file_id) continue

        const file = await fetch(
          `https://api.minimax.io/v1/files/retrieve?file_id=${encodeURIComponent(state.file_id)}`,
          { headers: { Authorization: `Bearer ${auth.key}` } },
        )
        if (!file.ok) throw new Error("MiniMax file retrieval failed.")
        const downloadURL = (await file.json())?.file?.download_url
        if (!downloadURL) throw new Error("MiniMax returned no download URL.")

        const artifact: MediaArtifact = {
          id: `minimax_${taskID}`,
          url: downloadURL,
          mimeType: "video/mp4",
          metadata: {
            provider: "minimax",
            model: input.model ?? "MiniMax-Hailuo-2.3",
            duration: input.duration ?? 6,
            resolution: input.resolution ?? "1080p",
            fps: input.fps ?? 24,
            aspectRatio: input.aspectRatio ?? "16:9",
            createdAt: new Date().toISOString(),
          },
        }
        return { artifacts: [artifact], prompt: input.prompt }
      }

      throw new Error("MiniMax video generation timed out.")
    },
  }
}
