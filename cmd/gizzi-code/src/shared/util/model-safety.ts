export function blockedModelReason(input: { providerID: string; modelID: string; name?: string }): string | undefined {
  const provider = input.providerID.toLowerCase()
  const model = input.modelID.toLowerCase()
  const name = (input.name ?? "").toLowerCase()

  if ((provider === "gizzi" || provider === "gizzi") && model.includes("-nano")) {
    return "nano tier hidden for runtime stability"
  }

  // Known unsupported pair for ChatGPT account routing.
  if (
    provider === "openai" &&
    (model.includes("gpt-5.3-codex-spark") || model.includes("codex-spark") || name.includes("gpt-5.3 codex spark"))
  ) {
    return "not supported for this account route"
  }

  return undefined
}

export function isModelBlocked(input: { providerID: string; modelID: string; name?: string }): boolean {
  return !!blockedModelReason(input)
}
