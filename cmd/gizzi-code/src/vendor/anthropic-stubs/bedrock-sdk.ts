// @ts-nocheck
// Typed stub for the optional `@anthropic-ai/bedrock-sdk` package.
// Only loaded dynamically when GIZZI_USE_BEDROCK is set; constructing the
// client without the real SDK installed is a loud, actionable error.

const MISSING =
  '@anthropic-ai/bedrock-sdk is not bundled in this build. ' +
  'Install it (bun add @anthropic-ai/bedrock-sdk) or unset GIZZI_USE_BEDROCK.'

export class AnthropicBedrock {
  constructor(..._args: unknown[]) {
    throw new Error(MISSING)
  }
}

export default AnthropicBedrock
