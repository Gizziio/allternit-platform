/**
 * File System Types
 * Shared types for file system implementations
 */

export interface FileSystemAPI {
  readDir(path: string): Promise<FileEntry[]>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  mkdir(path: string): Promise<void>;
  deleteFile(path: string): Promise<void>;
  join(...paths: string[]): string;
  basename(path: string): string;
  dirname(path: string): string;
  exec(command: string): Promise<{ stdout: string; stderr: string }>;
  getHomeDir(): string;
  isReady?(): boolean;
}

export interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: Date;
}
