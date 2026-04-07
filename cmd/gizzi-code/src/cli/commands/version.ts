/**
 * Version Command
 * Display version information and system details
 */

import { log } from '../utils/log.js'
import { readFileSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'
import { platform, arch, release, totalmem, freemem, cpus } from 'os'

export interface VersionInfo {
  cli: string
  runtime: string
  commit?: string
  built?: string
  dependencies: Record<string, string>
}

export interface SystemInfo {
  platform: string
  arch: string
  osVersion: string
  nodeVersion: string
  bunVersion?: string
  cpuCount: number
  totalMemory: string
  freeMemory: string
}

/**
 * Get CLI version from package.json
 */
export function getVersion(): string {
  try {
    const packagePath = join(process.cwd(), 'package.json')
    const pkg = JSON.parse(readFileSync(packagePath, 'utf-8'))
    return pkg.version || '0.1.0'
  } catch {
    // Try to get from parent directory
    try {
      const packagePath = join(process.cwd(), '..', 'package.json')
      const pkg = JSON.parse(readFileSync(packagePath, 'utf-8'))
      return pkg.version || '0.1.0'
    } catch {
      return '0.1.0'
    }
  }
}

/**
 * Get detailed version info
 */
export function getDetailedVersion(): VersionInfo {
  const info: VersionInfo = {
    cli: getVersion(),
    runtime: process.version,
    dependencies: {},
  }
  
  // Try to get git commit
  try {
    info.commit = execSync('git rev-parse --short HEAD', { 
      encoding: 'utf-8',
      cwd: process.cwd(),
    }).trim()
  } catch {
    // Not a git repo or git not available
  }
  
  // Try to get build date from package.json
  try {
    const packagePath = join(process.cwd(), 'package.json')
    const pkg = JSON.parse(readFileSync(packagePath, 'utf-8'))
    if (pkg.built) {
      info.built = pkg.built
    }
  } catch {
    // Ignore
  }
  
  // Get key dependencies
  try {
    const packagePath = join(process.cwd(), 'package.json')
    const pkg = JSON.parse(readFileSync(packagePath, 'utf-8'))
    if (pkg.dependencies) {
      info.dependencies = {
        react: pkg.dependencies.react || 'not installed',
        '@anthropic-ai/sdk': pkg.dependencies['@anthropic-ai/sdk'] || 'not installed',
        ink: pkg.dependencies.ink || 'not installed',
      }
    }
  } catch {
    // Ignore
  }
  
  return info
}

/**
 * Get system information
 */
export function getSystemInfo(): SystemInfo {
  const totalMem = totalmem()
  const freeMem = freemem()
  
  // Format bytes to human readable
  const formatBytes = (bytes: number): string => {
    const gb = bytes / 1024 / 1024 / 1024
    return `${gb.toFixed(2)} GB`
  }
  
  // Try to get bun version
  let bunVersion: string | undefined
  try {
    bunVersion = execSync('bun --version', { encoding: 'utf-8' }).trim()
  } catch {
    // Bun not installed
  }
  
  return {
    platform: platform(),
    arch: arch(),
    osVersion: release(),
    nodeVersion: process.version,
    bunVersion,
    cpuCount: cpus().length,
    totalMemory: formatBytes(totalMem),
    freeMemory: formatBytes(freeMem),
  }
}

/**
 * Format version output
 */
export function formatVersion(info: VersionInfo, sysInfo: SystemInfo, detailed = false): string {
  const lines: string[] = []
  
  lines.push(`Gizzi Code v${info.cli}`)
  lines.push('')
  
  if (detailed) {
    lines.push('Version Information:')
    lines.push(`  CLI Version: ${info.cli}`)
    lines.push(`  Node.js: ${info.runtime}`)
    if (info.commit) {
      lines.push(`  Git Commit: ${info.commit}`)
    }
    if (info.built) {
      lines.push(`  Built: ${info.built}`)
    }
    lines.push('')
    
    lines.push('System Information:')
    lines.push(`  Platform: ${sysInfo.platform} ${sysInfo.arch}`)
    lines.push(`  OS Version: ${sysInfo.osVersion}`)
    lines.push(`  CPUs: ${sysInfo.cpuCount}`)
    lines.push(`  Memory: ${sysInfo.freeMemory} free / ${sysInfo.totalMemory} total`)
    lines.push('')
    
    if (Object.keys(info.dependencies).length > 0) {
      lines.push('Key Dependencies:')
      for (const [name, version] of Object.entries(info.dependencies)) {
        lines.push(`  ${name}: ${version}`)
      }
      lines.push('')
    }
  } else {
    lines.push(`Node.js: ${info.runtime}`)
    if (sysInfo.bunVersion) {
      lines.push(`Bun: ${sysInfo.bunVersion}`)
    }
    lines.push(`Platform: ${sysInfo.platform} ${sysInfo.arch}`)
  }
  
  return lines.join('\n')
}

/**
 * Execute version command
 */
export default async function versionCommand(args: string[] = []): Promise<void> {
  const detailed = args.includes('--detailed') || args.includes('-d')
  const json = args.includes('--json') || args.includes('-j')
  
  const versionInfo = getDetailedVersion()
  const systemInfo = getSystemInfo()
  
  if (json) {
    console.log(JSON.stringify({
      version: versionInfo,
      system: systemInfo,
    }, null, 2))
  } else {
    console.log(formatVersion(versionInfo, systemInfo, detailed))
  }
}

export { getDetailedVersion, getSystemInfo, formatVersion }
