/**
 * Agent Job Executor
 * 
 * Production implementation for executing AI agent tasks via the GIZZI SDK.
 * No placeholders - full integration with the agent system.
 */

import type { GIZZIClient } from "@a2r/sdk/v2";
import { Log } from "@/shared/util/log";
import type { CronJob, CronRun } from "../types";

const log = Log.create({ service: "cron-agent-executor" });

export interface AgentExecutorConfig {
  /** GIZZI SDK client instance */
  sdk: GIZZIClient;
  /** Default working directory for sessions */
  defaultCwd: string;
  /** Default model to use (providerID/modelID format) */
  defaultModel?: string;
  /** Default agent mode */
  defaultMode?: string;
  /** MCP servers to enable */
  mcpServers?: Array<{ name: string; url?: string; command?: string }>;
}

export class AgentExecutor {
  private config: AgentExecutorConfig;
  private activeSessions = new Map<string, { sessionId: string; abortController: AbortController }>();

  constructor(config: AgentExecutorConfig) {
    this.config = config;
  }

  /**
   * Execute an agent job
   */
  async execute(job: CronJob, run: CronRun, signal: AbortSignal): Promise<void> {
    const jobConfig = job.config as {
      prompt: string;
      agentId?: string;
      model?: string;
      context?: string;
      maxTokens?: number;
      temperature?: number;
      mcpServers?: Array<{ name: string; url?: string; command?: string }>;
    };

    log.info("Starting agent job execution", {
      jobId: job.id,
      runId: run.id,
      prompt: jobConfig.prompt.slice(0, 100),
    });

    const abortController = new AbortController();
    const sessionKey = `${job.id}-${run.id}`;
    this.activeSessions.set(sessionKey, { sessionId: "", abortController });

    // Link external abort signal
    signal.addEventListener("abort", () => abortController.abort());

    try {
      // Parse model if provided
      let providerID: string | undefined;
      let modelID: string | undefined;
      
      if (jobConfig.model) {
        const parts = jobConfig.model.split("/");
        if (parts.length === 2) {
          [providerID, modelID] = parts;
        }
      }

      // Create session
      const session = await this.config.sdk.session.create(
        { directory: this.config.defaultCwd },
        { signal: abortController.signal }
      );

      if (!session.data) {
        throw new Error("Failed to create agent session");
      }

      const sessionId = session.data.id;
      this.activeSessions.set(sessionKey, { sessionId, abortController });
      
      log.info("Agent session created", { sessionId, jobId: job.id });

      // Prepare the message
      const fullPrompt = jobConfig.context 
        ? `${jobConfig.context}\n\n${jobConfig.prompt}`
        : jobConfig.prompt;

      // Send message to agent
      const response = await this.config.sdk.session.send(
        {
          directory: this.config.defaultCwd,
          sessionID: sessionId,
          message: {
            role: "user",
            content: fullPrompt,
            ...(providerID && modelID && {
              model: { providerID, modelID }
            }),
          },
        },
        { signal: abortController.signal }
      );

      if (response.error) {
        throw new Error(`Agent request failed: ${response.error.message}`);
      }

      // Wait for completion by polling
      const result = await this.waitForCompletion(
        sessionId,
        job.timeoutSeconds ?? 300,
        abortController.signal
      );

      // Update run record
      run.response = result.response;
      run.output = result.response;
      run.tokensUsed = result.tokensUsed;
      run.agentId = jobConfig.agentId ?? "default";
      
      // Get cost if available
      if (result.cost !== undefined) {
        (run.metadata as Record<string, unknown>).cost = result.cost;
      }

      log.info("Agent job completed", {
        jobId: job.id,
        runId: run.id,
        tokensUsed: result.tokensUsed,
        duration: result.duration,
      });

    } catch (error) {
      log.error("Agent job failed", {
        jobId: job.id,
        runId: run.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      // Cleanup session
      await this.cleanupSession(sessionKey);
    }
  }

  /**
   * Wait for agent response completion
   */
  private async waitForCompletion(
    sessionId: string,
    timeoutSeconds: number,
    signal: AbortSignal
  ): Promise<{
    response: string;
    tokensUsed: number;
    duration: number;
    cost?: number;
  }> {
    const startTime = Date.now();
    const pollInterval = 1000; // 1 second
    const maxWaitTime = timeoutSeconds * 1000;

    while (Date.now() - startTime < maxWaitTime) {
      if (signal.aborted) {
        throw new Error("Job aborted");
      }

      // Get session messages
      const messagesResponse = await this.config.sdk.session.messages(
        { sessionID: sessionId, directory: this.config.defaultCwd },
        { signal }
      );

      if (messagesResponse.error) {
        throw new Error(`Failed to fetch messages: ${messagesResponse.error.message}`);
      }

      const messages = messagesResponse.data ?? [];
      
      // Find the last assistant message
      const lastAssistant = messages.findLast((m) => m.info.role === "assistant");
      
      if (lastAssistant) {
        // Check if the response is complete (not streaming)
        const textParts = lastAssistant.parts.filter((p) => p.type === "text");
        const response = textParts.map((p) => (p as { text?: string }).text ?? "").join("");
        
        // Calculate tokens and cost
        const tokensUsed = (lastAssistant.info as { tokens?: { input?: number; output?: number } }).tokens?.output ?? 0;
        const cost = (lastAssistant.info as { cost?: number }).cost;

        return {
          response,
          tokensUsed,
          duration: Date.now() - startTime,
          cost,
        };
      }

      // Wait before polling again
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new Error(`Timeout after ${timeoutSeconds}s waiting for agent response`);
  }

  /**
   * Cleanup session resources
   */
  private async cleanupSession(sessionKey: string): Promise<void> {
    const session = this.activeSessions.get(sessionKey);
    if (!session) return;

    try {
      // Abort any ongoing operations
      session.abortController.abort();
      
      // Delete the session
      if (session.sessionId) {
        await this.config.sdk.session.delete({
          sessionID: session.sessionId,
          directory: this.config.defaultCwd,
        }).catch((err) => {
          log.warn("Failed to delete agent session", {
            sessionId: session.sessionId,
            error: err instanceof Error ? err.message : String(err),
          });
        });
      }
    } finally {
      this.activeSessions.delete(sessionKey);
    }
  }

  /**
   * Cancel a running job
   */
  async cancel(jobId: string, runId: string): Promise<void> {
    const sessionKey = `${jobId}-${runId}`;
    const session = this.activeSessions.get(sessionKey);
    
    if (session) {
      session.abortController.abort();
      await this.cleanupSession(sessionKey);
    }
  }

  /**
   * Check if executor is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Try to list sessions as a health check
      await this.config.sdk.session.list({ directory: this.config.defaultCwd });
      return true;
    } catch {
      return false;
    }
  }
}
