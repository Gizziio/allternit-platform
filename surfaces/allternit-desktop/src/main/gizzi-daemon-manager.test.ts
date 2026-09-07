import { describe, expect, it } from 'vitest';
import * as path from 'node:path';
import { WINDOWS_TASK_NAME, buildWindowsDaemonFiles } from './gizzi-daemon-manager.js';

describe('Windows gizzi daemon files', () => {
  const files = buildWindowsDaemonFiles({
    daemonDir: String.raw`C:\Users\eoj\AppData\Roaming\Allternit Desktop\gizzi-daemon`,
    sourceBinary: String.raw`C:\Program Files\Allternit Desktop\resources\bin\gizzi-code.exe`,
    port: 4096,
    password: 'p%ass',
    apiUrl: 'http://127.0.0.1:8013',
  });

  it('copies the daemon next to run.cmd as gizzi-code.exe', () => {
    expect(path.win32.basename(files.destBinary)).toBe('gizzi-code.exe');
    expect(files.destBinary.replace(/\//g, '\\')).toContain('gizzi-daemon\\gizzi-code.exe');
  });

  it('persists env without breaking cmd percent expansion', () => {
    expect(files.envCmd).toContain('set GIZZI_PORT=4096');
    expect(files.envCmd).toContain('set GIZZI_SERVER_PASSWORD=p%%ass');
    expect(files.envCmd).toContain('set ALLTERNIT_API_URL=http://127.0.0.1:8013');
  });

  it('starts the copied binary on loopback', () => {
    expect(files.runCmd).toContain('if exist env.cmd call env.cmd');
    expect(files.runCmd).toContain('gizzi-code.exe" serve --port %GIZZI_PORT% --hostname 127.0.0.1');
  });

  it('emits UTF-8 task XML for a user-level logon task', () => {
    expect(WINDOWS_TASK_NAME).toBe('AllternitGizzi');
    expect(files.taskXml).toContain('encoding="UTF-8"');
    expect(files.taskXml).toContain('<LogonTrigger>');
    expect(files.taskXml).toContain('<RunLevel>LeastPrivilege</RunLevel>');
    expect(files.taskXml).toContain('<Command>');
    expect(files.taskXml).toContain('run.cmd');
  });
});
