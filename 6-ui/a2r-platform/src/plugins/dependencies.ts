/**
 * Plugin Dependencies Handling
 * 
 * Manages plugin dependency resolution, version compatibility checking,
 * and installation ordering using topological sorting.
 * 
 * Features:
 * - Dependency tree resolution
 * - Semver version range matching
 * - Circular dependency detection
 * - Topological sort for installation order
 * - Conflict detection and reporting
 */

import type { PluginManifest } from './plugin.types';

// ============================================================================
// Types
// ============================================================================

/**
 * Represents a single plugin dependency requirement
 */
export interface PluginDependency {
  /** Unique identifier of the dependency plugin */
  pluginId: string;
  /** Semver version range (e.g., "^1.0.0", ">=2.0.0 <3.0.0") */
  versionRange: string;
  /** Whether this dependency is optional */
  optional: boolean;
  /** Features/capabilities that require this dependency */
  requiredFor: string[];
}

/**
 * Node in the dependency graph representing a plugin and its dependencies
 */
export interface DependencyNode {
  pluginId: string;
  version: string;
  dependencies: PluginDependency[];
  dependents: string[]; // Plugins that depend on this one
  status: 'installed' | 'missing' | 'conflict';
  optional: boolean;
}

/**
 * The complete dependency graph for all plugins
 */
export interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
  edges: Map<string, string[]>; // pluginId -> dependencies
}

/**
 * Result of dependency resolution
 */
export interface DependencyResolutionResult {
  /** The full dependency tree starting from the requested plugin */
  tree: DependencyTreeNode | null;
  /** Whether all required dependencies are satisfied */
  satisfied: boolean;
  /** List of missing required dependencies */
  missing: MissingDependency[];
  /** List of version conflicts */
  conflicts: DependencyConflict[];
  /** Installation order (topologically sorted) */
  installOrder: string[];
  /** Optional dependencies that could be installed */
  optional: string[];
}

/**
 * Tree representation of a plugin's dependencies
 */
export interface DependencyTreeNode {
  pluginId: string;
  version: string;
  versionRange: string;
  status: 'installed' | 'missing' | 'conflict' | 'optional';
  optional: boolean;
  children: DependencyTreeNode[];
}

/**
 * Represents a missing dependency
 */
export interface MissingDependency {
  pluginId: string;
  versionRange: string;
  requiredBy: string;
  requiredFor?: string[];
}

/**
 * Represents a version conflict between dependencies
 */
export interface DependencyConflict {
  pluginId: string;
  installedVersion?: string;
  conflictingRequirements: Array<{
    requiredBy: string;
    versionRange: string;
  }>;
  resolution?: 'keep' | 'upgrade' | 'force';
}

/**
 * Dependency check result for a single plugin
 */
export interface DependencyCheckResult {
  pluginId: string;
  satisfied: boolean;
  installed: boolean;
  installedVersion?: string;
  satisfiesRange: boolean;
  missing: MissingDependency[];
  conflicts: DependencyConflict[];
}

// ============================================================================
// Semver Utilities
// ============================================================================

/**
 * Parse a version string into its numeric components
 */
export function parseVersion(version: string): {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
  build: string[];
} | null {
  // Remove 'v' prefix if present
  const cleanVersion = version.replace(/^v/, '');
  
  // Match semver: major.minor.patch-prerelease+build
  const match = cleanVersion.match(
    /^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([a-zA-Z0-9.-]+))?(?:\+([a-zA-Z0-9.-]+))?$/
  );
  
  if (!match) return null;
  
  const [, major, minor, patch, prereleaseStr, buildStr] = match;
  
  return {
    major: parseInt(major || '0', 10),
    minor: parseInt(minor || '0', 10),
    patch: parseInt(patch || '0', 10),
    prerelease: prereleaseStr ? prereleaseStr.split('.') : [],
    build: buildStr ? buildStr.split('.') : [],
  };
}

/**
 * Compare two version strings
 * Returns: -1 if v1 < v2, 0 if v1 === v2, 1 if v1 > v2
 */
export function compareVersions(v1: string, v2: string): number {
  const p1 = parseVersion(v1);
  const p2 = parseVersion(v2);
  
  if (!p1 || !p2) {
    // Fallback to string comparison for non-semver versions
    return v1.localeCompare(v2);
  }
  
  // Compare major.minor.patch
  if (p1.major !== p2.major) return p1.major > p2.major ? 1 : -1;
  if (p1.minor !== p2.minor) return p1.minor > p2.minor ? 1 : -1;
  if (p1.patch !== p2.patch) return p1.patch > p2.patch ? 1 : -1;
  
  // Handle prerelease comparison
  // A version without prerelease is greater than one with prerelease
  if (p1.prerelease.length === 0 && p2.prerelease.length > 0) return 1;
  if (p1.prerelease.length > 0 && p2.prerelease.length === 0) return -1;
  
  // Compare prerelease components
  const maxLen = Math.max(p1.prerelease.length, p2.prerelease.length);
  for (let i = 0; i < maxLen; i++) {
    const a = p1.prerelease[i];
    const b = p2.prerelease[i];
    
    if (a === undefined) return -1;
    if (b === undefined) return 1;
    
    // Numeric identifiers are compared as integers
    const aNum = parseInt(a, 10);
    const bNum = parseInt(b, 10);
    
    if (!isNaN(aNum) && !isNaN(bNum)) {
      if (aNum !== bNum) return aNum > bNum ? 1 : -1;
    } else {
      // Alphanumeric or mixed comparison
      const cmp = a.localeCompare(b);
      if (cmp !== 0) return cmp > 0 ? 1 : -1;
    }
  }
  
  return 0;
}

/**
 * Check if a version satisfies a caret (^) range
 * ^1.2.3 := >=1.2.3 <2.0.0
 * ^0.2.3 := >=0.2.3 <0.3.0
 * ^0.0.3 := >=0.0.3 <0.0.4
 */
function satisfiesCaret(version: string, rangeVersion: string): boolean {
  const v = parseVersion(version);
  const r = parseVersion(rangeVersion);
  
  if (!v || !r) return false;
  
  // Compare major.minor.patch
  if (v.major !== r.major) return false;
  
  if (r.major === 0) {
    if (r.minor === 0) {
      // ^0.0.x := exact match for 0.0.x
      return v.minor === 0 && v.patch === r.patch;
    }
    // ^0.x.y := >=0.x.y <0.(x+1).0
    if (v.minor < r.minor) return false;
    if (v.minor === r.minor && v.patch < r.patch) return false;
    return true;
  }
  
  // ^x.y.z where x > 0
  if (v.minor < r.minor) return false;
  if (v.minor === r.minor && v.patch < r.patch) return false;
  
  return true;
}

/**
 * Check if a version satisfies a tilde (~) range
 * ~1.2.3 := >=1.2.3 <1.3.0
 * ~1.2 := >=1.2.0 <1.3.0
 */
function satisfiesTilde(version: string, rangeVersion: string): boolean {
  const v = parseVersion(version);
  const r = parseVersion(rangeVersion);
  
  if (!v || !r) return false;
  
  if (v.major !== r.major) return false;
  if (v.minor < r.minor) return false;
  if (v.minor === r.minor && v.patch < r.patch) return false;
  if (v.minor > r.minor) return false;
  
  return true;
}

/**
 * Check if a version satisfies a range
 * Supports: ^, ~, >=, <=, >, <, =, and ranges with spaces (e.g., ">=1.0.0 <2.0.0")
 */
export function satisfiesRange(version: string, range: string): boolean {
  const cleanRange = range.trim();
  
  // Handle caret ranges
  if (cleanRange.startsWith('^')) {
    return satisfiesCaret(version, cleanRange.slice(1));
  }
  
  // Handle tilde ranges
  if (cleanRange.startsWith('~')) {
    return satisfiesTilde(version, cleanRange.slice(1));
  }
  
  // Handle comparison operators
  if (cleanRange.startsWith('>=')) {
    const v = cleanRange.slice(2).trim();
    return compareVersions(version, v) >= 0;
  }
  if (cleanRange.startsWith('<=')) {
    const v = cleanRange.slice(2).trim();
    return compareVersions(version, v) <= 0;
  }
  if (cleanRange.startsWith('>')) {
    const v = cleanRange.slice(1).trim();
    return compareVersions(version, v) > 0;
  }
  if (cleanRange.startsWith('<')) {
    const v = cleanRange.slice(1).trim();
    return compareVersions(version, v) < 0;
  }
  if (cleanRange.startsWith('=')) {
    const v = cleanRange.slice(1).trim();
    return compareVersions(version, v) === 0;
  }
  
  // Handle hyphen ranges (e.g., "1.2.3 - 2.3.4")
  const hyphenMatch = cleanRange.match(/^(\S+)\s+-\s+(\S+)$/);
  if (hyphenMatch) {
    const [, low, high] = hyphenMatch;
    return compareVersions(version, low) >= 0 && compareVersions(version, high) <= 0;
  }
  
  // Handle space-separated ranges (AND operation)
  if (cleanRange.includes(' ')) {
    const parts = cleanRange.split(/\s+/);
    return parts.every(part => satisfiesRange(version, part));
  }
  
  // Handle OR ranges (e.g., "1.2.3 || 2.0.0")
  if (cleanRange.includes('||')) {
    const parts = cleanRange.split(/\s*\|\|\s*/);
    return parts.some(part => satisfiesRange(version, part));
  }
  
  // Handle wildcards (e.g., "1.x", "1.2.x", "*")
  if (cleanRange === '*' || cleanRange === 'x' || cleanRange === 'X') {
    return true;
  }
  const wildcardMatch = cleanRange.match(/^(\d+)(?:\.(\d+|x|X|\*))?(?:\.(\d+|x|X|\*))?$/);
  if (wildcardMatch) {
    const [, major, minor, patch] = wildcardMatch;
    const v = parseVersion(version);
    if (!v) return false;
    if (parseInt(major, 10) !== v.major) return false;
    if (minor && minor !== 'x' && minor !== 'X' && minor !== '*') {
      if (parseInt(minor, 10) !== v.minor) return false;
    }
    if (patch && patch !== 'x' && patch !== 'X' && patch !== '*') {
      if (parseInt(patch, 10) !== v.patch) return false;
    }
    return true;
  }
  
  // Exact version match
  return compareVersions(version, cleanRange) === 0;
}

// ============================================================================
// Dependency Graph Operations
// ============================================================================

/**
 * Create an empty dependency graph
 */
export function createDependencyGraph(): DependencyGraph {
  return {
    nodes: new Map(),
    edges: new Map(),
  };
}

/**
 * Add a plugin to the dependency graph
 */
export function addToGraph(
  graph: DependencyGraph,
  pluginId: string,
  version: string,
  dependencies: PluginDependency[]
): void {
  const node: DependencyNode = {
    pluginId,
    version,
    dependencies,
    dependents: [],
    status: 'installed',
    optional: false,
  };
  
  graph.nodes.set(pluginId, node);
  graph.edges.set(pluginId, dependencies.map(d => d.pluginId));
  
  // Update dependents for each dependency
  for (const dep of dependencies) {
    const depNode = graph.nodes.get(dep.pluginId);
    if (depNode && !depNode.dependents.includes(pluginId)) {
      depNode.dependents.push(pluginId);
    }
  }
}

/**
 * Build a dependency graph from a set of plugins
 */
export function buildDependencyGraph(
  plugins: Array<{
    id: string;
    version: string;
    dependencies?: Record<string, string>;
  }>
): DependencyGraph {
  const graph = createDependencyGraph();
  
  for (const plugin of plugins) {
    const deps: PluginDependency[] = [];
    if (plugin.dependencies) {
      for (const [depId, range] of Object.entries(plugin.dependencies)) {
        deps.push({
          pluginId: depId,
          versionRange: range,
          optional: false,
          requiredFor: [],
        });
      }
    }
    addToGraph(graph, plugin.id, plugin.version, deps);
  }
  
  return graph;
}

// ============================================================================
// Dependency Resolution
// ============================================================================

/**
 * Resolve the full dependency tree for a plugin
 */
export function resolveDependencies(
  pluginId: string,
  getPlugin: (id: string) => { id: string; version: string; dependencies?: Record<string, string> } | undefined,
  getInstalledVersion: (id: string) => string | undefined,
  visited: Set<string> = new Set()
): DependencyResolutionResult {
  const result: DependencyResolutionResult = {
    tree: null,
    satisfied: true,
    missing: [],
    conflicts: [],
    installOrder: [],
    optional: [],
  };
  
  // Detect circular dependencies
  if (visited.has(pluginId)) {
    return {
      ...result,
      satisfied: false,
      conflicts: [{
        pluginId,
        conflictingRequirements: [{
          requiredBy: 'circular-dependency',
          versionRange: 'any',
        }],
      }],
    };
  }
  
  const plugin = getPlugin(pluginId);
  if (!plugin) {
    result.missing.push({
      pluginId,
      versionRange: '*',
      requiredBy: 'root',
    });
    return { ...result, satisfied: false };
  }
  
  const installedVersion = getInstalledVersion(pluginId);
  const treeNode: DependencyTreeNode = {
    pluginId,
    version: installedVersion || plugin.version,
    versionRange: '*',
    status: installedVersion ? 'installed' : 'missing',
    optional: false,
    children: [],
  };
  
  result.tree = treeNode;
  
  if (!installedVersion) {
    result.installOrder.push(pluginId);
  }
  
  // Process dependencies
  const deps = plugin.dependencies || {};
  const newVisited = new Set(visited);
  newVisited.add(pluginId);
  
  for (const [depId, range] of Object.entries(deps)) {
    const depInstalledVersion = getInstalledVersion(depId);
    const depPlugin = getPlugin(depId);
    
    const depResult = resolveDependencies(depId, getPlugin, getInstalledVersion, newVisited);
    
    // Merge missing dependencies
    result.missing.push(...depResult.missing);
    
    // Merge conflicts
    result.conflicts.push(...depResult.conflicts);
    
    // Add to install order
    for (const id of depResult.installOrder) {
      if (!result.installOrder.includes(id)) {
        result.installOrder.unshift(id);
      }
    }
    
    // Add to optional list
    result.optional.push(...depResult.optional);
    
    // Check if dependency is satisfied
    if (!depInstalledVersion) {
      if (!depPlugin) {
        result.missing.push({
          pluginId: depId,
          versionRange: range,
          requiredBy: pluginId,
        });
        result.satisfied = false;
        treeNode.children.push({
          pluginId: depId,
          version: '?',
          versionRange: range,
          status: 'missing',
          optional: false,
          children: [],
        });
      } else {
        treeNode.children.push({
          pluginId: depId,
          version: depPlugin.version,
          versionRange: range,
          status: 'missing',
          optional: false,
          children: depResult.tree?.children || [],
        });
      }
    } else {
      // Check version compatibility
      const satisfies = satisfiesRange(depInstalledVersion, range);
      const childNode: DependencyTreeNode = {
        pluginId: depId,
        version: depInstalledVersion,
        versionRange: range,
        status: satisfies ? 'installed' : 'conflict',
        optional: false,
        children: depResult.tree?.children || [],
      };
      
      if (!satisfies) {
        result.satisfied = false;
        const existingConflict = result.conflicts.find(c => c.pluginId === depId);
        if (existingConflict) {
          existingConflict.conflictingRequirements.push({
            requiredBy: pluginId,
            versionRange: range,
          });
        } else {
          result.conflicts.push({
            pluginId: depId,
            installedVersion: depInstalledVersion,
            conflictingRequirements: [{
              requiredBy: pluginId,
              versionRange: range,
            }],
          });
        }
      }
      
      treeNode.children.push(childNode);
    }
  }
  
  // Remove duplicates from install order
  result.installOrder = [...new Set(result.installOrder)];
  
  return result;
}

/**
 * Check if all dependencies for a plugin are installed and compatible
 */
export function checkDependencies(
  pluginId: string,
  getPlugin: (id: string) => { id: string; version: string; dependencies?: Record<string, string> } | undefined,
  getInstalledVersion: (id: string) => string | undefined
): DependencyCheckResult {
  const plugin = getPlugin(pluginId);
  
  if (!plugin) {
    return {
      pluginId,
      satisfied: false,
      installed: false,
      satisfiesRange: false,
      missing: [],
      conflicts: [],
    };
  }
  
  const installedVersion = getInstalledVersion(pluginId);
  const deps = plugin.dependencies || {};
  const missing: MissingDependency[] = [];
  const conflicts: DependencyConflict[] = [];
  let allSatisfied = true;
  
  for (const [depId, range] of Object.entries(deps)) {
    const depVersion = getInstalledVersion(depId);
    
    if (!depVersion) {
      missing.push({
        pluginId: depId,
        versionRange: range,
        requiredBy: pluginId,
      });
      allSatisfied = false;
    } else if (!satisfiesRange(depVersion, range)) {
      conflicts.push({
        pluginId: depId,
        installedVersion: depVersion,
        conflictingRequirements: [{
          requiredBy: pluginId,
          versionRange: range,
        }],
      });
      allSatisfied = false;
    }
  }
  
  return {
    pluginId,
    satisfied: allSatisfied,
    installed: !!installedVersion,
    installedVersion,
    satisfiesRange: allSatisfied,
    missing,
    conflicts,
  };
}

/**
 * Get all missing dependencies for a plugin (including transitive)
 */
export function getMissingDependencies(
  pluginId: string,
  getPlugin: (id: string) => { id: string; version: string; dependencies?: Record<string, string> } | undefined,
  getInstalledVersion: (id: string) => string | undefined,
  visited: Set<string> = new Set()
): MissingDependency[] {
  if (visited.has(pluginId)) return [];
  
  const plugin = getPlugin(pluginId);
  if (!plugin) {
    return [{
      pluginId,
      versionRange: '*',
      requiredBy: 'unknown',
    }];
  }
  
  const missing: MissingDependency[] = [];
  const newVisited = new Set(visited);
  newVisited.add(pluginId);
  
  const deps = plugin.dependencies || {};
  
  for (const [depId, range] of Object.entries(deps)) {
    const depVersion = getInstalledVersion(depId);
    
    if (!depVersion) {
      missing.push({
        pluginId: depId,
        versionRange: range,
        requiredBy: pluginId,
      });
      
      // Also get transitive missing dependencies
      const transitiveMissing = getMissingDependencies(depId, getPlugin, getInstalledVersion, newVisited);
      missing.push(...transitiveMissing);
    }
  }
  
  return missing;
}

/**
 * Find all version conflicts in the dependency graph
 */
export function getConflictingDependencies(
  plugins: Array<{
    id: string;
    version: string;
    dependencies?: Record<string, string>;
  }>,
  getInstalledVersion: (id: string) => string | undefined
): DependencyConflict[] {
  const conflicts: DependencyConflict[] = [];
  const requirements = new Map<string, Array<{ requiredBy: string; versionRange: string }>>();
  
  // Collect all requirements
  for (const plugin of plugins) {
    const deps = plugin.dependencies || {};
    for (const [depId, range] of Object.entries(deps)) {
      if (!requirements.has(depId)) {
        requirements.set(depId, []);
      }
      requirements.get(depId)!.push({
        requiredBy: plugin.id,
        versionRange: range,
      });
    }
  }
  
  // Check for conflicts
  for (const [depId, reqs] of requirements) {
    const installedVersion = getInstalledVersion(depId);
    
    if (installedVersion) {
      // Check if installed version satisfies all requirements
      const unsatisfied = reqs.filter(req => !satisfiesRange(installedVersion, req.versionRange));
      
      if (unsatisfied.length > 0) {
        conflicts.push({
          pluginId: depId,
          installedVersion,
          conflictingRequirements: reqs,
        });
      }
    }
    
    // Check for incompatible requirements between plugins
    if (reqs.length > 1) {
      const incompatible: typeof reqs = [];
      
      for (let i = 0; i < reqs.length; i++) {
        for (let j = i + 1; j < reqs.length; j++) {
          const req1 = reqs[i];
          const req2 = reqs[j];
          
          // Check if ranges are compatible (simplified check)
          // Two ranges are compatible if there's a version that satisfies both
          // For now, we just flag if the ranges are different
          if (req1.versionRange !== req2.versionRange) {
            if (!incompatible.includes(req1)) incompatible.push(req1);
            if (!incompatible.includes(req2)) incompatible.push(req2);
          }
        }
      }
      
      if (incompatible.length > 0 && !conflicts.some(c => c.pluginId === depId)) {
        conflicts.push({
          pluginId: depId,
          installedVersion,
          conflictingRequirements: incompatible,
        });
      }
    }
  }
  
  return conflicts;
}

// ============================================================================
// Topological Sort
// ============================================================================

/**
 * Perform topological sort to determine installation order
 * Returns plugins in order such that dependencies come before dependents
 */
export function topologicalSort(
  pluginIds: string[],
  getDependencies: (id: string) => string[]
): { order: string[]; cycles: string[][] } {
  const visited = new Set<string>();
  const temp = new Set<string>();
  const order: string[] = [];
  const cycles: string[][] = [];
  
  function visit(id: string, path: string[] = []) {
    if (temp.has(id)) {
      // Found a cycle
      const cycleStart = path.indexOf(id);
      if (cycleStart !== -1) {
        cycles.push(path.slice(cycleStart));
      }
      return;
    }
    
    if (visited.has(id)) return;
    
    temp.add(id);
    path.push(id);
    
    const deps = getDependencies(id);
    for (const dep of deps) {
      visit(dep, [...path]);
    }
    
    temp.delete(id);
    visited.add(id);
    order.push(id);
  }
  
  for (const id of pluginIds) {
    if (!visited.has(id)) {
      visit(id);
    }
  }
  
  return { order, cycles };
}

/**
 * Get installation order for a plugin and all its dependencies
 */
export function getInstallationOrder(
  pluginId: string,
  getPlugin: (id: string) => { id: string; version: string; dependencies?: Record<string, string> } | undefined,
  visited: Set<string> = new Set()
): string[] {
  if (visited.has(pluginId)) return [];
  
  const plugin = getPlugin(pluginId);
  if (!plugin) return [];
  
  const newVisited = new Set(visited);
  newVisited.add(pluginId);
  
  const order: string[] = [];
  const deps = Object.keys(plugin.dependencies || {});
  
  // First, get dependencies in order
  for (const depId of deps) {
    const depOrder = getInstallationOrder(depId, getPlugin, newVisited);
    for (const id of depOrder) {
      if (!order.includes(id)) {
        order.push(id);
      }
    }
    if (!order.includes(depId)) {
      order.push(depId);
    }
  }
  
  // Then add this plugin
  if (!order.includes(pluginId)) {
    order.push(pluginId);
  }
  
  return order;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate the entire dependency graph for cycles and conflicts
 */
export function validateDependencyGraph(
  plugins: Array<{
    id: string;
    version: string;
    dependencies?: Record<string, string>;
  }>,
  getInstalledVersion: (id: string) => string | undefined
): {
  valid: boolean;
  cycles: string[][];
  conflicts: DependencyConflict[];
  errors: string[];
} {
  const errors: string[] = [];
  
  // Check for cycles using topological sort
  const { order, cycles } = topologicalSort(
    plugins.map(p => p.id),
    (id) => {
      const plugin = plugins.find(p => p.id === id);
      return plugin ? Object.keys(plugin.dependencies || {}) : [];
    }
  );
  
  if (cycles.length > 0) {
    for (const cycle of cycles) {
      errors.push(`Circular dependency detected: ${cycle.join(' -> ')}`);
    }
  }
  
  // Check for version conflicts
  const conflicts = getConflictingDependencies(plugins, getInstalledVersion);
  
  for (const conflict of conflicts) {
    const reqStr = conflict.conflictingRequirements
      .map(r => `${r.requiredBy} requires ${r.versionRange}`)
      .join(', ');
    errors.push(`Version conflict for ${conflict.pluginId}: ${reqStr}`);
  }
  
  return {
    valid: cycles.length === 0 && conflicts.length === 0,
    cycles,
    conflicts,
    errors,
  };
}

/**
 * Check if a dependency graph has any issues
 */
export function hasDependencyIssues(
  plugins: Array<{
    id: string;
    version: string;
    dependencies?: Record<string, string>;
  }>,
  getInstalledVersion: (id: string) => string | undefined
): boolean {
  const result = validateDependencyGraph(plugins, getInstalledVersion);
  return !result.valid;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format a version range for display
 */
export function formatVersionRange(range: string): string {
  if (range === '*') return 'any version';
  if (range.startsWith('^')) return `compatible with ${range.slice(1)}`;
  if (range.startsWith('~')) return `approximately ${range.slice(1)}`;
  if (range.startsWith('>=')) return `${range.slice(2)} or higher`;
  if (range.startsWith('<=')) return `${range.slice(2)} or lower`;
  if (range.startsWith('>')) return `higher than ${range.slice(1)}`;
  if (range.startsWith('<')) return `lower than ${range.slice(1)}`;
  return range;
}

/**
 * Get the minimum required version from a range
 */
export function getMinVersion(range: string): string | null {
  if (range === '*') return '0.0.0';
  if (range.startsWith('^') || range.startsWith('~') || range.startsWith('=')) {
    return range.slice(1);
  }
  if (range.startsWith('>=')) {
    return range.slice(2).trim().split(' ')[0];
  }
  if (range.startsWith('>')) {
    return range.slice(1).trim();
  }
  return range;
}

/**
 * Merge two version ranges (returns the most restrictive)
 */
export function mergeVersionRanges(range1: string, range2: string): string {
  // Simplified merge - just return the higher minimum version
  const min1 = getMinVersion(range1);
  const min2 = getMinVersion(range2);
  
  if (!min1) return range2;
  if (!min2) return range1;
  
  return compareVersions(min1, min2) >= 0 ? range1 : range2;
}

/**
 * Get dependency stats for a plugin
 */
export function getDependencyStats(
  pluginId: string,
  getPlugin: (id: string) => { id: string; version: string; dependencies?: Record<string, string> } | undefined,
  getInstalledVersion: (id: string) => string | undefined
): {
  total: number;
  installed: number;
  missing: number;
  conflicting: number;
  optional: number;
} {
  const resolution = resolveDependencies(pluginId, getPlugin, getInstalledVersion);
  
  let total = 0;
  let installed = 0;
  let missing = 0;
  let conflicting = 0;
  let optional = 0;
  
  function countNode(node: DependencyTreeNode | null) {
    if (!node) return;
    
    if (node.pluginId !== pluginId) {
      total++;
      
      switch (node.status) {
        case 'installed':
          installed++;
          break;
        case 'missing':
          if (node.optional) {
            optional++;
          } else {
            missing++;
          }
          break;
        case 'conflict':
          conflicting++;
          break;
        case 'optional':
          optional++;
          break;
      }
    }
    
    for (const child of node.children) {
      countNode(child);
    }
  }
  
  countNode(resolution.tree);
  
  return { total, installed, missing, conflicting, optional };
}

export default {
  resolveDependencies,
  checkDependencies,
  getMissingDependencies,
  getConflictingDependencies,
  topologicalSort,
  validateDependencyGraph,
  satisfiesRange,
  compareVersions,
  parseVersion,
  getInstallationOrder,
  hasDependencyIssues,
  formatVersionRange,
  getMinVersion,
  mergeVersionRanges,
  getDependencyStats,
  createDependencyGraph,
  buildDependencyGraph,
};
