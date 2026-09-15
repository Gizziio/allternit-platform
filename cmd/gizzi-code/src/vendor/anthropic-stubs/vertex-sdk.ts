// @ts-nocheck
// Typed stub for the optional `@anthropic-ai/vertex-sdk` package.
// Only loaded dynamically when the Vertex provider is selected; constructing
// the client without the real SDK installed is a loud, actionable error.

const MISSING =
  '@anthropic-ai/vertex-sdk is not bundled in this build. ' +
  'Install it (bun add @anthropic-ai/vertex-sdk) or unset GIZZI_USE_VERTEX.'

export class AnthropicVertex {
  constructor(..._args: unknown[]) {
    throw new Error(MISSING)
  }
}

export default AnthropicVertex
