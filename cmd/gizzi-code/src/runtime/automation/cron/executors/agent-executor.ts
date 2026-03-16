/**
 * Agent Job Executor
 *
 * Executes AI agent tasks for cron jobs via the Session runtime directly.
 */

import { createLogger } from "../utils/logger";
import type { CronJob, CronRun } from "../types";
import { Session } from "@/runtime/session";
import { SessionPrompt } from "@/runtime/session/prompt";

const log = createLogger("cron-agent-executor");

export interface AgentExecutorConfig {
  /** Default working directory for sessions */
  defaultCwd: string;
  /** Default model to use (providerID/modelID format) */
  defaultModel?: string;
}

export class AgentExecutor {
  private config: AgentExecutorConfig;
  private activeSessions = new Map<string, { sessionId: string; abortController: AbortController }>();

  constructor(config: AgentExecutorConfig) {
    this.config = config;
  }

  async execute(job: CronJob, run: CronRun, signal: AbortSignal): Promise<void> {
    const jobConfig = job.config as {
      prompt: string;
      agentId?: string;
      model?: string;
      context?: string;
    };

    log.info("Starting agent job execution", {
      jobId: job.id,
      runId: run.id,
      prompt: jobConfig.prompt.slice(0, 100),
    });

    const abortController = new AbortController();
    const sessionKey = `${job.id}-${run.id}`;
    this.activeSessions.set(sessionKey, { sessionId: "", abortController });

    signal.addEventListener("abort", () => abortController.abort());

    try {
      const session = await Session.createNext({ directory: this.config.defaultCwd });
      const sessionId = session.id;
      this.activeSessions.set(sessionKey, { sessionId, abortController });

      log.info("Agent session created", { sessionId, jobId: job.id });

      const fullPrompt = jobConfig.context
        ? `${jobConfig.context}\n\n${jobConfig.prompt}`
        : jobConfig.prompt;

      let model: { providerID: string; modelID: string } | undefined;
      if (jobConfig.model) {
        const parts = jobConfig.model.split("/");
        if (parts.length === 2) {
          model = { providerID: parts[0]!, modelID: parts[1]! };
        }
      }

      const startTime = Date.now();

      await SessionPrompt.prompt({
        sessionID: sessionId,
        parts: [{ type: "text", text: fullPrompt }],
        ...(model && { model }),
        ...(jobConfig.agentId && { agent: jobConfig.agentId }),
      });

      const messages = await Session.messages({ sessionID: sessionId });
      const assistantMessages = messages.filter((m) => m.info.role === "assistant");
      const lastAssistant = assistantMessages[assistantMessages.length - 1];

      if (lastAssistant) {
        const textParts = lastAssistant.parts.filter((p) => p.type === "text") as Array<{ text?: string }>;
        run.response = textParts.map((p) => p.text ?? "").join("");
        run.output = run.response;
        run.tokensUsed = (lastAssistant.info as any).tokens?.output ?? 0;
      }

      run.agentId = jobConfig.agentId ?? "default";

      log.info("Agent job completed", {
        jobId: job.id,
        runId: run.id,
        tokensUsed: run.tokensUsed,
        duration: Date.now() - startTime,
      });
    } catch (error) {
      log.error("Agent job failed", {
        jobId: job.id,
        runId: run.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      await this.cleanupSession(sessionKey);
    }
  }

  private async cleanupSession(sessionKey: string): Promise<void> {
    const session = this.activeSessions.get(sessionKey);
    if (!session) return;

    try {
      session.abortController.abort();
      if (session.sessionId) {
        await Session.remove(session.sessionId).catch((err: unknown) => {
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

  async cancel(jobId: string, runId: string): Promise<void> {
    const sessionKey = `${jobId}-${runId}`;
    const session = this.activeSessions.get(sessionKey);
    if (session) {
      session.abortController.abort();
      await this.cleanupSession(sessionKey);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const _ = [...Session.list({ directory: this.config.defaultCwd })];
      return true;
    } catch {
      return false;
    }
  }
}
