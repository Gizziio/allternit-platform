// @ts-nocheck
// Stub for the optional `google-auth-library` package. Vertex auth is a
// dynamic import() in src/runtime/services/api/client.ts; Bun.build does not
// apply tsconfig paths to dynamic import(), so production bundle needs this
// file plus an onResolve in script/build-production.js.

const MISSING =
  'google-auth-library is not bundled in this build. ' +
  'Install it (bun add google-auth-library) or unset GIZZI_USE_VERTEX.'

export class GoogleAuth {
  constructor(..._args: unknown[]) {
    throw new Error(MISSING)
  }
}

export default { GoogleAuth }
