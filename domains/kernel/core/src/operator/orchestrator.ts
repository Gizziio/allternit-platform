/**
 * Allternit Operator Orchestrator (Kernel Port)
 * 
 * Manages the high-level task lifecycle for the Thin Client Operator.
 * Integrates Vision, Browser-Use, and DAK execution.
 */

import { VisionParser } from './vision-parser.js';
import { IntegrityService } from './integrity.js';
import { DeterministicExecutionProvider } from '../dak-provider.js';
import OpenAI from 'openai';

export interface OperatorTaskRequest {
  sessionId: string;
  intent: string;
  context: any;
}

export class OperatorOrchestrator {
  private executionProvider: DeterministicExecutionProvider;
  private openai!: OpenAI;

  constructor() {
    this.executionProvider = new DeterministicExecutionProvider();
    const apiKey = process.env.ALLTERNIT_VISION_INFERENCE_KEY || process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.openai = new OpenAI({
        apiKey,
        baseURL: process.env.ALLTERNIT_VISION_INFERENCE_BASE
      });
    }
  }

  /**
   * Orchestrates a desktop/browser task with real VLM and DAK.
   */
  async *streamTask(request: OperatorTaskRequest): AsyncGenerator<any> {
    yield { type: 'status', message: 'Analyzing workspace context...' };

    // 1. Detect if Vision is needed
    const needsVision = this.detectVisionNeeded(request.intent);
    
    if (needsVision) {
      yield { type: 'status', message: 'Capturing screen for vision analysis...' };
      
      try {
        const screenshot = await this.captureScreenshot(request.sessionId);
        yield { type: 'status', message: 'Reasoning with Allternit Vision...' };
        
        const modelOutput = await this.performVlmInference(request.intent, screenshot);
        const actions = VisionParser.parseActionToStructure(modelOutput, 1080, 1920);
        
        for (const action of actions) {
          const allowed = await IntegrityService.evaluateSafety(request.sessionId, action);
          if (!allowed) {
            yield { type: 'error', message: 'Action blocked by Allternit Policy' };
            return;
          }

          yield { type: 'action', action };

          // REAL EXECUTION: Call the DAK Provider (Muscle)
          const result = await this.executionProvider.executeVerified({
            tool: action.action_type,
            arguments: action.action_inputs,
            context: { sessionId: request.sessionId, ...request.context }
          });
          
          const receipt = await IntegrityService.generateReceipt(request.sessionId, action, result);
          yield { type: 'receipt', receipt };

          if (!result.success) {
            yield { type: 'error', message: `Execution failed: ${result.error}` };
            return;
          }
        }
      } catch (err: any) {
        yield { type: 'error', message: `Vision task failed: ${err.message}` };
        return;
      }
    } else {
      yield { type: 'status', message: 'Executing direct automation...' };
      // Implementation for direct tools...
    }

    yield { type: 'done', summary: `Completed: ${request.intent}` };
  }

  private detectVisionNeeded(intent: string): boolean {
    return /screen|click|look|window|desktop|icon/i.test(intent);
  }

  /**
   * Real Screenshot: Calls the ACU computer-use engine (`/v1/execute` action=screenshot)
   */
  private async captureScreenshot(sessionId: string): Promise<string> {
    const engineUrl = process.env.ALLTERNIT_COMPUTER_USE_URL || 'http://127.0.0.1:8760';
    const response = await fetch(`${engineUrl}/v1/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.ACU_API_KEY ? { 'Authorization': `Bearer ${process.env.ACU_API_KEY}` } : {}),
      },
      body: JSON.stringify({
        action: 'screenshot',
        session_id: sessionId,
        run_id: sessionId,
      }),
    });

    if (!response.ok) throw new Error('Failed to capture screenshot from ACU engine');
    const data = await response.json() as {
      status: string;
      artifacts?: Array<{ type: string; url?: string; content?: string }>;
      error?: { code: string; message: string };
    };
    if (data.status !== 'completed') {
      throw new Error(`ACU screenshot failed: ${data.error?.message ?? data.status}`);
    }
    const artifact = data.artifacts?.find((a) => a.type === 'screenshot');
    const dataUrl = artifact?.url ?? artifact?.content;
    if (!dataUrl) throw new Error('ACU screenshot response contained no screenshot artifact');
    // ACU returns a data URL (data:image/png;base64,...) — strip the prefix
    return dataUrl.replace(/^data:image\/\w+;base64,/, '');
  }

  /**
   * Real VLM Inference via OpenAI/Anthropic
   */
  private async performVlmInference(intent: string, screenshotB64: string): Promise<string> {
    const response = await this.openai.chat.completions.create({
      model: process.env.ALLTERNIT_VISION_MODEL_NAME || "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: `Task: ${intent}` },
            { type: "image_url", image_url: { url: `data:image/png;base64,${screenshotB64}` } }
          ],
        },
      ],
      max_tokens: 512,
      temperature: 0
    });

    return response.choices[0].message.content || '';
  }
}
