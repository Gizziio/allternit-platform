import fs from 'node:fs/promises';
import path from 'node:path';
import { A2RReceipt } from './policy-engine.js';

export class ReceiptSystem {
  private storageDir: string;

  constructor(storageDir: string) {
    this.storageDir = path.resolve(storageDir);
  }

  async saveReceipt(receipt: A2RReceipt): Promise<void> {
    await fs.mkdir(this.storageDir, { recursive: true });
    const filePath = path.join(this.storageDir, receipt.id + '.json');
    await fs.writeFile(filePath, JSON.stringify(receipt, null, 2), 'utf8');
  }

  async getAuditTrail(): Promise<A2RReceipt[]> {
    if (!(await this.exists(this.storageDir))) {
      return [];
    }
    const files = await fs.readdir(this.storageDir);
    const receipts: A2RReceipt[] = [];
    for (const file of files) {
      if (file.endsWith('.json')) {
        const content = await fs.readFile(path.join(this.storageDir, file), 'utf8');
        receipts.push(JSON.parse(content));
      }
    }
    return receipts.sort((a, b) => b.timestamp - a.timestamp);
  }

  private async exists(p: string): Promise<boolean> {
    try {
      await fs.access(p);
      return true;
    } catch {
      return false;
    }
  }
}
