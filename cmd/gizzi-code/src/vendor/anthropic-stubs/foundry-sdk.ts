// @ts-nocheck
// Typed stub for the optional `@anthropic-ai/foundry-sdk` package.
// Only loaded dynamically when GIZZI_USE_FOUNDRY is set; constructing the
// client without the real SDK installed is a loud, actionable error.

const MISSING =
  '@anthropic-ai/foundry-sdk is not bundled in this build. ' +
  'Install it (bun add @anthropic-ai/foundry-sdk) or unset GIZZI_USE_FOUNDRY.'

export class AnthropicFoundry {
  constructor(..._args: unknown[]) {
    throw new Error(MISSING)
  }
}

export default AnthropicFoundry
