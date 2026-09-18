// Ambient module declarations for asset imports (no imports/exports here —
// this file must stay a global script so these apply everywhere).
declare module '*.md?raw' {
  const content: string
  export default content
}

declare module '*.png' {
  const url: string
  export default url
}
