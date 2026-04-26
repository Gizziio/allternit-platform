declare module 'xterm-addon-web-links' {
  import type { Terminal, ITerminalAddon } from 'xterm';
  export class WebLinksAddon implements ITerminalAddon {
    constructor(handler?: (event: MouseEvent, uri: string) => void, options?: object);
    activate(terminal: Terminal): void;
    dispose(): void;
  }
}

declare module 'xterm-addon-search' {
  import type { Terminal, ITerminalAddon } from 'xterm';
  export class SearchAddon implements ITerminalAddon {
    activate(terminal: Terminal): void;
    dispose(): void;
    findNext(term: string, options?: object): boolean;
    findPrevious(term: string, options?: object): boolean;
    clearDecorations(): void;
  }
}

declare module 'xterm/css/xterm.css' {
  const styles: string;
  export default styles;
}
