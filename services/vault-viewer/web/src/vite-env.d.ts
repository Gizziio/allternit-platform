/// <reference types="vite/client" />

// PixiJS ships the unsafe-eval plugin without a `types` export condition, so TS
// cannot resolve declarations for the subpath. It's a side-effect-only module.
declare module 'pixi.js/unsafe-eval';
