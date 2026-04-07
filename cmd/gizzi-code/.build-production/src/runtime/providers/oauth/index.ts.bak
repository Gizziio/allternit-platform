import { anthropicOAuth } from "./anthropic"
import { githubCopilotOAuth } from "./github-copilot"
import { openaiOAuth } from "./openai"
import { googleOAuth } from "./google"

export { anthropicOAuth, refreshAnthropicToken } from "./anthropic"
export { githubCopilotOAuth } from "./github-copilot"
export { openaiOAuth, refreshOpenAIToken } from "./openai"
export { googleOAuth, refreshGoogleToken } from "./google"

export interface OAuthFlow {
  label: string
  description: string
  authorize(inputs: Record<string, string>): Promise<{
    url: string
    method: "auto" | "code"
    instructions?: string
    callback: (input?: string) => Promise<
      | { type: "success"; provider: string; refresh?: string; access?: string; expires?: number; key?: string }
      | { type: "failed"; error: string }
    >
  }>
}

/** Map of provider ID → OAuth flow. These are shown in connect login before the API key prompt. */
export const BUILTIN_OAUTH: Record<string, OAuthFlow> = {
  anthropic: anthropicOAuth as OAuthFlow,
  openai: openaiOAuth as OAuthFlow,
  "github-copilot": githubCopilotOAuth as OAuthFlow,
  google: googleOAuth as OAuthFlow,
}
