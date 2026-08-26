declare module '*.md?raw' {
  const content: string;
  export default content;
}

declare module '*.txt?raw' {
  const content: string;
  export default content;
}

declare module '*.json' {
  const value: unknown;
  export default value;
}

declare module '*.png' {
  const url: string;
  export default url;
}

declare module '*.png?url' {
  const url: string;
  export default url;
}

declare module '*.wasm?url' {
  const url: string;
  export default url;
}

declare module '*.mjs?url' {
  const url: string;
  export default url;
}

declare module 'harfbuzzjs/hb.js' {
  const createHb: () => Promise<unknown>;
  export default createHb;
}
