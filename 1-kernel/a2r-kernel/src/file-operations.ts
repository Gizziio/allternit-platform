import fs from 'node:fs/promises';
import path from 'node:path';

export class FileOperations {
  private rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = path.resolve(rootDir);
  }

  private resolveSafePath(relativePath: string): string {
    const resolvedPath = path.resolve(this.rootDir, relativePath);
    if (!resolvedPath.startsWith(this.rootDir)) {
      throw new Error('Security Violation: Path escapes root directory');
    }
    return resolvedPath;
  }

  async readFile(relativePath: string): Promise<string> {
    const safePath = this.resolveSafePath(relativePath);
    return await fs.readFile(safePath, 'utf8');
  }

  async writeFile(relativePath: string, content: string): Promise<void> {
    const safePath = this.resolveSafePath(relativePath);
    const dir = path.dirname(safePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(safePath, content, 'utf8');
  }

  async deleteFile(relativePath: string): Promise<void> {
    const safePath = this.resolveSafePath(relativePath);
    await fs.unlink(safePath);
  }

  async listFiles(relativePath: string = '.'): Promise<string[]> {
    const safePath = this.resolveSafePath(relativePath);
    return await fs.readdir(safePath);
  }
}
