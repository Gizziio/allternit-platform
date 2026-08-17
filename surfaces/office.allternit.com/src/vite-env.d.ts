/// <reference types="vite/client" />

/** Low-level harfbuzzjs Emscripten factory used by the vendored slides renderer. */
declare module 'harfbuzzjs/hb.js' {
  function createHarfBuzz(moduleArg?: Record<string, unknown>): Promise<unknown>;
  export default createHarfBuzz;
}
