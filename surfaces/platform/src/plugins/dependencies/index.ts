/**
 * Plugin Dependencies Module
 * 
 * Provides dependency resolution, version checking, and conflict detection
 * for the A2R Plugin system.
 * 
 * Features:
 * - Semver version range parsing and comparison
 * - Dependency tree resolution with cycle detection
 * - Topological sorting for installation order
 * - Version conflict detection and reporting
 * 
 * @example
 * ```typescript
 * import { resolveDependencies, checkDependencies } from './dependencies';
 * 
 * const resolution = resolveDependencies(
 *   'my-plugin',
 *   (id) => getPluginManifest(id),
 *   (id) => getInstalledVersion(id)
 * );
 * 
 * if (!resolution.satisfied) {
 *   console.log('Missing:', resolution.missing);
 *   console.log('Conflicts:', resolution.conflicts);
 * }
 * ```
 */

// Types
export type {
  PluginDependency,
  DependencyNode,
  DependencyGraph,
  DependencyResolutionResult,
  DependencyTreeNode,
  MissingDependency,
  DependencyConflict,
  DependencyCheckResult,
} from '../dependencies';

// Core functions
export {
  // Resolution
  resolveDependencies,
  checkDependencies,
  getMissingDependencies,
  
  // Graph operations
  createDependencyGraph,
  buildDependencyGraph,
  topologicalSort,
  getInstallationOrder,
  
  // Conflict detection
  getConflictingDependencies,
  validateDependencyGraph,
  hasDependencyIssues,
  
  // Semver utilities
  parseVersion,
  compareVersions,
  satisfiesRange,
  
  // Utilities
  formatVersionRange,
  getMinVersion,
  mergeVersionRanges,
  getDependencyStats,
} from '../dependencies';
