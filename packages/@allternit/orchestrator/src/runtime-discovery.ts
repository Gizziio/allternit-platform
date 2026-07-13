import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { AgentVendor, ExecutorMode } from './orchestrator.interface.js';
import { knownVendors, launchCommand, vendorDefinition } from './vendors.js';

const run = promisify(execFile);

export interface VendorProbe {
  vendor: AgentVendor;
  binary: string;
  installed: boolean;
  version?: string;
  interactiveSupported: boolean;
  headlessSupported: boolean;
  missingInteractiveFlags: string[];
  missingHeadlessFlags: string[];
  error?: string;
}

export interface OrchestratorDoctorReport {
  ok: boolean;
  checkedAt: string;
  vendors: VendorProbe[];
}

export interface VendorSelection {
  vendor: AgentVendor;
  mode: ExecutorMode;
  launchCommand: string;
  probe: VendorProbe;
}

function firstLine(value: string): string | undefined {
  return value.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
}

async function readVersion(binary: string): Promise<string | undefined> {
  try {
    const result = await run(binary, ['--version'], { timeout: 5_000 });
    return firstLine(`${result.stdout}\n${result.stderr}`);
  } catch {
    return undefined;
  }
}

export async function probeVendor(vendor: AgentVendor): Promise<VendorProbe> {
  const definition = vendorDefinition(vendor);
  if (!definition) {
    return {
      vendor,
      binary: String(vendor),
      installed: false,
      interactiveSupported: false,
      headlessSupported: false,
      missingInteractiveFlags: [],
      missingHeadlessFlags: [],
      error: 'Unknown vendor; provide an explicit launch command.',
    };
  }

  try {
    const result = await run(definition.binary, ['--help'], { timeout: 5_000, maxBuffer: 2 * 1024 * 1024 });
    const help = `${result.stdout}\n${result.stderr}`;
    const missingInteractiveFlags = definition.interactiveFlags.filter((flag) => !help.includes(flag));
    const missingHeadlessFlags = definition.headlessFlags.filter((flag) => !help.includes(flag));
    return {
      vendor,
      binary: definition.binary,
      installed: true,
      version: await readVersion(definition.binary),
      interactiveSupported: missingInteractiveFlags.length === 0,
      headlessSupported: definition.headless !== null && missingHeadlessFlags.length === 0,
      missingInteractiveFlags,
      missingHeadlessFlags,
    };
  } catch (cause) {
    const error = cause as NodeJS.ErrnoException;
    return {
      vendor,
      binary: definition.binary,
      installed: false,
      interactiveSupported: false,
      headlessSupported: false,
      missingInteractiveFlags: definition.interactiveFlags,
      missingHeadlessFlags: definition.headlessFlags,
      error: error.code === 'ENOENT' ? 'CLI not installed or not on PATH.' : error.message,
    };
  }
}

export async function doctor(vendors: AgentVendor[] = knownVendors()): Promise<OrchestratorDoctorReport> {
  const probes = await Promise.all(vendors.map(probeVendor));
  return {
    ok: probes.some((probe) => probe.interactiveSupported || probe.headlessSupported),
    checkedAt: new Date().toISOString(),
    vendors: probes,
  };
}

function sanitizeLine(value: string): string {
  return value.replace(/\r\n|\r|\n/g, ' ');
}

export function formatDoctorReport(report: OrchestratorDoctorReport): string {
  const lines: string[] = [];
  lines.push(report.ok ? 'Orchestrator doctor: OK' : 'Orchestrator doctor: NO USABLE EXECUTORS');
  lines.push(`Checked: ${report.checkedAt}`);

  for (const probe of report.vendors) {
    const parts: string[] = [];
    parts.push(`${probe.vendor} (${probe.binary}):`);
    parts.push(probe.installed ? 'installed' : 'not installed');
    parts.push(probe.interactiveSupported ? 'interactive=yes' : 'interactive=no');
    parts.push(probe.headlessSupported ? 'headless=yes' : 'headless=no');
    if (probe.version) {
      parts.push(`version=${sanitizeLine(probe.version)}`);
    }
    if (probe.missingInteractiveFlags.length > 0) {
      parts.push(`missing interactive flags: ${sanitizeLine(probe.missingInteractiveFlags.join(', '))}`);
    }
    if (probe.missingHeadlessFlags.length > 0) {
      parts.push(`missing headless flags: ${sanitizeLine(probe.missingHeadlessFlags.join(', '))}`);
    }
    if (probe.error) {
      parts.push(`error: ${sanitizeLine(probe.error)}`);
    }
    lines.push(parts.join(' '));
  }

  return lines.join('\n') + '\n';
}

export async function selectVendor(
  preferences: AgentVendor[],
  mode: ExecutorMode,
  headlessPrompt?: string,
): Promise<VendorSelection> {
  if (preferences.length === 0) throw new Error('At least one vendor preference is required.');
  const failures: string[] = [];
  for (const vendor of preferences) {
    const probe = await probeVendor(vendor);
    const supported = mode === 'interactive' ? probe.interactiveSupported : probe.headlessSupported;
    if (probe.installed && supported) {
      return { vendor, mode, launchCommand: launchCommand(vendor, mode, headlessPrompt), probe };
    }
    failures.push(`${vendor}: ${probe.error ?? (mode === 'interactive' ? `missing ${probe.missingInteractiveFlags.join(', ')}` : `missing ${probe.missingHeadlessFlags.join(', ') || 'headless mode'}`)}`);
  }
  throw new Error(`No usable ${mode} executor found. ${failures.join('; ')}`);
}

