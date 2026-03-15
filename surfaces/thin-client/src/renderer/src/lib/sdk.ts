/**
 * @a2r/sdk client — singleton for the renderer process.
 *
 * Reads the gizzi-code server URL from the env var
 * RENDERER_VITE_GIZZI_URL (falls back to localhost:4096).
 */
import { createA2RClient } from "@a2r/sdk";

const baseUrl =
  (import.meta as any).env?.RENDERER_VITE_GIZZI_URL ?? "http://localhost:4096";

export const sdk = createA2RClient({ baseUrl });
