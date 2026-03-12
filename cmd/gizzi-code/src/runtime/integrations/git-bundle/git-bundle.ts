/**
 * Git Bundle Support for Agents
 * 
 * Enables agents to push/fetch code via git bundles.
 * Similar to agenthub's git transport layer.
 * 
 * Features:
 * - Create git bundles
 * - Validate bundles
 * - Extract bundles to repo
 * - Bundle size limits
 * - Agent attribution
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import { createHash } from 'crypto'
import { promises as fs } from 'fs'
import path from 'path'
import { Log } from '@/shared/util/log'
import { Bus } from '@/shared/bus'
import { BusEvent } from '@/shared/bus/bus-event'
import { z } from 'zod/v4'
import { GitDAGTracker } from '@/runtime/integrations/git-dag/dag-tracker'

const execAsync = promisify(exec)

export namespace GitBundle {
  const log = Log.create({ service: 'git-bundle' })

  // ============================================================================
  // Types
  // ============================================================================

  export interface BundleInfo {
    id: string
    path: string
    hash: string
    size: number
    agentId: string
    agentName: string
    createdAt: number
    commits: string[]
    refs: string[]
    validated: boolean
    extracted: boolean
  }

  export interface BundleValidationResult {
    valid: boolean
    error?: string
    commits?: string[]
    refs?: string[]
    size?: number
  }

  export interface BundleConfig {
    maxBundleSizeMB: number
    allowedRefPatterns: string[]
    requireValidation: boolean
  }

  // ============================================================================
  // Events
  // ============================================================================

  export const BundleCreated = BusEvent.define(
    'git.bundle.created',
    z.object({
      bundleId: z.string(),
      agentId: z.string(),
      commitCount: z.number(),
      size: z.number(),
    }),
  )

  export const BundleValidated = BusEvent.define(
    'git.bundle.validated',
    z.object({
      bundleId: z.string(),
      agentId: z.string(),
      valid: z.boolean(),
      commitCount: z.number(),
    }),
  )

  export const BundleExtracted = BusEvent.define(
    'git.bundle.extracted',
    z.object({
      bundleId: z.string(),
      agentId: z.string(),
      repoPath: z.string(),
      commitsAdded: z.number(),
    }),
  )

  // ============================================================================
  // State
  // ============================================================================

  const bundles = new Map<string, BundleInfo>()
  const defaultConfig: BundleConfig = {
    maxBundleSizeMB: 50,
    allowedRefPatterns: ['refs/heads/*', 'refs/tags/*'],
    requireValidation: true,
  }

  // ============================================================================
  // Bundle Creation
  // ============================================================================

  /**
   * Create a git bundle from a repository
   */
  export async function createBundle(
    repoPath: string,
    refs: string[],
    agentId: string,
    agentName: string,
    outputPath?: string,
  ): Promise<BundleInfo> {
    const bundleId = `bundle_${Date.now()}_${agentId}`
    const tempDir = path.join(repoPath, '.git', 'bundles')

    // Create temp directory
    await fs.mkdir(tempDir, { recursive: true })

    // Generate output path
    const bundlePath = outputPath || path.join(tempDir, `${bundleId}.bundle`)

    log.info('Creating git bundle', {
      bundleId,
      repoPath,
      refs,
      agentId,
    })

    // Create bundle
    const refArgs = refs.map((ref) => ref.startsWith('^') ? ref : ref).join(' ')
    const { stdout, stderr } = await execAsync(
      `git -C "${repoPath}" bundle create "${bundlePath}" ${refArgs}`,
    )

    // Get bundle info
    const stats = await fs.stat(bundlePath)
    const sizeMB = stats.size / (1024 * 1024)

    // Validate size
    if (sizeMB > defaultConfig.maxBundleSizeMB) {
      throw new Error(
        `Bundle size (${sizeMB.toFixed(2)}MB) exceeds limit (${defaultConfig.maxBundleSizeMB}MB)`,
      )
    }

    // Get bundle hash
    const bundleContent = await fs.readFile(bundlePath)
    const hash = createHash('sha256').update(bundleContent).digest('hex')

    // Parse bundle to get commits and refs
    const { commits, refs: bundleRefs } = await parseBundle(bundlePath)

    // Create bundle info
    const bundle: BundleInfo = {
      id: bundleId,
      path: bundlePath,
      hash,
      size: stats.size,
      agentId,
      agentName,
      createdAt: Date.now(),
      commits,
      refs: bundleRefs,
      validated: false,
      extracted: false,
    }

    // Store bundle
    bundles.set(bundleId, bundle)

    log.info('Bundle created', {
      bundleId,
      size: sizeMB.toFixed(2),
      commitCount: commits.length,
    })

    // Publish event
    Bus.publish(BundleCreated, {
      bundleId,
      agentId,
      commitCount: commits.length,
      size: stats.size,
    })

    return bundle
  }

  /**
   * Parse a bundle file to extract metadata
   */
  async function parseBundle(bundlePath: string): Promise<{
    commits: string[]
    refs: string[]
  }> {
    const content = await fs.readFile(bundlePath, 'utf-8')
    const lines = content.split('\n')

    const commits: string[] = []
    const refs: string[] = []

    for (const line of lines) {
      // Parse refs (format: <hash> <refname>)
      const refMatch = line.match(/^([a-f0-9]{40})\s+(.+)$/)
      if (refMatch) {
        const hash = refMatch[1]
        const refname = refMatch[2]

        if (!refs.includes(refname)) {
          refs.push(refname)
        }

        if (!commits.includes(hash)) {
          commits.push(hash)
        }
      }

      // Stop at data section
      if (line.startsWith('PACK')) {
        break
      }
    }

    return { commits, refs }
  }

  // ============================================================================
  // Bundle Validation
  // ============================================================================

  /**
   * Validate a git bundle
   */
  export async function validateBundle(
    bundlePath: string,
    repoPath?: string,
  ): Promise<BundleValidationResult> {
    try {
      log.info('Validating bundle', { bundlePath, repoPath })

      // Check file exists
      await fs.access(bundlePath)

      // Get bundle stats
      const stats = await fs.stat(bundlePath)
      const sizeMB = stats.size / (1024 * 1024)

      // Validate size
      if (sizeMB > defaultConfig.maxBundleSizeMB) {
        return {
          valid: false,
          error: `Bundle too large: ${sizeMB.toFixed(2)}MB (max: ${defaultConfig.maxBundleSizeMB}MB)`,
        }
      }

      // Validate bundle integrity
      const { stdout } = await execAsync(
        `git bundle verify "${bundlePath}"${repoPath ? ` -C "${repoPath}"` : ''} 2>&1 || true`,
      )

      // Parse bundle to get commits and refs
      const { commits, refs } = await parseBundle(bundlePath)

      // Check for allowed ref patterns
      for (const ref of refs) {
        const allowed = defaultConfig.allowedRefPatterns.some((pattern) => {
          if (pattern.endsWith('*')) {
            return ref.startsWith(pattern.slice(0, -1))
          }
          return ref === pattern
        })

        if (!allowed) {
          return {
            valid: false,
            error: `Ref not allowed: ${ref}`,
          }
        }
      }

      log.info('Bundle validated', {
        bundlePath,
        commitCount: commits.length,
        refCount: refs.length,
      })

      return {
        valid: true,
        commits,
        refs,
        size: stats.size,
      }
    } catch (error: any) {
      log.error('Bundle validation failed', {
        bundlePath,
        error: error.message,
      })

      return {
        valid: false,
        error: error.message,
      }
    }
  }

  /**
   * Validate and update bundle info
   */
  export async function validateBundleInfo(bundleId: string): Promise<boolean> {
    const bundle = bundles.get(bundleId)
    if (!bundle) {
      log.warn('Bundle not found', { bundleId })
      return false
    }

    const result = await validateBundle(bundle.path)

    bundle.validated = result.valid

    if (result.valid && result.commits) {
      bundle.commits = result.commits
      bundle.refs = result.refs || []
    }

    // Publish event
    Bus.publish(BundleValidated, {
      bundleId,
      agentId: bundle.agentId,
      valid: result.valid,
      commitCount: result.commits?.length || 0,
    })

    return result.valid
  }

  // ============================================================================
  // Bundle Extraction
  // ============================================================================

  /**
   * Extract a bundle to a repository
   */
  export async function extractBundle(
    bundleId: string,
    targetRepoPath: string,
  ): Promise<{ success: boolean; commitsAdded: number; error?: string }> {
    const bundle = bundles.get(bundleId)
    if (!bundle) {
      return {
        success: false,
        commitsAdded: 0,
        error: 'Bundle not found',
      }
    }

    try {
      log.info('Extracting bundle', {
        bundleId,
        targetRepoPath,
      })

      // Validate first if required
      if (defaultConfig.requireValidation && !bundle.validated) {
        const valid = await validateBundleInfo(bundleId)
        if (!valid) {
          return {
            success: false,
            commitsAdded: 0,
            error: 'Bundle validation failed',
          }
        }
      }

      // Fetch bundle into repo
      const tempRef = `refs/bundles/${bundleId}`
      await execAsync(
        `git -C "${targetRepoPath}" fetch "${bundle.path}" "+${bundle.refs[0] || 'HEAD'}:${tempRef}"`,
      )

      // Track commits in DAG
      let commitsAdded = 0
      for (const commitHash of bundle.commits) {
        try {
          await GitDAGTracker.trackCommit(targetRepoPath, commitHash, bundle.agentId)
          commitsAdded++
        } catch (error: any) {
          log.warn('Failed to track commit', {
            commitHash,
            error: error.message,
          })
        }
      }

      bundle.extracted = true

      log.info('Bundle extracted', {
        bundleId,
        commitsAdded,
      })

      // Publish event
      Bus.publish(BundleExtracted, {
        bundleId,
        agentId: bundle.agentId,
        repoPath: targetRepoPath,
        commitsAdded,
      })

      return {
        success: true,
        commitsAdded,
      }
    } catch (error: any) {
      log.error('Bundle extraction failed', {
        bundleId,
        error: error.message,
      })

      return {
        success: false,
        commitsAdded: 0,
        error: error.message,
      }
    }
  }

  // ============================================================================
  // Bundle Management
  // ============================================================================

  /**
   * Get bundle info
   */
  export function getBundle(bundleId: string): BundleInfo | undefined {
    return bundles.get(bundleId)
  }

  /**
   * List bundles by agent
   */
  export function listAgentBundles(agentId: string): BundleInfo[] {
    return Array.from(bundles.values()).filter((b) => b.agentId === agentId)
  }

  /**
   * Delete a bundle
   */
  export async function deleteBundle(bundleId: string): Promise<boolean> {
    const bundle = bundles.get(bundleId)
    if (!bundle) return false

    try {
      await fs.unlink(bundle.path)
      bundles.delete(bundleId)
      log.info('Bundle deleted', { bundleId })
      return true
    } catch (error: any) {
      log.error('Failed to delete bundle', { bundleId, error: error.message })
      return false
    }
  }

  /**
   * Cleanup old bundles
   */
  export async function cleanup(maxAgeHours: number = 24): Promise<number> {
    const now = Date.now()
    const maxAge = maxAgeHours * 60 * 60 * 1000
    let deleted = 0

    for (const [bundleId, bundle] of bundles.entries()) {
      if (now - bundle.createdAt > maxAge) {
        await deleteBundle(bundleId)
        deleted++
      }
    }

    if (deleted > 0) {
      log.info('Cleaned up old bundles', { count: deleted })
    }

    return deleted
  }

  /**
   * Clear all bundles (for testing)
   */
  export async function clearAll(): Promise<void> {
    for (const bundleId of bundles.keys()) {
      await deleteBundle(bundleId)
    }
    bundles.clear()
    log.info('Cleared all bundles')
  }

  // ============================================================================
  // Configuration
  // ============================================================================

  /**
   * Update bundle configuration
   */
  export function setConfig(config: Partial<BundleConfig>): void {
    Object.assign(defaultConfig, config)
    log.info('Updated bundle config', defaultConfig)
  }

  /**
   * Get current configuration
   */
  export function getConfig(): BundleConfig {
    return { ...defaultConfig }
  }
}
