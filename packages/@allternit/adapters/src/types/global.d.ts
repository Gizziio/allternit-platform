declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}

declare module '*.css' {
  const css: string;
  export default css;
}

declare module '@allternit/executor-core' {
  export interface ExecutorInterface {
    execute(input: unknown): Promise<unknown>;
  }
  export const createExecutor: (config?: unknown) => ExecutorInterface;
}
