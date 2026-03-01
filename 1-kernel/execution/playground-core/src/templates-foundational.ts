/**
 * Foundational Playground Templates
 *
 * Pre-built template implementations for common playground use cases.
 */

import type { PlaygroundTemplateType, ContextBundle, PlaygroundOutputs, FilePatch } from './types';

// ============================================================================
// Template 1: Diff Review Playground
// ============================================================================

export interface DiffReviewConfig {
  showContext: boolean;
  contextLines: number;
  enableComments: boolean;
  requireApproval: boolean;
}

export function createDiffReviewTemplate(
  diffs: Array<{ path: string; diff: string; oldContent?: string; newContent: string }>,
  config?: DiffReviewConfig
) {
  const template: PlaygroundTemplateType = 'diff-review';
  
  const inputs: ContextBundle = {
    diffs: diffs.map((d, i) => ({
      oldPath: d.path,
      newPath: d.path,
      oldContent: d.oldContent,
      newContent: d.newContent,
      hunks: parseDiffHunks(d.diff),
    })),
  };

  const generateOutput = (approvals: string[]): PlaygroundOutputs => {
    const acceptedPatches: FilePatch[] = [];
    
    for (const diff of diffs) {
      const patchId = `patch-${diff.path}`;
      if (approvals.includes(patchId)) {
        acceptedPatches.push({
          path: diff.path,
          oldContent: diff.oldContent,
          newContent: diff.newContent,
          diff: diff.diff,
        });
      }
    }

    return {
      patch: {
        patches: acceptedPatches,
        metadata: {
          generatedAt: new Date().toISOString(),
          inputHash: generateHash(JSON.stringify(inputs)),
          deterministic: true,
        },
      },
      receipts: [{
        id: `receipt-${Date.now()}`,
        playgroundId: '',
        eventType: 'APPROVAL_GIVEN',
        timestamp: new Date().toISOString(),
        data: { approvals },
      }],
    };
  };

  return { template, inputs, config, generateOutput };
}

function parseDiffHunks(diff: string): Array<{ oldStart: number; oldLines: number; newStart: number; newLines: number; lines: string[] }> {
  // Simple diff parser - in production would use a proper diff library
  const hunks = [];
  const lines = diff.split('\n');
  let currentHunk: any = null;

  for (const line of lines) {
    if (line.startsWith('@@')) {
      const match = line.match(/@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/);
      if (match) {
        if (currentHunk) hunks.push(currentHunk);
        currentHunk = {
          oldStart: parseInt(match[1]),
          oldLines: parseInt(match[2]) || 1,
          newStart: parseInt(match[3]),
          newLines: parseInt(match[4]) || 1,
          lines: [],
        };
      }
    } else if (currentHunk) {
      currentHunk.lines.push(line);
    }
  }

  if (currentHunk) hunks.push(currentHunk);
  return hunks;
}

// ============================================================================
// Template 2: Codebase Architecture Playground
// ============================================================================

export interface ArchitectureConfig {
  showDependencies: boolean;
  showBoundaries: boolean;
  enableRefactorSuggestions: boolean;
}

export interface ArchitectureNode {
  id: string;
  name: string;
  type: 'module' | 'package' | 'service' | 'library';
  dependencies: string[];
  metrics: {
    linesOfCode: number;
    testCoverage: number;
    complexity: number;
  };
}

export function createArchitectureTemplate(
  nodes: ArchitectureNode[],
  config?: ArchitectureConfig
) {
  const template: PlaygroundTemplateType = 'codebase-architecture';
  
  const inputs: ContextBundle = {
    graphs: {
      nodes: nodes.map(n => ({
        id: n.id,
        label: n.name,
        type: n.type,
        metadata: n.metrics,
      })),
      edges: nodes.flatMap(n => 
        n.dependencies.map(dep => ({
          source: n.id,
          target: dep,
          label: 'depends_on',
          type: 'dependency',
        }))
      ),
    },
  };

  const generateOutput = (refactorTargets: string[]): PlaygroundOutputs => {
    const roadmap = refactorTargets.map(target => ({
      target,
      priority: 'high',
      actions: [
        'Extract interfaces',
        'Reduce coupling',
        'Add integration tests',
      ],
    }));

    return {
      prompt: {
        text: `Refactor the following modules to reduce coupling and improve maintainability:\n\n${refactorTargets.join('\n')}\n\nRecommended actions:\n${roadmap.map(r => `- ${r.target}: ${r.actions.join(', ')}`).join('\n')}`,
        metadata: {
          templateType: template,
          generatedAt: new Date().toISOString(),
          inputHash: generateHash(JSON.stringify(inputs)),
        },
      },
    };
  };

  return { template, inputs, config, generateOutput };
}

// ============================================================================
// Utilities
// ============================================================================

function generateHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// ============================================================================
// Template Registry
// ============================================================================

export const foundationalTemplates = {
  diffReview: createDiffReviewTemplate,
  architecture: createArchitectureTemplate,
};
