declare module 'bun:sqlite' {
  export class Database {
    constructor(path: string);
    run(sql: string, ...args: unknown[]): void;
    prepare(sql: string): {
      run(...args: unknown[]): void;
      get(...args: unknown[]): unknown;
      all(...args: unknown[]): unknown[];
    };
  }
}
