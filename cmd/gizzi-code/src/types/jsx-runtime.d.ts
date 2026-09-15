// Augment React 19 JSX intrinsic elements for ink host elements.
// Upstream @types/react does not know about ink's reconciler host
// elements (`ink-box`, `ink-text`), so we add them here.

export {}

declare module 'react/jsx-runtime' {
  export namespace JSX {
    interface IntrinsicElements {
      'ink-box': any
      'ink-text': any
      [elemName: string]: any
    }
  }
}
