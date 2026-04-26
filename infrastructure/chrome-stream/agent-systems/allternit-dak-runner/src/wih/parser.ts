/**
 * WIH Parser
 * 
 * Parses WIH Markdown files with YAML front matter.
 * Based on agent/Agentic Prompts/formats/wih-scheme.md
 */

import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { WIH, WIHScope, WIHOutputs, AcceptanceCriteria, Blockers, StopConditions } from './types';

export interface ParseOptions {
  validate?: boolean;
  basePath?: string;
}

export class WIHParser {
  /**
   * Parse WIH from string content
   */
  parse(content: string, options: ParseOptions = {}): WIH {
    const { frontMatter, body } = this.extractFrontMatter(content);
    
    const parsed = yaml.load(frontMatter) as any;
    
    if (options.validate !== false) {
      this.validate(parsed);
    }

    return this.transform(parsed, body, options.basePath);
  }

  /**
   * Parse WIH from file
   */
  parseFile(filePath: string, options: ParseOptions = {}): WIH {
    const content = fs.readFileSync(filePath, 'utf-8');
    return this.parse(content, { ...options, basePath: filePath });
  }

  /**
   * Extract YAML front matter and body from markdown
   */
  private extractFrontMatter(content: string): { frontMatter: string; body: string } {
    const lines = content.split('\n');
    
    // Check for front matter delimiter
    if (lines[0] !== '---') {
      throw new Error('WIH must start with YAML front matter (---)');
    }

    // Find end of front matter
    let frontMatterEnd = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i] === '---') {
        frontMatterEnd = i;
        break;
      }
    }

    if (frontMatterEnd === -1) {
      throw new Error('YAML front matter not closed (missing ---)');
    }

    const frontMatter = lines.slice(1, frontMatterEnd).join('\n');
    const body = lines.slice(frontMatterEnd + 1).join('\n').trim();

    return { frontMatter, body };
  }

  /**
   * Validate raw parsed YAML
   */
  private validate(parsed: any): void {
    if (!parsed) {
      throw new Error('Empty WIH content');
    }

    // Required fields
    if (parsed.wih_version === undefined) {
      throw new Error('Missing required field: wih_version');
    }

    if (!parsed.work_item_id) {
      throw new Error('Missing required field: work_item_id');
    }

    if (!parsed.title) {
      throw new Error('Missing required field: title');
    }

    if (!parsed.owner_role) {
      throw new Error('Missing required field: owner_role');
    }

    // Validate scope
    if (!parsed.scope) {
      throw new Error('Missing required field: scope');
    }

    if (!Array.isArray(parsed.scope.allowed_paths)) {
      throw new Error('scope.allowed_paths must be an array');
    }

    if (!Array.isArray(parsed.scope.allowed_tools)) {
      throw new Error('scope.allowed_tools must be an array');
    }

    if (!parsed.scope.execution_permission) {
      throw new Error('Missing required field: scope.execution_permission');
    }

    // Validate outputs
    if (!parsed.outputs) {
      throw new Error('Missing required field: outputs');
    }

    if (!Array.isArray(parsed.outputs.required_reports)) {
      throw new Error('outputs.required_reports must be an array');
    }

    // Validate execution_permission mode
    const validModes = ['read_only', 'write_leased', 'yolo'];
    if (!validModes.includes(parsed.scope.execution_permission.mode)) {
      throw new Error(
        `Invalid execution_permission.mode: ${parsed.scope.execution_permission.mode}. ` +
        `Valid modes: ${validModes.join(', ')}`
      );
    }

    // Validate stop_conditions.max_iterations
    if (parsed.stop_conditions?.max_iterations !== undefined) {
      const maxIter = parsed.stop_conditions.max_iterations;
      if (!Number.isInteger(maxIter) || maxIter < 1) {
        throw new Error('stop_conditions.max_iterations must be a positive integer');
      }
    }
  }

  /**
   * Transform raw YAML to typed WIH
   */
  private transform(parsed: any, body: string, sourcePath?: string): WIH {
    return {
      wih_version: parsed.wih_version,
      work_item_id: parsed.work_item_id,
      title: parsed.title,
      owner_role: parsed.owner_role,
      assigned_roles: parsed.assigned_roles || {},
      inputs: {
        sot: parsed.inputs?.sot,
        requirements: parsed.inputs?.requirements || [],
        contracts: parsed.inputs?.contracts || [],
        context_packs: parsed.inputs?.context_packs || [],
        artifacts_from_deps: parsed.inputs?.artifacts_from_deps || [],
      },
      scope: this.transformScope(parsed.scope),
      outputs: this.transformOutputs(parsed.outputs),
      acceptance: this.transformAcceptance(parsed.acceptance),
      blockers: this.transformBlockers(parsed.blockers),
      stop_conditions: this.transformStopConditions(parsed.stop_conditions),
      body: body || undefined,
      source_path: sourcePath,
    };
  }

  private transformScope(scope: any): WIHScope {
    return {
      allowed_paths: scope.allowed_paths || [],
      forbidden_paths: scope.forbidden_paths || [],
      allowed_tools: scope.allowed_tools || [],
      forbidden_tools: scope.forbidden_tools || [],
      execution_permission: {
        mode: scope.execution_permission.mode,
        flags: scope.execution_permission.flags || [],
      },
    };
  }

  private transformOutputs(outputs: any): WIHOutputs {
    return {
      required_artifacts: outputs.required_artifacts || [],
      required_reports: outputs.required_reports || ['build_report.md', 'validator_report.md'],
      artifact_root_policy: {
        durable_outputs_via: outputs.artifact_root_policy?.durable_outputs_via || 'rails',
        local_workspace_root: outputs.artifact_root_policy?.local_workspace_root || '.allternit/out/{{run_id}}/',
        forbid_repo_writes_by_default: outputs.artifact_root_policy?.forbid_repo_writes_by_default ?? true,
      },
    };
  }

  private transformAcceptance(acceptance: any): AcceptanceCriteria {
    return {
      tests: acceptance?.tests || [],
      invariants: acceptance?.invariants || [],
      evidence: acceptance?.evidence || ['validator_report.md'],
    };
  }

  private transformBlockers(blockers: any): Blockers {
    return {
      fail_on: blockers?.fail_on || ['policy_violation', 'test_failure'],
    };
  }

  private transformStopConditions(stopConditions: any): StopConditions {
    return {
      escalate_if: stopConditions?.escalate_if || ['ambiguous_requirement'],
      max_iterations: stopConditions?.max_iterations || 3,
    };
  }

  /**
   * Serialize WIH to string with YAML front matter
   */
  serialize(wih: WIH): string {
    const obj = {
      wih_version: wih.wih_version,
      work_item_id: wih.work_item_id,
      title: wih.title,
      owner_role: wih.owner_role,
      assigned_roles: wih.assigned_roles,
      inputs: {
        ...(wih.inputs.sot && { sot: wih.inputs.sot }),
        ...(wih.inputs.requirements?.length && { requirements: wih.inputs.requirements }),
        ...(wih.inputs.contracts?.length && { contracts: wih.inputs.contracts }),
        ...(wih.inputs.context_packs?.length && { context_packs: wih.inputs.context_packs }),
        ...(wih.inputs.artifacts_from_deps?.length && { artifacts_from_deps: wih.inputs.artifacts_from_deps }),
      },
      scope: {
        allowed_paths: wih.scope.allowed_paths,
        forbidden_paths: wih.scope.forbidden_paths,
        allowed_tools: wih.scope.allowed_tools,
        forbidden_tools: wih.scope.forbidden_tools,
        execution_permission: wih.scope.execution_permission,
      },
      outputs: {
        required_artifacts: wih.outputs.required_artifacts,
        required_reports: wih.outputs.required_reports,
        artifact_root_policy: wih.outputs.artifact_root_policy,
      },
      acceptance: {
        tests: wih.acceptance.tests,
        invariants: wih.acceptance.invariants,
        evidence: wih.acceptance.evidence,
      },
      blockers: {
        fail_on: wih.blockers.fail_on,
      },
      stop_conditions: {
        escalate_if: wih.stop_conditions.escalate_if,
        max_iterations: wih.stop_conditions.max_iterations,
      },
    };

    const yamlContent = yaml.dump(obj, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
      sortKeys: false,
    });

    let result = `---\n${yamlContent}---\n`;
    
    if (wih.body) {
      result += `\n${wih.body}\n`;
    } else {
      result += '\n# Task notes\n\n';
    }

    return result;
  }

  /**
   * Create a new WIH from template
   */
  createTemplate(workItemId: string, title: string): WIH {
    return {
      wih_version: 1,
      work_item_id: workItemId,
      title: title,
      owner_role: 'orchestrator',
      assigned_roles: {
        builder: 'agent.builder',
        validator: 'agent.validator',
      },
      inputs: {
        requirements: [],
        contracts: [],
        context_packs: [],
        artifacts_from_deps: [],
      },
      scope: {
        allowed_paths: [],
        forbidden_paths: [],
        allowed_tools: [],
        execution_permission: {
          mode: 'read_only',
        },
      },
      outputs: {
        required_artifacts: [],
        required_reports: ['build_report.md', 'validator_report.md'],
        artifact_root_policy: {
          durable_outputs_via: 'rails',
          local_workspace_root: '.allternit/out/{{run_id}}/',
          forbid_repo_writes_by_default: true,
        },
      },
      acceptance: {
        tests: [],
        invariants: [],
        evidence: ['validator_report.md'],
      },
      blockers: {
        fail_on: ['policy_violation', 'test_failure'],
      },
      stop_conditions: {
        escalate_if: ['ambiguous_requirement'],
        max_iterations: 3,
      },
      body: '# Task notes (optional)\n\nKeep notes here. YAML above is authoritative.',
    };
  }

  /**
   * Validate WIH against scope constraints
   */
  validatePathAccess(wih: WIH, path: string, operation: 'read' | 'write'): boolean {
    // Check forbidden paths first (deny takes precedence)
    for (const forbidden of wih.scope.forbidden_paths) {
      if (this.matchGlob(path, forbidden)) {
        return false;
      }
    }

    // For write operations, check allowed paths
    if (operation === 'write') {
      // Check execution permission mode
      if (wih.scope.execution_permission.mode === 'read_only') {
        return false;
      }

      // Check allowed paths
      for (const allowed of wih.scope.allowed_paths) {
        if (this.matchGlob(path, allowed)) {
          return true;
        }
      }

      // No allowed path matched
      return false;
    }

    // Read operations are allowed unless forbidden
    return true;
  }

  /**
   * Validate tool access
   */
  validateToolAccess(wih: WIH, toolName: string): boolean {
    // Check forbidden tools first
    if (wih.scope.forbidden_tools?.includes(toolName)) {
      return false;
    }

    // Check allowed tools
    return wih.scope.allowed_tools.includes(toolName) || 
           wih.scope.allowed_tools.includes('*');
  }

  /**
   * Simple glob matching
   */
  private matchGlob(path: string, pattern: string): boolean {
    const regex = pattern
      .replace(/\*\*/g, '<<<GLOBSTAR>>>')
      .replace(/\*/g, '[^/]*')
      .replace(/<<<GLOBSTAR>>>/g, '.*');
    
    return new RegExp(`^${regex}$`).test(path);
  }
}

// Factory function
export function createWIHParser(): WIHParser {
  return new WIHParser();
}
