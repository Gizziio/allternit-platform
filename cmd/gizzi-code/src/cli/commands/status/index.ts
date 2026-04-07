/**
 * Status Command
 * Production-quality system status reporting
 */

import { log } from '../../utils/log.js'
import { getCurrentUser, isAuthenticated } from '../../utils/auth.js'
import { loadSession } from '../../../utils/sessionStorage.js'
import { getGlobalConfig } from '../../../utils/config.js'
import { execSync } from 'child_process'
import { readFile } from 'fs/promises'
import { join } from 'path'

export interface SystemStatus {
  version: string
  uptime: number
  memory: { used: number; total: number; percent: number }
  cpu: number
  platform: string
  nodeVersion: string
}

export interface ProjectStatus {
  name?: string
  initialized: boolean
  hasConfig: boolean
}

export interface AuthStatus {
  authenticated: boolean
  user?: { email?: string; type?: string }
  sessionAge?: number
}

/**
 * Get system resource usage
 */
function getSystemStatus(): SystemStatus {
  const memUsage = process.memoryUsage()
  const totalMem = require('os').totalmem()
  
  return {
    version: getGlobalConfig().version || '0.1.0',
    uptime: process.uptime(),
    memory: {
      used: Math.round(memUsage.heapUsed / 1024 / 1024),
      total: Math.round(totalMem / 1024 / 1024),
      percent: Math.round((memUsage.heapUsed / totalMem) * 100),
    },
    cpu: process.cpuUsage().user / 1000000, // Convert to seconds
    platform: `${process.platform} ${process.arch}`,
    nodeVersion: process.version,
  }
}

/**
 * Format duration for display
 */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${secs}s`
  return `${secs}s`
}

/**
 * Get project status
 */
async function getProjectStatus(): Promise<ProjectStatus> {
  try {
    const configPath = join(process.cwd(), '.gizzi', 'config.json')
    const data = await readFile(configPath, 'utf8')
    const config = JSON.parse(data)
    
    return {
      name: config.name,
      initialized: true,
      hasConfig: true,
    }
  } catch {
    return {
      initialized: false,
      hasConfig: false,
    }
  }
}

/**
 * Get authentication status
 */
async function getAuthStatus(): Promise<AuthStatus> {
  if (!(await isAuthenticated())) {
    return { authenticated: false }
  }
  
  const user = await getCurrentUser()
  const session = await loadSession()
  
  return {
    authenticated: true,
    user: {
      email: user?.email,
      type: user?.type,
    },
    sessionAge: session ? Date.now() - session.createdAt : undefined,
  }
}

/**
 * Get git status
 */
function getGitStatus(): { branch?: string; clean: boolean; ahead?: number; behind?: number } {
  try {
    const branch = execSync('git branch --show-current', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim()
    const status = execSync('git status --porcelain', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] })
    
    // Check ahead/behind
    let ahead = 0
    let behind = 0
    try {
      const revList = execSync('git rev-list --left-right --count HEAD...@{upstream}', { 
        encoding: 'utf8', 
        stdio: ['pipe', 'pipe', 'ignore'] 
      }).trim()
      const [b, a] = revList.split('\t').map(Number)
      behind = b || 0
      ahead = a || 0
    } catch {
      // No upstream
    }
    
    return {
      branch,
      clean: status.length === 0,
      ahead: ahead > 0 ? ahead : undefined,
      behind: behind > 0 ? behind : undefined,
    }
  } catch {
    return { clean: true }
  }
}

/**
 * Execute status command
 */
export default async function statusCommand(): Promise<void> {
  try {
    // System status
    const system = getSystemStatus()
    log('info', '=== System Status ===')
    log('info', `Version: ${system.version}`)
    log('info', `Uptime: ${formatDuration(system.uptime)}`)
    log('info', `Memory: ${system.memory.used}MB / ${system.memory.total}MB (${system.memory.percent}%)`)
    log('info', `Platform: ${system.platform}`)
    log('info', `Node: ${system.nodeVersion}`)
    
    // Auth status
    const auth = await getAuthStatus()
    log('info', '\n=== Authentication ===')
    if (auth.authenticated) {
      log('info', `User: ${auth.user?.email}`)
      log('info', `Type: ${auth.user?.type}`)
      if (auth.sessionAge) {
        log('info', `Session age: ${formatDuration(auth.sessionAge / 1000)}`)
      }
    } else {
      log('info', 'Not authenticated')
      log('info', 'Run `gizzi login` to authenticate')
    }
    
    // Project status
    const project = await getProjectStatus()
    log('info', '\n=== Project ===')
    if (project.initialized) {
      log('info', `Name: ${project.name || 'Unnamed'}`)
      log('info', `Initialized: Yes`)
    } else {
      log('info', 'Not initialized')
      log('info', 'Run `gizzi init` to initialize')
    }
    
    // Git status
    const git = getGitStatus()
    if (git.branch) {
      log('info', '\n=== Git ===')
      log('info', `Branch: ${git.branch}`)
      log('info', `Status: ${git.clean ? 'Clean' : 'Modified'}`)
      if (git.ahead) log('info', `Ahead: ${git.ahead} commits`)
      if (git.behind) log('info', `Behind: ${git.behind} commits`)
    }
    
  } catch (error) {
    if (error instanceof Error) {
      log('error', `Status command failed: ${error.message}`)
    } else {
      log('error', 'Status command failed with unknown error')
    }
  }
}

export { getSystemStatus, getProjectStatus, getAuthStatus, formatDuration }
