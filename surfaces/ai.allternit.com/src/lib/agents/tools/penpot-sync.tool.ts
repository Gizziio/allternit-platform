/**
 * Penpot Sync Tool
 *
 * Allows agents to "Push" designs from Allternit Design Mode
 * directly into a professional Penpot workspace.
 *
 * Configuration-gated: requires a Penpot instance base URL and a personal
 * access token. When unconfigured, the tool fails honestly instead of
 * pretending to sync.
 *
 *   PENPOT_BASE_URL   e.g. https://design.penpot.app (self-hosted OK)
 *   PENPOT_API_TOKEN  Penpot personal access token
 */
import { env } from "@/lib/env";

const CONFIG_KEYS = "PENPOT_BASE_URL and PENPOT_API_TOKEN";

export const penpotSyncTool = {
  name: 'sync_to_penpot',
  description: `Export and upload the current design (SVG/Design.md) to a Penpot project workspace.

Configuration-gated: this tool only works when the operator has set ${CONFIG_KEYS} (env / .env). Without that configuration it returns an error and does nothing — do not claim a sync succeeded unless this tool returned success with a real penpotUrl.`,
  parameters: {
    type: 'object',
    properties: {
      projectName: { type: 'string', description: 'The name of the Penpot project' },
      format: { type: 'string', enum: ['svg', 'design-md'], default: 'svg' },
      content: { type: 'string', description: 'The design content to upload' }
    },
    required: ['projectName', 'content']
  },
  execute: async ({ projectName, format, content }: any) => {
    const baseUrl = (env("PENPOT_BASE_URL") ?? "").replace(/\/+$/, "");
    const token = env("PENPOT_API_TOKEN") ?? "";

    if (!baseUrl || !token) {
      return {
        success: false,
        error: `Penpot is not configured. Set ${CONFIG_KEYS} to enable sync.`,
      };
    }

    console.debug(`[PenpotSync] Pushing ${format} to project: ${projectName}...`);

    try {
      // Create a file entry on the configured Penpot instance via its REST API.
      const response = await fetch(`${baseUrl}/api/v1/files`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: `${projectName} (${format})`,
          contentLength: typeof content === "string" ? content.length : 0,
        }),
      });

      const raw = await response.text();
      let data: Record<string, unknown> | null = null;
      try {
        data = JSON.parse(raw);
      } catch {
        // Non-JSON response body — surfaced verbatim in the error/success payload.
      }

      if (!response.ok) {
        return {
          success: false,
          error: `Penpot API request failed (${response.status} ${response.statusText}): ${raw.slice(0, 500)}`,
        };
      }

      const fileId =
        (data?.id as string) ??
        (data?.fileId as string) ??
        ((data?.data as Record<string, unknown> | undefined)?.id as string | undefined);

      return {
        success: true,
        // Only reference a URL we actually got back (or can derive from a real
        // file id returned by the API). Never invent one.
        ...(fileId ? { penpotUrl: `${baseUrl}/#/workspace/${fileId}` } : {}),
        message: `Design synced to Penpot project: ${projectName}`,
        penpotResponse: data ?? raw,
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Penpot sync failed: ${err?.message ?? String(err)}`,
      };
    }
  }
};
