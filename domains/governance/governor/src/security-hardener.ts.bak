/**
 * Advanced Security Hardening Implementation
 * 
 * Implements advanced security measures, threat detection, authentication mechanisms,
 * and security monitoring for the A2R platform.
 */

export interface SecurityThreat {
  id: string;
  type: 'malicious_tool_call' | 'unauthorized_access' | 'policy_violation' | 'resource_abuse' | 'data_leakage';
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  source: string; // Agent ID, IP, etc.
  target: string; // Target of the threat
  details: string;
  status: 'detected' | 'investigating' | 'mitigated' | 'false_positive';
}

export interface AuthenticationToken {
  id: string;
  userId: string;
  sessionId: string;
  issuedAt: number;
  expiresAt: number;
  scopes: string[];
  status: 'valid' | 'expired' | 'revoked';
}

export interface SecurityPolicy {
  id: string;
  name: string;
  description: string;
  rules: SecurityRule[];
  priority: number;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface SecurityRule {
  id: string;
  condition: string; // Expression to evaluate
  action: 'allow' | 'deny' | 'monitor' | 'alert';
  metadata: {
    category: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
  };
}

export interface SecurityAlert {
  id: string;
  threatId: string;
  policyId: string;
  timestamp: number;
  message: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  resolution?: string;
}

export interface AuthChallenge {
  challenge: string;
  issuedAt: number;
  expiresAt: number;
  userId: string;
}

export class SecurityHardener {
  private threats: Map<string, SecurityThreat> = new Map();
  private tokens: Map<string, AuthenticationToken> = new Map();
  private policies: Map<string, SecurityPolicy> = new Map();
  private alerts: Map<string, SecurityAlert> = new Map();
  private authChallenges: Map<string, AuthChallenge> = new Map();
  private securityLog: SecurityThreat[] = [];
  private maxLogSize: number = 10000;

  constructor() {
    // Initialize default security policies
    this.initializeDefaultPolicies();
  }

  /**
   * Initialize default security policies
   */
  private initializeDefaultPolicies(): void {
    const defaultPolicies: SecurityPolicy[] = [
      {
        id: 'policy-001',
        name: 'Default Tool Access Policy',
        description: 'Controls access to tools based on security level',
        rules: [
          {
            id: 'rule-001',
            condition: 'tool.name == "shell" || tool.name == "exec"',
            action: 'deny',
            metadata: {
              category: 'execution',
              severity: 'high',
              description: 'Block direct shell execution'
            }
          },
          {
            id: 'rule-002',
            condition: 'tool.name == "fs.write" && tool.args.path.startsWith("/sys/")',
            action: 'deny',
            metadata: {
              category: 'file-access',
              severity: 'critical',
              description: 'Block writes to system directories'
            }
          },
          {
            id: 'rule-003',
            condition: 'tool.name == "fs.read" && tool.args.path.includes("../")',
            action: 'deny',
            metadata: {
              category: 'file-access',
              severity: 'high',
              description: 'Block path traversal attacks'
            }
          }
        ],
        priority: 100,
        enabled: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        id: 'policy-002',
        name: 'Resource Usage Policy',
        description: 'Limits resource consumption by agents',
        rules: [
          {
            id: 'rule-010',
            condition: 'resource.cpu > 80',
            action: 'monitor',
            metadata: {
              category: 'resource',
              severity: 'medium',
              description: 'Monitor high CPU usage'
            }
          },
          {
            id: 'rule-011',
            condition: 'resource.memory > 85',
            action: 'monitor',
            metadata: {
              category: 'resource',
              severity: 'medium',
              description: 'Monitor high memory usage'
            }
          }
        ],
        priority: 90,
        enabled: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    ];

    for (const policy of defaultPolicies) {
      this.policies.set(policy.id, policy);
    }
  }

  /**
   * Evaluate a security policy against a context
   */
  async evaluatePolicy(context: any): Promise<'allow' | 'deny' | 'monitor' | 'alert'> {
    // Get all enabled policies sorted by priority (highest first)
    const activePolicies = Array.from(this.policies.values())
      .filter(policy => policy.enabled)
      .sort((a, b) => b.priority - a.priority);

    for (const policy of activePolicies) {
      for (const rule of policy.rules) {
        try {
          // In a real implementation, this would evaluate the condition expression
          // For now, we'll simulate evaluation
          const shouldApply = this.evaluateCondition(rule.condition, context);
          if (shouldApply) {
            return rule.action;
          }
        } catch (error) {
          console.error(`Error evaluating security rule ${rule.id}:`, error);
          // Default to deny on error for security
          return 'deny';
        }
      }
    }

    // Default to allow if no policy applies
    return 'allow';
  }

  /**
   * Evaluate a condition expression against context
   * NOTE: In a real implementation, this would use a safe expression evaluator
   */
  private evaluateCondition(condition: string, context: any): boolean {
    // This is a simplified condition evaluator for demonstration
    // In a real implementation, use a safe expression evaluator library
    
    // Example conditions that might be evaluated:
    if (condition.includes('tool.name == "shell"')) {
      return context.tool?.name === 'shell';
    }
    if (condition.includes('tool.args.path.startsWith("/sys/")')) {
      return context.tool?.args?.path?.startsWith('/sys/');
    }
    if (condition.includes('tool.args.path.includes("../")')) {
      return context.tool?.args?.path?.includes('../');
    }
    if (condition.includes('resource.cpu > 80')) {
      return context.resource?.cpu > 80;
    }
    if (condition.includes('resource.memory > 85')) {
      return context.resource?.memory > 85;
    }

    // Default to false for unrecognized conditions
    return false;
  }

  /**
   * Detect and log security threats
   */
  async detectThreat(threat: Omit<SecurityThreat, 'id' | 'timestamp' | 'status'>): Promise<string> {
    const threatId = `threat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const newThreat: SecurityThreat = {
      id: threatId,
      ...threat,
      timestamp: Date.now(),
      status: 'detected'
    };

    this.threats.set(threatId, newThreat);
    this.securityLog.push(newThreat);

    // Keep log size manageable
    if (this.securityLog.length > this.maxLogSize) {
      this.securityLog = this.securityLog.slice(-this.maxLogSize);
    }

    // Generate alert if severity is medium or higher
    if (newThreat.severity !== 'low') {
      await this.generateAlert(threatId);
    }

    return threatId;
  }

  /**
   * Generate a security alert for a detected threat
   */
  private async generateAlert(threatId: string): Promise<void> {
    const threat = this.threats.get(threatId);
    if (!threat) return;

    // Find applicable policy
    let policyId = 'unknown';
    for (const [id, policy] of this.policies.entries()) {
      for (const rule of policy.rules) {
        // In a real implementation, match the threat to the rule that triggered it
        if (threat.details.includes(rule.id)) {
          policyId = id;
          break;
        }
      }
      if (policyId !== 'unknown') break;
    }

    const alertId = `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const alert: SecurityAlert = {
      id: alertId,
      threatId,
      policyId,
      timestamp: Date.now(),
      message: `Security threat detected: ${threat.type} - ${threat.details}`,
      acknowledged: false
    };

    this.alerts.set(alertId, alert);

    // Log to console for now (in real implementation, send to security monitoring system)
    console.warn(`[SECURITY ALERT] ${alert.message}`);
  }

  /**
   * Create an authentication token
   */
  async createAuthToken(userId: string, sessionId: string, scopes: string[], ttlMinutes: number = 60): Promise<AuthenticationToken> {
    const tokenId = `token-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const issuedAt = Date.now();
    const expiresAt = issuedAt + (ttlMinutes * 60 * 1000);

    const token: AuthenticationToken = {
      id: tokenId,
      userId,
      sessionId,
      issuedAt,
      expiresAt,
      scopes,
      status: 'valid'
    };

    this.tokens.set(tokenId, token);
    return token;
  }

  /**
   * Validate an authentication token
   */
  async validateToken(tokenId: string): Promise<boolean> {
    const token = this.tokens.get(tokenId);
    if (!token) {
      return false;
    }

    if (token.status !== 'valid') {
      return false;
    }

    if (token.expiresAt < Date.now()) {
      // Token expired, update status
      token.status = 'expired';
      this.tokens.set(tokenId, token);
      return false;
    }

    return true;
  }

  /**
   * Revoke an authentication token
   */
  async revokeToken(tokenId: string): Promise<void> {
    const token = this.tokens.get(tokenId);
    if (token) {
      token.status = 'revoked';
      this.tokens.set(tokenId, token);
    }
  }

  /**
   * Create an authentication challenge (for multi-factor auth)
   */
  async createAuthChallenge(userId: string, ttlSeconds: number = 300): Promise<string> {
    const challenge = `challenge-${Math.random().toString(36).substr(2, 12)}`;
    const issuedAt = Date.now();
    const expiresAt = issuedAt + (ttlSeconds * 1000);

    const authChallenge: AuthChallenge = {
      challenge,
      issuedAt,
      expiresAt,
      userId
    };

    this.authChallenges.set(challenge, authChallenge);
    return challenge;
  }

  /**
   * Validate an authentication challenge response
   */
  async validateChallengeResponse(challenge: string, response: string): Promise<boolean> {
    const authChallenge = this.authChallenges.get(challenge);
    if (!authChallenge) {
      return false;
    }

    if (authChallenge.expiresAt < Date.now()) {
      // Challenge expired, remove it
      this.authChallenges.delete(challenge);
      return false;
    }

    // In a real implementation, this would validate the cryptographic response
    // For now, we'll just check if the response matches the challenge (not secure!)
    const isValid = response === `valid_${challenge}`; // Simplified for demo

    if (isValid) {
      // Remove the challenge after successful validation
      this.authChallenges.delete(challenge);
    }

    return isValid;
  }

  /**
   * Get security audit trail
   */
  getSecurityAuditTrail(): SecurityThreat[] {
    return [...this.securityLog].sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get active security alerts
   */
  getActiveAlerts(): SecurityAlert[] {
    return Array.from(this.alerts.values())
      .filter(alert => !alert.acknowledged)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Acknowledge a security alert
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string, resolution?: string): void {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedBy = acknowledgedBy;
      if (resolution) {
        alert.resolution = resolution;
      }
    }
  }

  /**
   * Apply security hardening to a tool execution request
   */
  async applySecurityHardening(context: {
    agentId: string;
    toolName: string;
    toolArgs: any;
    sessionId: string;
  }): Promise<{ allowed: boolean; reason?: string; mitigated?: boolean }> {
    // First, validate the session token
    const validTokens = Array.from(this.tokens.values()).filter(
      token => token.sessionId === context.sessionId && token.status === 'valid'
    );
    
    if (validTokens.length === 0) {
      return { allowed: false, reason: 'Invalid or expired session token' };
    }

    // Evaluate security policy
    const policyResult = await this.evaluatePolicy({
      tool: { name: context.toolName, args: context.toolArgs },
      agent: { id: context.agentId },
      session: { id: context.sessionId }
    });

    if (policyResult === 'deny') {
      await this.detectThreat({
        type: 'policy_violation',
        severity: 'high',
        source: context.agentId,
        target: context.toolName,
        details: `Policy violation: ${context.agentId} attempted to use ${context.toolName}`
      });
      
      return { allowed: false, reason: 'Policy violation - access denied' };
    }

    // For monitor actions, log the activity
    if (policyResult === 'monitor') {
      console.log(`[MONITOR] Agent ${context.agentId} using tool ${context.toolName}`);
    }

    // For alert actions, generate an alert
    if (policyResult === 'alert') {
      await this.detectThreat({
        type: 'policy_violation',
        severity: 'medium',
        source: context.agentId,
        target: context.toolName,
        details: `Monitored activity: ${context.agentId} used ${context.toolName}`
      });
    }

    return { allowed: true };
  }

  /**
   * Perform security scan on a code snippet
   */
  async scanCodeForSecurityIssues(code: string): Promise<SecurityThreat[]> {
    const threats: SecurityThreat[] = [];
    
    // Look for potentially dangerous patterns
    const dangerousPatterns = [
      { pattern: /exec\(/gi, type: 'malicious_tool_call', severity: 'high', desc: 'Direct execution function' },
      { pattern: /eval\(/gi, type: 'malicious_tool_call', severity: 'high', desc: 'Code evaluation function' },
      { pattern: /system\(/gi, type: 'malicious_tool_call', severity: 'high', desc: 'System execution function' },
      { pattern: /require\(['"`][^'"`]*\.json['"`]\)/gi, type: 'data_leakage', severity: 'medium', desc: 'External file access' },
      { pattern: /fs\.write/gi, type: 'malicious_tool_call', severity: 'high', desc: 'File system write operation' },
      { pattern: /child_process/gi, type: 'malicious_tool_call', severity: 'high', desc: 'Child process creation' },
      { pattern: /process\.env/gi, type: 'data_leakage', severity: 'medium', desc: 'Environment variable access' }
    ];

    for (const patternInfo of dangerousPatterns) {
      const matches = code.match(patternInfo.pattern) || [];
      if (matches.length > 0) {
        threats.push({
          id: `threat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: patternInfo.type as SecurityThreat['type'],
          severity: patternInfo.severity as SecurityThreat['severity'],
          timestamp: Date.now(),
          source: 'code-scanner',
          target: 'code-analysis',
          details: `${patternInfo.desc}: ${matches.length} occurrences found`,
          status: 'detected'
        });
      }
    }

    return threats;
  }

  /**
   * Update a security policy
   */
  async updateSecurityPolicy(policyId: string, updates: Partial<SecurityPolicy>): Promise<boolean> {
    const policy = this.policies.get(policyId);
    if (!policy) {
      return false;
    }

    // Update only allowed fields
    if (updates.name !== undefined) policy.name = updates.name;
    if (updates.description !== undefined) policy.description = updates.description;
    if (updates.rules !== undefined) policy.rules = updates.rules;
    if (updates.priority !== undefined) policy.priority = updates.priority;
    if (updates.enabled !== undefined) policy.enabled = updates.enabled;
    policy.updatedAt = Date.now();

    this.policies.set(policyId, policy);
    return true;
  }

  /**
   * Get security statistics
   */
  getSecurityStats(): {
    totalThreats: number;
    activeAlerts: number;
    totalPolicies: number;
    validTokens: number;
    expiredTokens: number;
    revokedTokens: number;
    threatsBySeverity: Record<string, number>;
    threatsByType: Record<string, number>;
  } {
    const threats = Array.from(this.threats.values());
    const alerts = Array.from(this.alerts.values()).filter(a => !a.acknowledged);
    const tokens = Array.from(this.tokens.values());

    const threatsBySeverity: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    const threatsByType: Record<string, number> = {};

    for (const threat of threats) {
      threatsBySeverity[threat.severity]++;
      threatsByType[threat.type] = (threatsByType[threat.type] || 0) + 1;
    }

    const validTokens = tokens.filter(t => t.status === 'valid').length;
    const expiredTokens = tokens.filter(t => t.status === 'expired').length;
    const revokedTokens = tokens.filter(t => t.status === 'revoked').length;

    return {
      totalThreats: threats.length,
      activeAlerts: alerts.length,
      totalPolicies: this.policies.size,
      validTokens,
      expiredTokens,
      revokedTokens,
      threatsBySeverity,
      threatsByType
    };
  }
}

// Global security hardener instance
const globalSecurityHardener = new SecurityHardener();

export { globalSecurityHardener };