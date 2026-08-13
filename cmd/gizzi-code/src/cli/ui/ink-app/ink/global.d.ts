/**
 * Global type declarations for ink components.
 *
 * Ink's custom host elements (`ink-box` / `ink-text`) are rendered by the
 * reconciler, not the DOM, so TypeScript needs them registered on the JSX
 * IntrinsicElements map — upstream ink does this in its dom module; this
 * fork keeps it here. Without these declarations every component returning
 * a host element fails typecheck with "Property 'ink-box'/'ink-text' does
 * not exist on type 'JSX.IntrinsicElements'".
 */

import type { Styles } from "../../ink-renderer/styles.js"

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      // Host elements receive arbitrary props (styles, events, tabIndex,
      // style) that the reconciler consumes — statically typed as an open
      // bag keyed on Partial<Styles>, same tolerance as upstream ink.
      "ink-box": Partial<Styles> & { [prop: string]: unknown }
      "ink-text": Partial<Styles> & { [prop: string]: unknown }
    }
  }
}

declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "ink-box": Partial<Styles> & { [prop: string]: unknown }
      "ink-text": Partial<Styles> & { [prop: string]: unknown }
    }
  }
}

export {}
