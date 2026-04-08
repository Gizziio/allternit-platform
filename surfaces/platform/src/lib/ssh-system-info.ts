import type { NodeSSH } from 'node-ssh';

export interface SSHSystemInfo {
  os: string;
  distro: string;
  version: string;
  architecture: string;
  dockerInstalled: boolean;
  allternitInstalled: boolean;
  allternitVersion?: string;
  hasSystemd: boolean;
}

type SSHExecResult = {
  stdout: string;
  stderr: string;
  code: number | null;
};

function stripLoaderNoise(value: string): string {
  return value
    .split(/\r?\n/)
    .filter((line) => !line.includes("ERROR: ld.so: object '/usr/local/lib/libprocesshider.so'"))
    .join('\n')
    .trim();
}

async function execCompat(ssh: NodeSSH, command: string): Promise<SSHExecResult> {
  const result = await ssh.execCommand(command, {
    execOptions: { pty: true },
  });

  return {
    ...result,
    stdout: stripLoaderNoise(result.stdout),
    stderr: stripLoaderNoise(result.stderr),
  };
}

function parseOsRelease(stdout: string): {
  os: string;
  distro: string;
  version: string;
} {
  const values: Record<string, string> = {};

  for (const rawLine of stdout.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || !line.includes('=')) continue;

    const separator = line.indexOf('=');
    const key = line.slice(0, separator);
    const value = line.slice(separator + 1).replace(/^"/, '').replace(/"$/, '');
    values[key] = value;
  }

  const distro = values.ID || 'unknown';
  const version = values.VERSION_ID || 'unknown';
  const os = values.PRETTY_NAME || `${distro} ${version}`.trim();

  return { os, distro, version };
}

export async function gatherSSHSystemInfo(ssh: NodeSSH): Promise<SSHSystemInfo> {
  const osResult = await execCompat(
    ssh,
    'cat /etc/os-release 2>/dev/null || echo "ID=unknown"',
  );
  const osInfo = parseOsRelease(osResult.stdout);

  const archResult = await execCompat(
    ssh,
    'uname -m 2>/dev/null || arch 2>/dev/null || echo "unknown"',
  );
  const architecture = archResult.stdout.trim() || 'unknown';

  const dockerResult = await execCompat(
    ssh,
    'command -v docker >/dev/null 2>&1 && echo "yes" || echo "no"',
  );
  const dockerInstalled = dockerResult.stdout.trim() === 'yes';

  const systemdResult = await execCompat(
    ssh,
    'command -v systemctl >/dev/null 2>&1 && echo "yes" || echo "no"',
  );
  const hasSystemd = systemdResult.stdout.trim() === 'yes';

  const allternitPathResult = await execCompat(
    ssh,
    '(\n' +
      'command -v gizzi-code 2>/dev/null || true;\n' +
      '[ -x /opt/a2r/bin/gizzi-code ] && echo /opt/a2r/bin/gizzi-code || true;\n' +
      'command -v a2r-node 2>/dev/null || true;\n' +
      '[ -x /opt/a2r/bin/a2r-node ] && echo /opt/a2r/bin/a2r-node || true\n' +
      ') | head -n 1',
  );
  const allternitPath = allternitPathResult.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  const allternitInstalled = Boolean(allternitPath);

  let allternitVersion: string | undefined;
  if (allternitPath) {
    const versionResult = await execCompat(
      ssh,
      `${allternitPath} --version 2>/dev/null || echo ""`,
    );
    allternitVersion = versionResult.stdout.trim() || undefined;
  }

  return {
    ...osInfo,
    architecture,
    dockerInstalled,
    allternitInstalled,
    allternitVersion,
    hasSystemd,
  };
}
