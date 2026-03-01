import { ConfigMarkdown } from "@/config/markdown"
import { Config } from "../config/config"
import { MCP } from "../mcp"
import { Provider } from "../provider/provider"
import { UI } from "./ui"

export function FormatError(input: unknown) {
  if (MCP.Failed.isInstance(input))
    return `MCP server "${input.data?.name ?? "unknown"}" failed. Note, a2r does not support MCP authentication yet.`
  if (Provider.ModelNotFoundError.isInstance(input)) {
    const data = input.data as { providerID?: string; modelID?: string; suggestions?: string[] } | undefined
    const { providerID, modelID, suggestions } = data ?? {}
    return [
      `Model not found: ${providerID ?? "unknown"}/${modelID ?? "unknown"}`,
      ...(Array.isArray(suggestions) && suggestions.length ? ["Did you mean: " + suggestions.join(", ")] : []),
      `Try: \`a2r models\` to list available models`,
      `Or check your config (a2r.json) provider/model names`,
    ].join("\n")
  }
  if (Provider.InitError.isInstance(input)) {
    const data = input.data as { providerID?: string } | undefined
    return `Failed to initialize provider "${data?.providerID ?? "unknown"}". Check credentials and configuration.`
  }
  if (Config.JsonError.isInstance(input)) {
    const data = input.data as { path?: string; message?: string } | undefined
    return (
      `Config file at ${data?.path ?? "unknown"} is not valid JSON(C)` + (data?.message ? `: ${data.message}` : "")
    )
  }
  if (Config.ConfigDirectoryTypoError.isInstance(input)) {
    const data = input.data as { dir?: string; path?: string; suggestion?: string } | undefined
    return `Directory "${data?.dir ?? "unknown"}" in ${data?.path ?? "unknown"} is not valid. Rename the directory to "${data?.suggestion ?? "unknown"}" or remove it. This is a common typo.`
  }
  if (ConfigMarkdown.FrontmatterError.isInstance(input)) {
    return (input.data as { message?: string } | undefined)?.message ?? "Frontmatter error"
  }
  if (Config.InvalidError.isInstance(input)) {
    const data = input.data as { path?: string; message?: string; issues?: Array<{ message: string; path: string[] }> } | undefined
    return [
      `Configuration is invalid${data?.path && data.path !== "config" ? ` at ${data.path}` : ""}` +
        (data?.message ? `: ${data.message}` : ""),
      ...(data?.issues?.map((issue: any) => "↳ " + issue.message + " " + issue.path.join(".")) ?? []),
    ].join("\n")
  }

  if (UI.CancelledError.isInstance(input)) return ""
}

export function FormatUnknownError(input: unknown): string {
  if (input instanceof Error) {
    return input.stack ?? `${input.name}: ${input.message}`
  }

  if (typeof input === "object" && input !== null) {
    try {
      return JSON.stringify(input, null, 2)
    } catch {
      return "Unexpected error (unserializable)"
    }
  }

  return String(input)
}
