/// <reference types="node" />

declare module 'better-sqlite3' {
  interface Database {
    pragma(sqlite: string): void;
    exec(sql: string): void;
    prepare(sql: string): {
      run(...params: any[]): { changes: number };
      get(...params: any[]): any;
      all(...params: any[]): any[];
    };
    close(): void;
  }
  
  interface DatabaseConstructor {
    new (filename: string): Database;
    (filename: string): Database;
    prototype: Database;
  }
  
  const Database: DatabaseConstructor;
  export default Database;
}

declare module 'chokidar' {
  import { EventEmitter } from 'events';
  
  interface FSWatcher extends EventEmitter {
    close(): Promise<void>;
    on(event: 'add', listener: (path: string) => void): this;
    on(event: 'change', listener: (path: string) => void): this;
    on(event: 'unlink', listener: (path: string) => void): this;
    on(event: string, listener: (...args: any[]) => void): this;
  }
  
  interface WatchOptions {
    ignored?: RegExp | string | Array<string>;
    persistent?: boolean;
    ignoreInitial?: boolean;
    awaitWriteFinish?: {
      stabilityThreshold?: number;
      pollInterval?: number;
    };
  }
  
  function watch(paths: string | Array<string>, options?: WatchOptions): FSWatcher;
  
  export default watch;
}

declare module 'uuid' {
  export function v4(): string;
}

declare module 'ollama' {
  export interface OllamaConfig {
    host?: string;
  }
  
  export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
  }
  
  export interface ChatRequest {
    model: string;
    messages: ChatMessage[];
    options?: {
      temperature?: number;
      top_p?: number;
      num_predict?: number;
    };
    stream?: boolean;
  }
  
  export interface ChatResponse {
    message: {
      content: string;
    };
  }
  
  export interface ModelInfo {
    name: string;
  }
  
  export interface ListResponse {
    models: ModelInfo[];
  }
  
  export class Ollama {
    constructor(config?: OllamaConfig);
    chat(request: ChatRequest): Promise<ChatResponse>;
    list(): Promise<ListResponse>;
    pull(options: { model: string }): Promise<void>;
  }
}
