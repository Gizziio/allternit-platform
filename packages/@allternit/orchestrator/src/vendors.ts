// packages/@allternit/orchestrator/src/vendors.ts
// Launch matrix for known executor vendors (ADR-0044). Verify flags with --help
// before first use of a new vendor version — do not guess.

import type { AgentVendor, ExecutorMode } from './orchestrator.interface.js';

export interface VendorLaunch {
  binary: string;
  interactive: string;
  interactiveFlags: string[];
  /** null = vendor has no autonomous headless mode. */
  headless: ((prompt: string) => string) | null;
  headlessFlags: string[];
}

const shellQuote = (s: string): string => `'${s.replace(/'/g, `'\\''`)}'`;

const VENDORS: Record<string, VendorLaunch> = {
  kimi: {
    binary: 'kimi',
    interactive: 'kimi --yolo',
    interactiveFlags: ['--yolo'],
    // kimi -p refuses --yolo/--auto; interactive TUI is the only autonomous path.
    headless: null,
    headlessFlags: [],
  },
  codex: {
    binary: 'codex',
    interactive: 'codex --dangerously-bypass-approvals-and-sandbox',
    interactiveFlags: ['--dangerously-bypass-approvals-and-sandbox'],
    headless: (prompt) => `codex exec ${shellQuote(prompt)}`,
    headlessFlags: ['exec'],
  },
  claude: {
    binary: 'claude',
    interactive: 'claude --dangerously-skip-permissions',
    interactiveFlags: ['--dangerously-skip-permissions'],
    headless: (prompt) => `claude -p ${shellQuote(prompt)} --dangerously-skip-permissions`,
    headlessFlags: ['-p', '--dangerously-skip-permissions'],
  },
  agy: {
    binary: 'agy',
    interactive: 'agy --dangerously-skip-permissions',
    interactiveFlags: ['--dangerously-skip-permissions'],
    headless: null,
    headlessFlags: [],
  },
};

export function launchCommand(vendor: AgentVendor, mode: ExecutorMode, headlessPrompt?: string): string {
  const v = VENDORS[vendor];
  if (!v) throw new Error(`unknown vendor '${vendor}' — pass an explicit launchCommand in the SessionSpec`);
  if (mode === 'interactive') return v.interactive;
  if (!v.headless) throw new Error(`vendor '${vendor}' has no autonomous headless mode — use interactive`);
  if (!headlessPrompt) throw new Error(`headless mode requires a prompt`);
  return v.headless(headlessPrompt);
}

export function knownVendors(): AgentVendor[] {
  return Object.keys(VENDORS);
}

export function vendorDefinition(vendor: AgentVendor): VendorLaunch | undefined {
  return VENDORS[vendor];
}
