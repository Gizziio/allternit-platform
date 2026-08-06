declare module '*?worker' {
  const WorkerFactory: new () => Worker;
  export default WorkerFactory;
}

declare module '*?url' {
  const url: string;
  export default url;
}

declare module '*.png' {
  const url: string;
  export default url;
}

declare module '*.md?raw' {
  const content: string;
  export default content;
}

declare module 'harfbuzzjs/hb.js' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createHarfBuzz: any;
  export default createHarfBuzz;
}

declare module 'harfbuzzjs/hb.wasm?url' {
  const url: string;
  export default url;
}

// Original @blocksuite/icons/lit module, aliased through a vite virtual
// module (see the blocksuite-icons-lit shim and vite.config.ts).
declare module 'virtual:allternit-blocksuite-icons-lit-original' {
  export * from '@blocksuite/icons/lit'
}
