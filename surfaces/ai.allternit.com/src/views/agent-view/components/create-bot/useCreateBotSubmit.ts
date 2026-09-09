"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Agent, AgentVMOperatorConfig, AvatarConfig, CreateAgentInput } from "@/lib/agents/agent.types";
import { useAgentStore } from "@/lib/agents/agent.store";
import { validateAgentCreationChecklist } from "@/lib/agents/agent-creation-checklist";
import { ensureBotComputer } from "@/lib/bots/vm-operator";
import { saveBotAvatar } from "@/lib/bots/bot-assets-api";
import { generateBotAvatar, isBotAvatar } from "@/lib/bots/bot-avatar.service";
import { listComputers, type Computer } from "@/lib/computers-api";
import { createModuleLogger } from "@/lib/logger";
import { WIZARD_COPY } from "./wizard-copy";
import { buildCreateBotPayload } from "./wizard-state";

const logger = createModuleLogger("CreateBotWizard");

export type SubmitPhase = "idle" | "creating" | "provisioning" | "error";

export type ProvisioningStatus = "creating" | "running" | "stopped" | "error" | "timeout";

export const PROVISION_POLL_MS = 2_500;
export const PROVISION_TIMEOUT_MS = 60_000;

function newestBoundComputer(computers: Computer[], botId: string): Computer | undefined {
  return computers
    .filter((c) => c.bot_id === botId && c.status !== "deleted")
    .sort(
      (a, b) =>
        new Date(b.updated_at || b.created_at).getTime() -
        new Date(a.updated_at || a.created_at).getTime(),
    )[0];
}

export interface PollProvisioningOptions {
  pollMs?: number;
  timeoutMs?: number;
  onStatus?: (status: ProvisioningStatus) => void;
}

/**
 * Poll `GET /api/v1/computers?bot_id=…` (the same client the bots rail
 * streams from) until the bot's desktop is running, errors, or the timeout
 * cap hits. Timeout is not a failure — the caller proceeds to the bot home
 * regardless, per the plan's "cap polling with a timeout" rule.
 *
 * Exported (and dependency-injected) so the poll/timeout behaviour is
 * unit-testable without a browser.
 */
export async function pollBotComputerProvisioning(
  botId: string,
  vmConfig: AgentVMOperatorConfig,
  listFn: typeof listComputers = listComputers,
  options: PollProvisioningOptions = {},
): Promise<ProvisioningStatus> {
  const pollMs = options.pollMs ?? PROVISION_POLL_MS;
  const timeoutMs = options.timeoutMs ?? PROVISION_TIMEOUT_MS;
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    let status: Computer["status"] | undefined;
    try {
      const computers = await listFn({
        bot_id: botId,
        kind: vmConfig.computerKind ?? "cloud_desktop",
      });
      status = newestBoundComputer(computers, botId)?.status;
    } catch (err) {
      // A failed status read is not terminal — keep polling until the cap.
      logger.warn({ err, botId }, "Failed to poll bot computer status");
    }

    if (status === "running" || status === "error" || status === "stopped") {
      options.onStatus?.(status);
      return status;
    }
    if (Date.now() >= deadline) {
      options.onStatus?.("timeout");
      return "timeout";
    }
    options.onStatus?.("creating");
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

interface UseCreateBotSubmitArgs {
  getFormData: () => Partial<CreateAgentInput>;
  getAvatar: () => AvatarConfig;
  onClose: () => void;
}

export interface UseCreateBotSubmitResult {
  phase: SubmitPhase;
  error: string | null;
  provisioningStatus: ProvisioningStatus | null;
  /** True once createAgent succeeded — a later failure is retryable. */
  hasCreatedBot: boolean;
  /** Validation → create → provision → avatar → bot-home. False = stay put. */
  submit: () => Promise<boolean>;
  /** Re-run desktop provisioning after a visible failure (bot already exists). */
  retryProvisioning: () => Promise<void>;
  /** Leave after a failure: open the created bot's home (or just close). */
  dismissToBotHome: () => void;
  reset: () => void;
}

/**
 * The atomic Create Bot submit path, unchanged in contract from the old form:
 * validateAgentCreationChecklist → createAgent → ensureBotComputer (now
 * visibly polled instead of fire-and-forget) → saveBotAvatar → dispatch
 * `allternit:open-view` bot-home.
 */
export function useCreateBotSubmit({
  getFormData,
  getAvatar,
  onClose,
}: UseCreateBotSubmitArgs): UseCreateBotSubmitResult {
  const { createAgent } = useAgentStore();
  const [phase, setPhase] = useState<SubmitPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [provisioningStatus, setProvisioningStatus] = useState<ProvisioningStatus | null>(null);
  const [hasCreatedBot, setHasCreatedBot] = useState(false);
  const busyRef = useRef(false);
  // Set on success so a failed provisioning can be retried without recreating.
  const createdRef = useRef<{ agent: Agent; vmConfig?: AgentVMOperatorConfig } | null>(null);

  const openBotHome = useCallback((botId: string) => {
    onClose();
    window.dispatchEvent(
      new CustomEvent("allternit:open-view", {
        detail: { viewType: "bot-home", context: { botId } },
      }),
    );
  }, [onClose]);

  const syncAvatarAsset = useCallback((created: Agent) => {
    // Fire-and-forget avatar asset sync so mail/inbox can show real pfps.
    // Form-created bots may not carry a BotAvatar union yet — generate the
    // deterministic one as the stored asset.
    const createdAvatar = created.botProfile?.avatar;
    void saveBotAvatar(
      created.id,
      createdAvatar && isBotAvatar(createdAvatar) ? createdAvatar : generateBotAvatar(created.id),
    );
  }, []);

  const provisionDesktop = useCallback(
    async (botId: string, vmConfig: AgentVMOperatorConfig, displayName: string): Promise<boolean> => {
      setPhase("provisioning");
      setProvisioningStatus("creating");
      const result = await ensureBotComputer(botId, vmConfig, { displayName });
      if (!result.ok) {
        setError(`${WIZARD_COPY.provisioning.errorPrefix}: ${result.error ?? "unknown error"}`);
        setPhase("error");
        return false;
      }
      const status = await pollBotComputerProvisioning(botId, vmConfig, listComputers, {
        onStatus: setProvisioningStatus,
      });
      if (status === "error") {
        setError(WIZARD_COPY.provisioning.errorPrefix);
        setPhase("error");
        return false;
      }
      // running, stopped, or timeout (cap) — all proceed to the bot home.
      return true;
    },
    [],
  );

  const submit = useCallback(async (): Promise<boolean> => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setError(null);
    setProvisioningStatus(null);
    try {
      const formData = getFormData();
      const avatar = getAvatar();
      const payload = buildCreateBotPayload({ formData, avatar });
      const checklist = validateAgentCreationChecklist(payload);
      if (!checklist.isValid) {
        const missing = checklist.items
          .filter((i) => i.required && !i.satisfied)
          .map((i) => i.label);
        setError(`${WIZARD_COPY.errors.checklistPrefix}: ${missing.join(", ")}`);
        setPhase("error");
        return false;
      }

      setPhase("creating");
      const created = await createAgent(payload);
      createdRef.current = { agent: created, vmConfig: payload.vmOperator ?? undefined };
      setHasCreatedBot(true);
      syncAvatarAsset(created);

      const displayName = payload.botProfile?.displayName?.trim() || "My Bot";
      if (payload.vmOperator?.enabled) {
        const ok = await provisionDesktop(created.id, payload.vmOperator, displayName);
        if (!ok) return false; // inline error + retry; do not auto-close.
      }

      openBotHome(created.id);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : WIZARD_COPY.errors.createFailed);
      setPhase("error");
      return false;
    } finally {
      busyRef.current = false;
    }
  }, [getAvatar, getFormData, createAgent, openBotHome, provisionDesktop, syncAvatarAsset]);

  const retryProvisioning = useCallback(async () => {
    const created = createdRef.current;
    if (!created?.vmConfig) return;
    const ok = await provisionDesktop(
      created.agent.id,
      created.vmConfig,
      created.agent.botProfile?.displayName?.trim() || "My Bot",
    );
    if (ok) openBotHome(created.agent.id);
  }, [openBotHome, provisionDesktop]);

  const dismissToBotHome = useCallback(() => {
    const created = createdRef.current;
    if (created) {
      openBotHome(created.agent.id);
    } else {
      onClose();
    }
  }, [onClose, openBotHome]);

  const reset = useCallback(() => {
    setPhase("idle");
    setError(null);
    setProvisioningStatus(null);
    setHasCreatedBot(false);
    createdRef.current = null;
  }, []);

  // Safety: if the wizard unmounts mid-flight, stop reporting state.
  useEffect(() => () => {
    busyRef.current = false;
  }, []);

  return {
    phase,
    error,
    provisioningStatus,
    hasCreatedBot,
    submit,
    retryProvisioning,
    dismissToBotHome,
    reset,
  };
}
