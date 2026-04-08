/**
 * Host Allowlist
 * 
 * Default-deny security model for browser automation.
 * Only explicitly allowed hosts can be automated.
 */

const STORAGE_KEY = 'a2r_allowed_hosts';
const DEFAULT_POLICY: AllowlistPolicy = {
  mode: 'default-deny',
  allowedHosts: [],
  allowedPatterns: [],
  blockedHosts: [],
  maxActionsPerMinute: 10,
  requireApprovalFor: ['form-submit', 'navigation', 'download', 'payment'],
};

export interface AllowlistPolicy {
  mode: 'default-deny' | 'default-allow';
  allowedHosts: string[];
  allowedPatterns: string[]; // Wildcard patterns like "*.example.com"
  blockedHosts: string[];
  maxActionsPerMinute: number;
  requireApprovalFor: RiskyActionType[];
}

export type RiskyActionType = 
  | 'form-submit'
  | 'navigation'
  | 'download'
  | 'payment'
  | 'file-upload'
  | 'password-input'
  | 'sensitive-extract';

export interface HostCheckResult {
  allowed: boolean;
  reason?: string;
  requiresApproval?: boolean;
  approvalReason?: string;
}

/**
 * Host Allowlist Class
 * 
 * Wrapper around allowlist functions for backward compatibility
 */
export class HostAllowlist {
  private policy: AllowlistPolicy = DEFAULT_POLICY;

  /**
   * Load policy from storage
   */
  async load(): Promise<void> {
    this.policy = await getPolicy();
  }

  /**
   * Check if a URL is allowed
   */
  isAllowed(url: string): boolean {
    const hostname = extractHostname(url);
    
    // Check blocked list first
    if (this.policy.blockedHosts.includes(hostname)) {
      return false;
    }
    
    // Default deny mode
    if (this.policy.mode === 'default-deny') {
      return this.policy.allowedHosts.includes(hostname) ||
        matchesWildcard(hostname, this.policy.allowedPatterns);
    }
    
    // Default allow mode
    return true;
  }

  /**
   * Update allowlist with new hosts
   */
  async update(hosts: string[]): Promise<void> {
    this.policy.allowedHosts = hosts.map(normalizeHost);
    await savePolicy(this.policy);
  }

  /**
   * Add a host to allowlist
   */
  async allowHost(host: string): Promise<void> {
    const normalized = normalizeHost(host);
    if (!this.policy.allowedHosts.includes(normalized)) {
      this.policy.allowedHosts.push(normalized);
      await savePolicy(this.policy);
    }
  }

  /**
   * Remove a host from allowlist
   */
  async removeHost(host: string): Promise<void> {
    const normalized = normalizeHost(host);
    this.policy.allowedHosts = this.policy.allowedHosts.filter(h => h !== normalized);
    await savePolicy(this.policy);
  }

  /**
   * Block a host explicitly
   */
  async blockHost(host: string): Promise<void> {
    const normalized = normalizeHost(host);
    if (!this.policy.blockedHosts.includes(normalized)) {
      this.policy.blockedHosts.push(normalized);
      this.policy.allowedHosts = this.policy.allowedHosts.filter(h => h !== normalized);
      await savePolicy(this.policy);
    }
  }

  /**
   * Get current policy
   */
  getPolicy(): AllowlistPolicy {
    return { ...this.policy };
  }
}

/**
 * Check if a host is allowed
 */
export async function checkHost(url: string): Promise<HostCheckResult> {
  const policy = await getPolicy();
  const hostname = extractHostname(url);
  
  // Check blocked list first (always deny)
  if (policy.blockedHosts.includes(hostname)) {
    return {
      allowed: false,
      reason: `Host ${hostname} is explicitly blocked`,
    };
  }
  
  // Default deny mode
  if (policy.mode === 'default-deny') {
    const isAllowed = 
      policy.allowedHosts.includes(hostname) ||
      matchesWildcard(hostname, policy.allowedPatterns);
    
    if (!isAllowed) {
      return {
        allowed: false,
        reason: `Host ${hostname} is not in allowlist (default-deny mode)`,
      };
    }
  }
  
  // Default allow mode - check if explicitly blocked
  if (policy.mode === 'default-allow') {
    if (policy.blockedHosts.includes(hostname)) {
      return {
        allowed: false,
        reason: `Host ${hostname} is explicitly blocked`,
      };
    }
  }
  
  return { allowed: true };
}

/**
 * Check if an action requires approval
 */
export async function checkActionApproval(
  action: RiskyActionType,
  details?: Record<string, unknown>
): Promise<HostCheckResult> {
  const policy = await getPolicy();
  
  if (policy.requireApprovalFor.includes(action)) {
    return {
      allowed: true,
      requiresApproval: true,
      approvalReason: getApprovalReason(action, details),
    };
  }
  
  return { allowed: true };
}

/**
 * Add host to allowlist
 */
export async function allowHost(host: string): Promise<void> {
  const policy = await getPolicy();
  const normalized = normalizeHost(host);
  
  if (!policy.allowedHosts.includes(normalized)) {
    policy.allowedHosts.push(normalized);
    await savePolicy(policy);
  }
}

/**
 * Remove host from allowlist
 */
export async function removeHost(host: string): Promise<void> {
  const policy = await getPolicy();
  const normalized = normalizeHost(host);
  
  policy.allowedHosts = policy.allowedHosts.filter(h => h !== normalized);
  await savePolicy(policy);
}

/**
 * Add wildcard pattern to allowlist
 */
export async function allowPattern(pattern: string): Promise<void> {
  const policy = await getPolicy();
  
  if (!policy.allowedPatterns.includes(pattern)) {
    policy.allowedPatterns.push(pattern);
    await savePolicy(policy);
  }
}

/**
 * Block a host explicitly
 */
export async function blockHost(host: string): Promise<void> {
  const policy = await getPolicy();
  const normalized = normalizeHost(host);
  
  if (!policy.blockedHosts.includes(normalized)) {
    policy.blockedHosts.push(normalized);
    // Remove from allowed if present
    policy.allowedHosts = policy.allowedHosts.filter(h => h !== normalized);
    await savePolicy(policy);
  }
}

/**
 * Get current policy
 */
export async function getPolicy(): Promise<AllowlistPolicy> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] || DEFAULT_POLICY;
}

/**
 * Save policy
 */
export async function savePolicy(policy: AllowlistPolicy): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: policy });
}

/**
 * Reset to defaults
 */
export async function resetPolicy(): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: DEFAULT_POLICY });
}

// ============================================================================
// Helpers
// ============================================================================

function extractHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/^www\./, '');
}

function matchesWildcard(hostname: string, patterns: string[]): boolean {
  return patterns.some(pattern => {
    // Convert wildcard pattern to regex
    const regex = new RegExp(
      '^' + pattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*') + '$'
    );
    return regex.test(hostname);
  });
}

function getApprovalReason(action: RiskyActionType, details?: Record<string, unknown>): string {
  const reasons: Record<RiskyActionType, string> = {
    'form-submit': 'Form submission may modify data or navigate away',
    'navigation': 'Navigation will leave the current page',
    'download': 'File download will be initiated',
    'payment': 'Payment-related action detected',
    'file-upload': 'File will be uploaded from your computer',
    'password-input': 'Sensitive field (password) interaction',
    'sensitive-extract': 'Extracting potentially sensitive data',
  };
  
  let reason = reasons[action];
  
  if (details?.['url']) {
    reason += ` (${details['url']})`;
  }
  
  return reason;
}
