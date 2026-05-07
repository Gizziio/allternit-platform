/**
 * AutonomousCodeFactoryView
 *
 * UI for Autonomous Code Factory - Self-improving code generation.
 */

'use client';

import React from 'react';
import { GlassSurface } from '@/design/GlassSurface';
import {
  Factory,
  Shield,
  FileText as FileCheck,
  GitMerge,
} from '@phosphor-icons/react';

export function AutonomousCodeFactoryView() {
  return (
    <GlassSurface className="h-full w-full flex flex-col">
      <div className="p-4 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-3">
          <Factory className="w-6 h-6 text-[var(--accent-primary)]" />
          <div>
            <h2 className="text-lg font-semibold">Autonomous Code Factory</h2>
            <p className="text-sm text-[var(--text-tertiary)]">
              Self-improving code generation
            </p>
          </div>
        </div>
      </div>
      <div className="flex-1 grid grid-cols-2 gap-4 p-4">
        <div className="p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
          <Shield className="w-6 h-6 mb-2 text-[var(--accent-primary)]" />
          <h3 className="font-medium mb-1">RiskPolicy</h3>
          <p className="text-xs text-[var(--text-tertiary)]">Risk tier classification</p>
        </div>
        <div className="p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
          <FileCheck className="w-6 h-6 mb-2 text-[var(--accent-primary)]" />
          <h3 className="font-medium mb-1">Evidence Validation</h3>
          <p className="text-xs text-[var(--text-tertiary)]">SHA-bound artifacts</p>
        </div>
        <div className="p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
          <GitMerge className="w-6 h-6 mb-2 text-[var(--accent-primary)]" />
          <h3 className="font-medium mb-1">Merge Governance</h3>
          <p className="text-xs text-[var(--text-tertiary)]">Risk-tiered auto-merge</p>
        </div>
        <div className="p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
          <Factory className="w-6 h-6 mb-2 text-[var(--accent-primary)]" />
          <h3 className="font-medium mb-1">Remediation Loop</h3>
          <p className="text-xs text-[var(--text-tertiary)]">Deterministic patch application</p>
        </div>
      </div>
    </GlassSurface>
  );
}

export default AutonomousCodeFactoryView;
