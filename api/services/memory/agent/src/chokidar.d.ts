declare module 'chokidar' {
  export interface WatchOptions {
    persistent?: boolean;
    ignored?: any;
    ignoreInitial?: boolean;
    followSymlinks?: boolean;
    cwd?: string;
    usePolling?: boolean;
    interval?: number;
    binaryInterval?: number;
    alwaysStat?: boolean;
    depth?: number;
    awaitWriteFinish?: boolean | { stabilityThreshold?: number; pollInterval?: number };
    ignorePermissionErrors?: boolean;
    atomic?: boolean | number;
    [key: string]: any;
  }
  export interface FSWatcher {
    on(event: string, listener: (...args: any[]) => void): this;
    add(paths: string | string[]): this;
    unwatch(paths: string | string[]): this;
    close(): Promise<void>;
  }
  export function watch(paths: string | string[], options?: WatchOptions): FSWatcher;
  const chokidar: { watch: typeof watch };
  export default chokidar;
}
