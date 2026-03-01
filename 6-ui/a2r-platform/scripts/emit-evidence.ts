#!/usr/bin/env tsx
/**
 * Storybook Evidence Emission Script
 * 
 * Emits test evidence to WIH for DAG harness validation
 */

import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

interface EvidenceArtifact {
  type: 'STORYBOOK_BUILD' | 'INTERACTION_TEST' | 'A11Y_SCAN' | 'VISUAL_REGRESSION';
  status: 'PASS' | 'FAIL';
  timestamp: string;
  artifacts: string[];
  metadata: {
    storyCount: number;
    testCount: number;
    coverage?: number;
  };
}

async function emitEvidence(): Promise<void> {
  console.log('📊 Storybook Evidence Emission');
  console.log('==============================\n');

  const evidence: EvidenceArtifact = {
    type: 'STORYBOOK_BUILD',
    status: 'PASS',
    timestamp: new Date().toISOString(),
    artifacts: [],
    metadata: {
      storyCount: 0,
      testCount: 0,
    },
  };

  try {
    // 1. Build Storybook
    console.log('1️⃣ Building Storybook...');
    execSync('npm run build:storybook', { stdio: 'inherit' });
    evidence.artifacts.push('storybook-static/');

    // 2. Run interaction tests
    console.log('\n2️⃣ Running interaction tests...');
    try {
      execSync('npm run test:storybook', { stdio: 'inherit' });
      evidence.metadata.testCount += 1;
    } catch (e) {
      evidence.status = 'FAIL';
      console.error('❌ Interaction tests failed');
    }

    // 3. Run a11y tests
    console.log('\n3️⃣ Running accessibility tests...');
    try {
      execSync('npm run test:a11y', { stdio: 'inherit' });
      evidence.metadata.testCount += 1;
    } catch (e) {
      evidence.status = 'FAIL';
      console.error('❌ A11y tests failed');
    }

    // 4. Count stories
    const storiesDir = path.join(process.cwd(), 'src');
    const storyFiles = await findStoryFiles(storiesDir);
    evidence.metadata.storyCount = storyFiles.length;

    // 5. Emit to WIH
    console.log('\n4️⃣ Emitting evidence to WIH...');
    const wihDir = path.join(process.cwd(), '..', '..', '.a2r', 'wih');
    await fs.mkdir(wihDir, { recursive: true });
    
    const evidenceFile = path.join(
      wihDir,
      `storybook-evidence-${Date.now()}.json`
    );
    
    await fs.writeFile(
      evidenceFile,
      JSON.stringify(evidence, null, 2)
    );

    console.log(`\n✅ Evidence emitted: ${evidenceFile}`);
    console.log(`\n📈 Summary:`);
    console.log(`   Status: ${evidence.status}`);
    console.log(`   Stories: ${evidence.metadata.storyCount}`);
    console.log(`   Tests: ${evidence.metadata.testCount}`);

    // Hard fail if any tests failed
    if (evidence.status === 'FAIL') {
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Evidence emission failed:', error);
    process.exit(1);
  }
}

async function findStoryFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  
  async function scan(currentDir: string) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory() && entry.name !== 'node_modules') {
        await scan(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.stories.tsx')) {
        files.push(fullPath);
      }
    }
  }
  
  await scan(dir);
  return files;
}

// Run if called directly
if (require.main === module) {
  emitEvidence();
}

export { emitEvidence };
