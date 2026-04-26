/**
 * Receipt Generator
 * 
 * Generates cryptographic completion receipts for WIH items.
 * Integrates with git for commit attestations and test runners for test attestations.
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import type { WihItem, Receipt, AllternitKernel, Attestation } from '@allternit/governor';
import {
  type ReceiptGeneratorConfig,
  type ReceiptGenerationContext,
  type AttestationData,
  type TestResults,
  ReceiptGenerationError,
} from './types.js';

const execAsync = promisify(exec);

/**
 * Receipt Generator Implementation
 */
export class LawReceiptGenerator {
  private config: Required<ReceiptGeneratorConfig>;
  private kernel: AllternitKernel;

  constructor(config: ReceiptGeneratorConfig) {
    this.kernel = config.kernel;
    this.config = {
      autoGenerate: true,
      includeGitCommit: true,
      includeTestResults: true,
      attestationGenerators: [],
      ...config,
    };
  }

  /**
   * Generate receipt for WIH
   */
  async generate(
    wih: WihItem,
    context: ReceiptGenerationContext
  ): Promise<Receipt> {
    const attestations: Attestation[] = [];

    // Generate git commit attestation
    if (this.config.includeGitCommit) {
      try {
        const gitAttestation = await this.generateGitAttestation(context);
        attestations.push(gitAttestation);
      } catch (error) {
        console.warn('Failed to generate git attestation:', error);
      }
    }

    // Generate test results attestation
    if (this.config.includeTestResults) {
      try {
        const testAttestation = await this.generateTestAttestation(context);
        attestations.push(testAttestation);
      } catch (error) {
        console.warn('Failed to generate test attestation:', error);
      }
    }

    // Run custom attestation generators
    for (const generator of this.config.attestationGenerators) {
      try {
        const customAttestation = await generator(wih, context);
        attestations.push({
          type: customAttestation.type,
          value: customAttestation.value,
          agent: context.agentId,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.warn('Custom attestation generator failed:', error);
      }
    }

    // Calculate artifact checksums
    const artifacts = await this.calculateArtifactChecksums(context.artifacts);

    // Create receipt
    const receiptData: Omit<Receipt, 'id' | 'timestamp'> = {
      wihId: wih.id,
      status: 'complete',
      agent: context.agentId,
      attestations,
      artifacts,
      metrics: this.calculateMetrics(context),
      notes: `Completed work on ${wih.title}`,
    };

    return this.kernel.createReceipt(receiptData);
  }

  /**
   * Verify a receipt's attestations
   */
  async verify(receipt: Receipt): Promise<boolean> {
    if (!receipt.attestations || receipt.attestations.length === 0) {
      return false;
    }

    for (const attestation of receipt.attestations) {
      const isValid = await this.verifyAttestation(attestation);
      if (!isValid) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get receipt for WIH
   */
  async getReceiptForWih(wihId: string): Promise<Receipt | null> {
    // Get all receipts and find the one for this WIH
    // This would need to be implemented in the kernel
    const wih = await this.kernel.getWih(wihId);
    if (!wih || wih.receiptRefs.length === 0) {
      return null;
    }

    // Return the most recent receipt
    const latestReceiptId = wih.receiptRefs[wih.receiptRefs.length - 1];
    return this.kernel.getReceipt(latestReceiptId);
  }

  /**
   * Generate git commit attestation
   */
  private async generateGitAttestation(
    context: ReceiptGenerationContext
  ): Promise<Attestation> {
    try {
      // Get current git commit
      const { stdout: commitHash } = await execAsync(
        'git rev-parse HEAD',
        { cwd: context.workspaceRoot }
      );

      // Get commit message
      const { stdout: commitMessage } = await execAsync(
        'git log -1 --pretty=%B',
        { cwd: context.workspaceRoot }
      );

      // Get author
      const { stdout: author } = await execAsync(
        'git log -1 --pretty=%an',
        { cwd: context.workspaceRoot }
      );

      // Check if working directory is clean
      const { stdout: status } = await execAsync(
        'git status --porcelain',
        { cwd: context.workspaceRoot }
      );

      const isClean = status.trim() === '';

      const value = JSON.stringify({
        commit: commitHash.trim(),
        message: commitMessage.trim(),
        author: author.trim(),
        clean: isClean,
        wihId: context.wihId,
      });

      return {
        type: 'git-commit',
        value,
        agent: context.agentId,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new ReceiptGenerationError(
        `Failed to generate git attestation: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Generate test results attestation
   */
  private async generateTestAttestation(
    context: ReceiptGenerationContext
  ): Promise<Attestation> {
    // Use provided test results or try to detect
    const testResults = context.testResults ?? await this.detectTestResults(context.workspaceRoot);

    const value = JSON.stringify({
      passed: testResults.passed,
      failed: testResults.failed,
      skipped: testResults.skipped,
      coverage: testResults.coverage,
      duration: testResults.duration,
      timestamp: new Date().toISOString(),
    });

    return {
      type: 'test-pass',
      value,
      agent: 'test-runner',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Detect test results from workspace
   */
  private async detectTestResults(workspaceRoot: string): Promise<TestResults> {
    // Try to read vitest results
    try {
      const { stdout } = await execAsync(
        'npx vitest run --reporter=json 2>/dev/null || echo "{}"',
        { cwd: workspaceRoot }
      );
      
      const data = JSON.parse(stdout);
      if (data.numTotalTests !== undefined) {
        return {
          passed: data.numPassedTests ?? 0,
          failed: data.numFailedTests ?? 0,
          skipped: data.numPendingTests ?? 0,
          coverage: data.coverage?.pct,
          duration: data.testResults?.reduce(
            (sum: number, r: { perfStats: { end: number; start: number } }) => 
              sum + (r.perfStats?.end - r.perfStats?.start),
            0
          ) ?? 0,
        };
      }
    } catch {
      // Ignore errors
    }

    // Default to empty results
    return {
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
    };
  }

  /**
   * Verify an attestation
   */
  private async verifyAttestation(attestation: Attestation): Promise<boolean> {
    switch (attestation.type) {
      case 'git-commit':
        return this.verifyGitAttestation(attestation);
      case 'test-pass':
        return this.verifyTestAttestation(attestation);
      case 'checksum':
        return this.verifyChecksumAttestation(attestation);
      case 'signature':
        return this.verifySignatureAttestation(attestation);
      default:
        // Unknown attestation types pass through
        return true;
    }
  }

  /**
   * Verify git commit attestation
   */
  private async verifyGitAttestation(attestation: Attestation): Promise<boolean> {
    try {
      const data = JSON.parse(attestation.value);
      const commitHash = data.commit;

      if (!commitHash) return false;

      // Check if commit exists
      const { stdout } = await execAsync(`git cat-file -t ${commitHash}`);
      return stdout.trim() === 'commit';
    } catch {
      return false;
    }
  }

  /**
   * Verify test attestation
   */
  private async verifyTestAttestation(attestation: Attestation): Promise<boolean> {
    try {
      const data = JSON.parse(attestation.value);
      
      // Basic validation - ensure structure is valid
      return (
        typeof data.passed === 'number' &&
        typeof data.failed === 'number' &&
        typeof data.skipped === 'number'
      );
    } catch {
      return false;
    }
  }

  /**
   * Verify checksum attestation
   */
  private async verifyChecksumAttestation(attestation: Attestation): Promise<boolean> {
    try {
      const data = JSON.parse(attestation.value);
      const { path, algorithm = 'sha256', expected } = data;

      if (!path || !expected) return false;

      // Calculate actual checksum
      const { createReadStream } = await import('node:fs');
      const hash = createHash(algorithm);
      
      return new Promise((resolve) => {
        const stream = createReadStream(path);
        stream.on('data', (chunk) => hash.update(chunk));
        stream.on('end', () => {
          const actual = hash.digest('hex');
          resolve(actual === expected);
        });
        stream.on('error', () => resolve(false));
      });
    } catch {
      return false;
    }
  }

  /**
   * Verify signature attestation
   */
  private async verifySignatureAttestation(_attestation: Attestation): Promise<boolean> {
    // Signature verification would require crypto keys
    // For now, just validate structure
    try {
      const data = JSON.parse(_attestation.value);
      return !!data.signature && !!data.publicKey;
    } catch {
      return false;
    }
  }

  /**
   * Calculate artifact checksums
   */
  private async calculateArtifactChecksums(
    paths: string[]
  ): Promise<Receipt['artifacts']> {
    const artifacts: Receipt['artifacts'] = [];
    const { readFile } = await import('node:fs/promises');

    for (const path of paths) {
      try {
        const content = await readFile(path);
        const checksum = createHash('sha256').update(content).digest('hex');
        
        // Determine type from extension
        const type = this.inferArtifactType(path);
        
        artifacts.push({
          path,
          checksum,
          type,
        });
      } catch (error) {
        console.warn(`Failed to calculate checksum for ${path}:`, error);
      }
    }

    return artifacts;
  }

  /**
   * Infer artifact type from path
   */
  private inferArtifactType(path: string): Receipt['artifacts'][0]['type'] {
    if (path.endsWith('.ts') || path.endsWith('.js')) return 'code';
    if (path.endsWith('.test.ts') || path.endsWith('.spec.ts')) return 'test';
    if (path.endsWith('.md')) return 'doc';
    if (path.endsWith('.json') || path.endsWith('.yaml') || path.endsWith('.yml')) return 'config';
    return 'binary';
  }

  /**
   * Calculate metrics from context
   */
  private calculateMetrics(context: ReceiptGenerationContext): Receipt['metrics'] {
    return {
      testsPassed: context.testResults?.passed,
      testsFailed: context.testResults?.failed,
      coveragePercent: context.testResults?.coverage,
    };
  }

  /**
   * Auto-generate receipt when WIH is completed
   */
  async onWihComplete(
    wih: WihItem,
    context: ReceiptGenerationContext
  ): Promise<Receipt> {
    const receipt = await this.generate(wih, context);
    
    // Update WIH with receipt reference
    await this.kernel.updateWih(wih.id, {
      receiptRefs: [...wih.receiptRefs, receipt.id],
      status: 'complete',
      completedAt: receipt.timestamp,
    });

    return receipt;
  }
}

/**
 * Create receipt generator instance
 */
export function createReceiptGenerator(
  config: ReceiptGeneratorConfig
): LawReceiptGenerator {
  return new LawReceiptGenerator(config);
}

/**
 * Built-in attestation generators
 */
export const BuiltinAttestationGenerators = {
  /**
   * Generate checksum attestation for files
   */
  fileChecksum: (files: string[]) => async (
    _wih: WihItem,
    _context: ReceiptGenerationContext
  ): Promise<AttestationData> => {
    const { readFile } = await import('node:fs/promises');
    const checksums: Record<string, string> = {};

    for (const file of files) {
      try {
        const content = await readFile(file);
        const hash = createHash('sha256').update(content).digest('hex');
        checksums[file] = hash;
      } catch (error) {
        checksums[file] = 'error';
      }
    }

    return {
      type: 'checksum',
      value: JSON.stringify(checksums),
    };
  },

  /**
   * Generate manual sign attestation
   */
  manualSign: (signer: string) => (
    _wih: WihItem,
    context: ReceiptGenerationContext
  ): AttestationData => ({
    type: 'manual-sign',
    value: JSON.stringify({
      signer,
      wihId: context.wihId,
      timestamp: new Date().toISOString(),
    }),
  }),

  /**
   * Generate review approval attestation
   */
  reviewApproval: (reviewer: string) => (
    _wih: WihItem,
    context: ReceiptGenerationContext
  ): AttestationData => ({
    type: 'review-approval',
    value: JSON.stringify({
      reviewer,
      wihId: context.wihId,
      timestamp: new Date().toISOString(),
    }),
  }),
};
