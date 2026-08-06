/**
 * pngjs stub for the browser build. Node's pngjs pulls node:assert/stream
 * externals that crash Vite's externalized shims. TIFF media in decks is
 * rare; if a deck actually contains one, decoding reports unavailable
 * instead of crashing the whole editor.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

export class PNG {
  data: Uint8Array = new Uint8Array()
  constructor(..._args: any[]) {}
  static sync = {
    write(_png: unknown): Uint8Array {
      throw new Error('PNG re-encode is not available in the browser build')
    },
    read(_input: unknown): PNG {
      throw new Error('PNG decode is not available in the browser build')
    },
  }
}
