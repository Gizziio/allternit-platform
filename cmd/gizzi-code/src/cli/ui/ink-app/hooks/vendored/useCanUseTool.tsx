import { useCallback } from 'react';
import { feature } from '../../vendor/context/featureFlags';
import { hasPermissionsToUseTool, setYoloClassifierApproval } from '../../vendor/utils/permissions';
import type { AssistantMessage } from '../../vendor/types/message';
import type { ToolType } from '../../vendor/constants/toolTypes';
import type { PermissionDecision } from '../../components/vendored/permissions/PermissionRequest';
import type { ToolUseContext } from '../../vendor/hooks/useCommandRegistry';
import { createPermissionContext, createPermissionQueueOps } from './toolPermission/PermissionContext';
import { logPermissionDecision } from './toolPermission/permissionLogging';

export type CanUseToolFn<Input extends Record<string, unknown> = Record<string, unknown>> = (
  tool: ToolType,
  input: Input,
  toolUseContext: ToolUseContext,
  assistantMessage: AssistantMessage,
  toolUseID: string,
  forceDecision?: PermissionDecision<Input>
) => Promise<PermissionDecision<Input>>;

export function useCanUseTool(
  setToolUseConfirmQueue: React.Dispatch<React.SetStateAction<any[]>>,
  setToolPermissionContext: (context: any) => void
): CanUseToolFn {
  const canUseTool = useCallback(async (
    tool: ToolType,
    input: Record<string, unknown>,
    toolUseContext: ToolUseContext,
    assistantMessage: AssistantMessage,
    toolUseID: string,
    forceDecision?: PermissionDecision
  ): Promise<PermissionDecision> => {
    return new Promise((resolve) => {
      const ctx = createPermissionContext(
        tool,
        input,
        toolUseContext,
        assistantMessage,
        toolUseID,
        setToolPermissionContext,
        createPermissionQueueOps(setToolUseConfirmQueue)
      );

      if (ctx.resolveIfAborted(resolve)) {
        return;
      }

      const decisionPromise = forceDecision !== undefined
        ? Promise.resolve(forceDecision)
        : hasPermissionsToUseTool(tool, input, toolUseContext, assistantMessage, toolUseID);

      decisionPromise.then(async (result) => {
        if (result.behavior === "allow") {
          if (ctx.resolveIfAborted(resolve)) {
            return;
          }
          if (
            feature("TRANSCRIPT_CLASSIFIER") &&
            result.decisionReason?.type === "classifier" &&
            result.decisionReason.classifier === "auto-mode"
          ) {
            setYoloClassifierApproval(toolUseID, result.decisionReason.reason);
          }
          ctx.logDecision(
            { decision: "accept", source: "config" },
            { input: result.updatedInput ?? input }
          );
          resolve(ctx.buildAllow(result.updatedInput ?? input, {
            decisionReason: result.decisionReason
          }));
          return;
        }
        const appState = toolUseContext.getAppState();
        ctx.queueRequest(appState, resolve, result);
      });
    });
  }, [setToolPermissionContext, setToolUseConfirmQueue]);

  return canUseTool;
}
