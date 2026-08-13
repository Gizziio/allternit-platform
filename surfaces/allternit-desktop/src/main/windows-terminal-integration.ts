/**
 * Allternit Desktop — Windows Terminal Integration
 *
 * Registers an Allternit profile in Windows Terminal and adds an
 * "Open Allternit Terminal Here" entry to the Windows Explorer context menu.
 */

import { app } from 'electron';
import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import log from 'electron-log';

const PROFILE_GUID = '{A11TERN17-DE5K-70P0-1N7E-GRATION00001}';
const PROFILE_NAME = 'Allternit Terminal';
const CONTEXT_MENU_KEY = 'Directory\\Background\\shell\\AllternitTerminal';

interface WtProfile {
  guid?: string;
  [key: string]: unknown;
}

interface WtSettings {
  profiles?: { list?: WtProfile[] };
  schemes?: Array<Record<string, unknown>>;
}

/**
 * Detect whether Windows Terminal (wt.exe) is installed.
 * Checks the standard install location and the PATH.
 */
export function detectWindowsTerminal(): boolean {
  if (process.platform !== 'win32') return false;

  const knownPaths = [
    path.join(process.env.LOCALAPPDATA ?? '', 'Microsoft', 'WindowsApps', 'wt.exe'),
    'C:\\Program Files\\WindowsTerminal\\wt.exe',
    'C:\\Program Files (x86)\\WindowsTerminal\\wt.exe',
  ];

  for (const p of knownPaths) {
    if (fs.existsSync(p)) {
      log.info(`[WindowsTerminal] Found at ${p}`);
      return true;
    }
  }

  // Fallback: try running wt.exe --version
  try {
    execFile('wt.exe', ['--version'], { timeout: 3000, windowsHide: true }, () => {});
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the command to launch Gizzi Code in a new terminal tab.
 */
export function getGizziTerminalCommand(workingDir?: string): string[] {
  const gizziPath = resolveGizziPath();
  const args = ['wt.exe'];

  if (workingDir) {
    args.push('-d', workingDir);
  }

  args.push('new-tab', '--profile', PROFILE_GUID, '--title', PROFILE_NAME);
  args.push(gizziPath);

  return args;
}

/**
 * Register the Allternit profile in the Windows Terminal settings.
 * This writes to the Windows Terminal settings.json file.
 */
export async function registerWindowsTerminalProfile(): Promise<boolean> {
  if (!detectWindowsTerminal()) {
    log.warn('[WindowsTerminal] Windows Terminal not found');
    return false;
  }

  const settingsPath = resolveWtSettingsPath();
  if (!settingsPath) {
    log.warn('[WindowsTerminal] Could not locate settings.json');
    return false;
  }

  try {
    const settings = readJsonFile(settingsPath) as WtSettings;
    const profiles = settings.profiles?.list ?? [];

    const existing = profiles.findIndex(
      (p: Record<string, unknown>) => p.guid === PROFILE_GUID,
    );

    const profileEntry = {
      guid: PROFILE_GUID,
      name: PROFILE_NAME,
      commandline: resolveGizziPath(),
      icon: resolveGizziIcon(),
      colorScheme: 'Allternit',
      fontFace: 'JetBrains Mono',
      fontSize: 12,
      cursorShape: 'filledBox',
      startingDirectory: '%USERPROFILE%',
    };

    if (existing >= 0) {
      profiles[existing] = { ...profiles[existing], ...profileEntry };
    } else {
      profiles.push(profileEntry);
    }

    if (!settings.profiles) settings.profiles = {};
    settings.profiles.list = profiles;

    // Add the Allternit color scheme if not present
    const schemes = settings.schemes ?? [];
    if (!schemes.find((s: Record<string, unknown>) => s.name === 'Allternit')) {
      schemes.push({
        name: 'Allternit',
        background: '#0B0B0C',
        foreground: '#E5E5E5',
        cursorColor: '#F59E0B',
        selectionBackground: '#F59E0B33',
        black: '#1A1A1B',
        red: '#EF4444',
        green: '#22C55E',
        yellow: '#F59E0B',
        blue: '#3B82F6',
        purple: '#8B5CF6',
        cyan: '#06B6D4',
        white: '#E5E5E5',
        brightBlack: '#52525B',
        brightRed: '#F87171',
        brightGreen: '#4ADE80',
        brightYellow: '#FBBF24',
        brightBlue: '#60A5FA',
        brightPurple: '#A78BFA',
        brightCyan: '#22D3EE',
        brightWhite: '#FAFAFA',
      });
      settings.schemes = schemes;
    }

    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 4), 'utf-8');
    log.info('[WindowsTerminal] Profile registered in settings.json');
    return true;
  } catch (error) {
    log.error('[WindowsTerminal] Failed to register profile:', error);
    return false;
  }
}

/**
 * Add "Open Allternit Terminal Here" to the Windows Explorer right-click menu.
 */
export async function registerContextMenu(): Promise<boolean> {
  if (process.platform !== 'win32') return false;

  const wtPath = 'wt.exe';
  const gizziCmd = resolveGizziPath();

  const regCommands = [
    // Menu entry
    `add "HKCU\\Software\\Classes\\${CONTEXT_MENU_KEY}" /ve /d "Open Allternit Terminal Here" /f`,
    `add "HKCU\\Software\\Classes\\${CONTEXT_MENU_KEY}" /v "Icon" /d "${gizziCmd}" /f`,
    // Command
    `add "HKCU\\Software\\Classes\\${CONTEXT_MENU_KEY}\\command" /ve /d "${wtPath} -d \\"%V\\" --profile ${PROFILE_GUID}" /f`,
  ];

  for (const args of regCommands) {
    try {
      await runReg(args);
    } catch (error) {
      log.warn('[WindowsTerminal] Context menu registration failed:', error);
      return false;
    }
  }

  log.info('[WindowsTerminal] Explorer context menu registered');
  return true;
}

/**
 * Remove the Explorer context menu entry.
 */
export async function unregisterContextMenu(): Promise<void> {
  if (process.platform !== 'win32') return;

  try {
    await runReg(`delete "HKCU\\Software\\Classes\\${CONTEXT_MENU_KEY}" /f`);
    log.info('[WindowsTerminal] Explorer context menu removed');
  } catch {
    log.warn('[WindowsTerminal] Could not remove context menu');
  }
}

// ── Internal helpers ────────────────────────────────────────────────────

function resolveGizziPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath ?? '', 'bin', 'gizzi.exe');
  }
  // Development: look for the gizzi-code binary in the repo
  return path.join(app.getAppPath(), '..', '..', '..', 'cmd', 'gizzi-code', 'target', 'release', 'gizzi.exe');
}

function resolveGizziIcon(): string {
  const candidates = [
    path.join(process.resourcesPath ?? '', 'build', 'icon.ico'),
    path.join(app.getAppPath(), 'build', 'icon.ico'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return '';
}

function resolveWtSettingsPath(): string | null {
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) return null;

  const candidates = [
    path.join(localAppData, 'Microsoft', 'Windows Terminal', 'settings.json'),
    path.join(localAppData, 'Packages', 'Microsoft.WindowsTerminal_8wekyb3d8bbwe', 'LocalState', 'settings.json'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return null;
}

function readJsonFile(filePath: string): Record<string, unknown> {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    // Windows Terminal settings may have trailing commas and comments —
    // strip comments before parsing
    const stripped = content.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    return JSON.parse(stripped) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function runReg(args: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile('reg', args.split(/\s+/), { windowsHide: true, timeout: 5000 }, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}
