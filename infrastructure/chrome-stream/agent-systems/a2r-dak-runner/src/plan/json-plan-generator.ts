/**
 * JSON Plan Generation
 * 
 * Generates structured JSON plans from natural language intents.
 * Uses constrained grammar for reliable parsing by the UI.
 * 
 * Plan Schema:
 * {
 *   id: string,
 *   goal: string,
 *   steps: Array<{
 *     id: string,
 *     title: string,
 *     description?: string,
 *     backend: string,
 *     risk: 'low' | 'medium' | 'high',
 *     tool?: string,
 *     parameters?: Record<string, unknown>
 *   }>,
 *   risk: 'low' | 'medium' | 'high',
 *   backend: string,
 *   estimatedDuration?: number
 * }
 */

import { EventEmitter } from 'events';

/**
 * Plan step definition
 */
export interface PlanStep {
  id: string;
  title: string;
  description?: string;
  backend: string;
  risk: 'low' | 'medium' | 'high';
  tool?: string;
  parameters?: Record<string, unknown>;
  estimatedDurationMs?: number;
}

/**
 * Complete plan structure
 */
export interface RunnerPlan {
  id: string;
  goal: string;
  steps: PlanStep[];
  risk: 'low' | 'medium' | 'high';
  backend: string;
  estimatedDurationMs?: number;
  metadata?: {
    modelId?: string;
    generatedAt?: number;
    context?: Record<string, unknown>;
  };
}

/**
 * Plan generation options
 */
export interface PlanGenerationOptions {
  intent: string;
  context: Record<string, unknown>;
  targetSystem: string;
  backend: string;
  modelId?: string;
  maxSteps?: number;
}

/**
 * Plan generator using LLM with JSON schema constraint
 */
export class PlanGenerator extends EventEmitter {
  private systemPrompt: string;
  private jsonSchema: Record<string, unknown>;

  constructor() {
    super();
    
    this.systemPrompt = `You are a task planning assistant. Generate a structured JSON plan for executing the user's request.

CONSTRAINTS:
1. Output MUST be valid JSON matching the schema below
2. Do not include any text outside the JSON object
3. Do not include markdown code blocks or formatting
4. Use only the specified backend types: connector, browser_automation, electron_native, os_automation, file_system
5. Risk levels must be: low, medium, high
6. Each step must have a unique ID (step_1, step_2, etc.)

BACKEND SELECTION RULES:
- Use 'connector' when API access is available (Canvas API, etc.)
- Use 'browser_automation' for web UI interactions
- Use 'electron_native' for owned Electron applications
- Use 'os_automation' for desktop-level operations
- Use 'file_system' for local file operations

RISK ASSESSMENT:
- low: Read-only operations, no data modification
- medium: Write operations with user confirmation
- high: Destructive operations, bulk changes, external communications

JSON Schema:
{
  "type": "object",
  "required": ["id", "goal", "steps", "risk", "backend"],
  "properties": {
    "id": {"type": "string"},
    "goal": {"type": "string"},
    "steps": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "title", "backend", "risk"],
        "properties": {
          "id": {"type": "string"},
          "title": {"type": "string"},
          "description": {"type": "string"},
          "backend": {"type": "string", "enum": ["connector", "browser_automation", "electron_native", "os_automation", "file_system"]},
          "risk": {"type": "string", "enum": ["low", "medium", "high"]},
          "tool": {"type": "string"},
          "parameters": {"type": "object"},
          "estimatedDurationMs": {"type": "number"}
        }
      }
    },
    "risk": {"type": "string", "enum": ["low", "medium", "high"]},
    "backend": {"type": "string"},
    "estimatedDurationMs": {"type": "number"}
  }
}`;

    this.jsonSchema = {
      type: 'object',
      required: ['id', 'goal', 'steps', 'risk', 'backend'],
      properties: {
        id: { type: 'string' },
        goal: { type: 'string' },
        steps: {
          type: 'array',
          items: {
            type: 'object',
            required: ['id', 'title', 'backend', 'risk'],
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              description: { type: 'string' },
              backend: { 
                type: 'string', 
                enum: ['connector', 'browser_automation', 'electron_native', 'os_automation', 'file_system'] 
              },
              risk: { type: 'string', enum: ['low', 'medium', 'high'] },
              tool: { type: 'string' },
              parameters: { type: 'object' },
              estimatedDurationMs: { type: 'number' },
            },
          },
        },
        risk: { type: 'string', enum: ['low', 'medium', 'high'] },
        backend: { type: 'string' },
        estimatedDurationMs: { type: 'number' },
      },
    };
  }

  /**
   * Generate a plan from natural language intent
   */
  async generatePlan(options: PlanGenerationOptions): Promise<RunnerPlan> {
    this.emit('plan:generating', options);

    const { intent, context, targetSystem, backend, modelId } = options;
    const maxSteps = options.maxSteps || 10;

    try {
      // For MVP, use template-based plan generation
      // In production, this would call an LLM with JSON schema constraint
      const plan = await this.generateTemplatePlan(intent, context, targetSystem, backend, maxSteps);
      
      plan.id = `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      plan.metadata = {
        modelId,
        generatedAt: Date.now(),
        context,
      };

      this.emit('plan:generated', plan);
      return plan;
    } catch (error: any) {
      this.emit('plan:error', { error: error.message, options });
      throw error;
    }
  }

  /**
   * Generate plan using templates (MVP approach)
   */
  private async generateTemplatePlan(
    intent: string,
    context: Record<string, unknown>,
    targetSystem: string,
    backend: string,
    maxSteps: number
  ): Promise<RunnerPlan> {
    const lowerIntent = intent.toLowerCase();

    // Canvas module creation template
    if (targetSystem === 'Canvas' && lowerIntent.includes('module')) {
      return this.createCanvasModulePlan(intent, context, backend);
    }

    // Canvas page creation template
    if (targetSystem === 'Canvas' && lowerIntent.includes('page')) {
      return this.createCanvasPagePlan(intent, context, backend);
    }

    // Canvas assignment creation template
    if (targetSystem === 'Canvas' && lowerIntent.includes('assignment')) {
      return this.createCanvasAssignmentPlan(intent, context, backend);
    }

    // Generic web automation template
    if (backend === 'browser_automation') {
      return this.createGenericWebPlan(intent, context, maxSteps);
    }

    // Default fallback plan
    return this.createDefaultPlan(intent, backend);
  }

  /**
   * Canvas module creation plan
   */
  private createCanvasModulePlan(
    intent: string,
    context: Record<string, unknown>,
    backend: string
  ): RunnerPlan {
    const steps: PlanStep[] = [
      {
        id: 'step_1',
        title: 'Inspect Canvas course context',
        description: 'Detect current course and verify access',
        backend: backend === 'connector' ? 'connector' : 'browser_automation',
        risk: 'low',
        tool: backend === 'connector' ? 'canvas.list_courses' : 'browser.navigate',
        estimatedDurationMs: 2000,
      },
      {
        id: 'step_2',
        title: 'Navigate to modules page',
        description: 'Open course modules section',
        backend: 'browser_automation',
        risk: 'low',
        tool: 'browser.navigate',
        estimatedDurationMs: 1500,
      },
      {
        id: 'step_3',
        title: 'Create new module',
        description: 'Add module with specified name',
        backend,
        risk: 'medium',
        tool: backend === 'connector' ? 'canvas.create_module' : 'browser.fillForm',
        estimatedDurationMs: 3000,
      },
      {
        id: 'step_4',
        title: 'Verify module creation',
        description: 'Confirm module appears in course',
        backend: 'browser_automation',
        risk: 'low',
        tool: 'browser.verify',
        estimatedDurationMs: 1000,
      },
    ];

    const planId = `plan_canvas_module_${Date.now()}`;
    return {
      id: planId,
      goal: intent,
      steps,
      risk: 'medium',
      backend,
      estimatedDurationMs: steps.reduce((sum, s) => sum + (s.estimatedDurationMs || 0), 0),
    };
  }

  /**
   * Canvas page creation plan
   */
  private createCanvasPagePlan(
    intent: string,
    context: Record<string, unknown>,
    backend: string
  ): RunnerPlan {
    const steps: PlanStep[] = [
      {
        id: 'step_1',
        title: 'Navigate to course pages',
        description: 'Open course pages section',
        backend: 'browser_automation',
        risk: 'low',
        tool: 'browser.navigate',
        estimatedDurationMs: 1500,
      },
      {
        id: 'step_2',
        title: 'Create new page',
        description: 'Click new page button and fill content',
        backend,
        risk: 'medium',
        tool: backend === 'connector' ? 'canvas.create_page' : 'browser.fillForm',
        estimatedDurationMs: 4000,
      },
      {
        id: 'step_3',
        title: 'Verify page creation',
        description: 'Confirm page is accessible',
        backend: 'browser_automation',
        risk: 'low',
        tool: 'browser.verify',
        estimatedDurationMs: 1000,
      },
    ];

    const planId = `plan_canvas_page_${Date.now()}`;
    return {
      id: planId,
      goal: intent,
      steps,
      risk: 'medium',
      backend,
      estimatedDurationMs: steps.reduce((sum, s) => sum + (s.estimatedDurationMs || 0), 0),
    };
  }

  /**
   * Canvas assignment creation plan
   */
  private createCanvasAssignmentPlan(
    intent: string,
    context: Record<string, unknown>,
    backend: string
  ): RunnerPlan {
    const steps: PlanStep[] = [
      {
        id: 'step_1',
        title: 'Navigate to assignments',
        description: 'Open course assignments section',
        backend: 'browser_automation',
        risk: 'low',
        tool: 'browser.navigate',
        estimatedDurationMs: 1500,
      },
      {
        id: 'step_2',
        title: 'Create new assignment',
        description: 'Fill assignment details (name, description, points, due date)',
        backend,
        risk: 'medium',
        tool: backend === 'connector' ? 'canvas.create_assignment' : 'browser.fillForm',
        estimatedDurationMs: 5000,
      },
      {
        id: 'step_3',
        title: 'Verify assignment',
        description: 'Confirm assignment is created and visible',
        backend: 'browser_automation',
        risk: 'low',
        tool: 'browser.verify',
        estimatedDurationMs: 1000,
      },
    ];

    const planId = `plan_canvas_assignment_${Date.now()}`;
    return {
      id: planId,
      goal: intent,
      steps,
      risk: 'medium',
      backend,
      estimatedDurationMs: steps.reduce((sum, s) => sum + (s.estimatedDurationMs || 0), 0),
    };
  }

  /**
   * Generic web automation plan
   */
  private createGenericWebPlan(
    intent: string,
    context: Record<string, unknown>,
    maxSteps: number
  ): RunnerPlan {
    const steps: PlanStep[] = [
      {
        id: 'step_1',
        title: 'Navigate to target page',
        description: 'Open the specified URL',
        backend: 'browser_automation',
        risk: 'low',
        tool: 'browser.navigate',
        estimatedDurationMs: 2000,
      },
      {
        id: 'step_2',
        title: 'Analyze page structure',
        description: 'Identify relevant elements for interaction',
        backend: 'browser_automation',
        risk: 'low',
        tool: 'browser.inspect',
        estimatedDurationMs: 1500,
      },
      {
        id: 'step_3',
        title: 'Execute action',
        description: intent,
        backend: 'browser_automation',
        risk: 'medium',
        tool: 'browser.interact',
        estimatedDurationMs: 3000,
      },
      {
        id: 'step_4',
        title: 'Verify result',
        description: 'Confirm action succeeded',
        backend: 'browser_automation',
        risk: 'low',
        tool: 'browser.verify',
        estimatedDurationMs: 1000,
      },
    ];

    const planId = `plan_generic_web_${Date.now()}`;
    return {
      id: planId,
      goal: intent,
      steps: steps.slice(0, maxSteps),
      risk: 'medium',
      backend: 'browser_automation',
      estimatedDurationMs: steps.reduce((sum, s) => sum + (s.estimatedDurationMs || 0), 0),
    };
  }

  /**
   * Default fallback plan
   */
  private createDefaultPlan(intent: string, backend: string): RunnerPlan {
    const steps: PlanStep[] = [
      {
        id: 'step_1',
        title: 'Analyze request',
        description: 'Understand the task requirements',
        backend,
        risk: 'low',
        estimatedDurationMs: 1000,
      },
      {
        id: 'step_2',
        title: 'Execute task',
        description: intent,
        backend,
        risk: 'medium',
        estimatedDurationMs: 3000,
      },
      {
        id: 'step_3',
        title: 'Verify completion',
        description: 'Confirm task completed successfully',
        backend,
        risk: 'low',
        estimatedDurationMs: 1000,
      },
    ];

    const planId = `plan_default_${Date.now()}`;
    return {
      id: planId,
      goal: intent,
      steps,
      risk: 'medium',
      backend,
      estimatedDurationMs: steps.reduce((sum, s) => sum + (s.estimatedDurationMs || 0), 0),
    };
  }

  /**
   * Validate plan against schema
   */
  validatePlan(plan: unknown): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const p = plan as Record<string, unknown>;

    // Check required fields
    const requiredFields = ['id', 'goal', 'steps', 'risk', 'backend'];
    for (const field of requiredFields) {
      if (!p[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // Validate steps
    if (Array.isArray(p.steps)) {
      for (let i = 0; i < p.steps.length; i++) {
        const step = p.steps[i] as Record<string, unknown>;
        const stepRequired = ['id', 'title', 'backend', 'risk'];
        for (const field of stepRequired) {
          if (!step[field]) {
            errors.push(`Step ${i}: Missing required field: ${field}`);
          }
        }

        // Validate backend enum
        const validBackends = ['connector', 'browser_automation', 'electron_native', 'os_automation', 'file_system'];
        if (step.backend && !validBackends.includes(step.backend as string)) {
          errors.push(`Step ${i}: Invalid backend: ${step.backend}`);
        }

        // Validate risk enum
        const validRisks = ['low', 'medium', 'high'];
        if (step.risk && !validRisks.includes(step.risk as string)) {
          errors.push(`Step ${i}: Invalid risk: ${step.risk}`);
        }
      }
    }

    // Validate top-level enums
    const validRisks = ['low', 'medium', 'high'];
    if (p.risk && !validRisks.includes(p.risk as string)) {
      errors.push(`Invalid risk: ${p.risk}`);
    }

    const validBackends = ['connector', 'browser_automation', 'electron_native', 'os_automation', 'file_system'];
    if (p.backend && !validBackends.includes(p.backend as string)) {
      errors.push(`Invalid backend: ${p.backend}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Parse JSON plan from string (with error recovery)
   */
  parsePlanJson(jsonString: string): { plan?: RunnerPlan; error?: string } {
    try {
      // Try direct parse
      const plan = JSON.parse(jsonString);
      const validation = this.validatePlan(plan);
      
      if (!validation.valid) {
        return { plan, error: `Invalid plan schema: ${validation.errors.join(', ')}` };
      }
      
      return { plan: plan as RunnerPlan };
    } catch (parseError: any) {
      // Try to extract JSON from markdown code block
      const jsonMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        try {
          const plan = JSON.parse(jsonMatch[1]);
          const validation = this.validatePlan(plan);
          
          if (!validation.valid) {
            return { plan, error: `Invalid plan schema: ${validation.errors.join(', ')}` };
          }
          
          return { plan: plan as RunnerPlan };
        } catch {
          return { error: `Failed to parse JSON from markdown: ${parseError.message}` };
        }
      }

      return { error: `Failed to parse plan JSON: ${parseError.message}` };
    }
  }
}

/**
 * Factory function to create plan generator
 */
export function createPlanGenerator(): PlanGenerator {
  return new PlanGenerator();
}
