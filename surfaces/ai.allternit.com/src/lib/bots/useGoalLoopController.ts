/**
 * useGoalLoopController
 *
 * React hook that instantiates a durable GoalLoopController for a bot session,
 * wires it to the event store, WIH/session store, and operational state
 * projection. This is the primary integration point between the Wave 2 runtime
 * and Wave 3 session/WIH management.
 *
 * @module useGoalLoopController
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useBotSessionStore } from './bot-session-store';
import { useBotOperationalStateStore } from './bot-operational-state.store';
import {
  GoalLoopController,
  type GoalLoopControllerOptions,
  type GoalLoopState,
  type TaskRunner,
} from './goal-loop-controller';
import { GoalLoopRecorder, resumeGoalLoopController } from './goal-loop-persistence';
import { projectOperationalStateFromGoalLoop } from './bot-operational-projection';
import { botEventStore, createMemoryBotEventStore } from './bot-event-store';
import { botEventsApi } from './bot-events-api';
import type { Goal, Plan } from './goal-task-contracts';

export interface UseGoalLoopControllerOptions {
  botId: string;
  sessionId?: string;
  projectId?: string;
  taskRunner: TaskRunner;
  /** Start with a fresh goal; ignored if goalId is provided for resume. */
  goal?: Goal;
  /** Resume an existing goal from the durable event store. */
  goalId?: string;
  loopPolicy?: GoalLoopControllerOptions['loopPolicy'];
  /** Use an isolated event store (e.g., for tests). */
  eventStore?: typeof botEventStore;
  /** Disable automatic projection updates. */
  disableProjection?: boolean;
}

export interface UseGoalLoopControllerResult {
  controller: GoalLoopController | null;
  loopState: GoalLoopState | null;
  isRunning: boolean;
  error: string | null;
  materializePlan: (plan: Plan) => void;
  acceptPlan: (acceptedBy: string) => void;
  run: () => Promise<void>;
  submitUserInput: (taskId: string, input: { key: string; value: unknown }) => Promise<void>;
  approveTask: (taskId: string, approvedBy: string) => Promise<void>;
  cancel: (cancelledBy: string) => void;
}

/**
 * Create and manage a durable goal-loop controller for the current bot session.
 */
export function useGoalLoopController(options: UseGoalLoopControllerOptions): UseGoalLoopControllerResult {
  const {
    botId,
    sessionId,
    projectId,
    taskRunner,
    goal,
    goalId,
    loopPolicy,
    eventStore = botEventStore,
    disableProjection = false,
  } = options;

  const materializeWIH = useBotSessionStore((s) => s.materializeWIH);
  const updateWIH = useBotSessionStore((s) => s.updateWIH);
  const applyGoalLoopState = useBotOperationalStateStore((s) => s.applyGoalLoopState);

  const controllerRef = useRef<GoalLoopController | null>(null);
  const recorderRef = useRef<GoalLoopRecorder | null>(null);
  const [loopState, setLoopState] = useState<GoalLoopState | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const syncState = useCallback(
    (state: GoalLoopState) => {
      setLoopState(state);
      if (!disableProjection) {
        applyGoalLoopState(botId, state);
      }
      // Keep active WIH in sync.
      const activeWih = useBotSessionStore.getState().getActiveWIH(botId);
      if (activeWih) {
        const activeTask = Object.values(state.tasks).find(
          (t) => t.status === 'running' || t.status === 'waiting_for_input' || t.status === 'waiting_for_approval',
        );
        if (activeTask && activeTask.id !== activeWih.currentTaskId) {
          updateWIH(activeWih.id, { currentTaskId: activeTask.id });
        }
        const terminalStatuses: GoalLoopState['status'][] = ['completed', 'failed', 'cancelled'];
        if (terminalStatuses.includes(state.status) && activeWih.status !== state.status) {
          updateWIH(activeWih.id, { status: state.status as import('./wih-session-contracts').WIHStatus });
        }
      }
    },
    [botId, disableProjection, applyGoalLoopState, updateWIH],
  );

  useEffect(() => {
    setError(null);

    let controller: GoalLoopController;
    if (goalId) {
      const resumed = resumeGoalLoopController(botId, goalId, taskRunner, eventStore);
      if (!resumed) {
        setError(`No event history found for goal ${goalId}`);
        return;
      }
      controller = resumed;
    } else if (goal) {
      controller = new GoalLoopController({
        botId,
        goal,
        taskRunner,
        loopPolicy,
        sessionId,
        projectId,
        onPlanAccepted: (g, p) => {
          materializeWIH(botId, g, p, { sessionId, projectId });
        },
      });
    } else {
      setError('Either goal or goalId is required');
      return;
    }

    controllerRef.current = controller;
    syncState(controller.getState());

    const recorder = new GoalLoopRecorder({
      botId,
      goalId: controller.getState().goal.id,
      eventStore,
      eventsApi: botEventsApi,
    });
    recorder.attach(controller);
    recorderRef.current = recorder;

    const unsubscribe = controller.onEvent(() => {
      syncState(controller.getState());
    });

    return () => {
      unsubscribe();
      recorder.detach();
      controllerRef.current = null;
      recorderRef.current = null;
    };
  }, [botId, goal, goalId, taskRunner, loopPolicy, sessionId, projectId, eventStore, materializeWIH, syncState]);

  const materializePlan = useCallback((plan: Plan) => {
    controllerRef.current?.materializePlan(plan);
  }, []);

  const acceptPlan = useCallback((acceptedBy: string) => {
    controllerRef.current?.acceptPlan(acceptedBy);
  }, []);

  const run = useCallback(async () => {
    if (!controllerRef.current) return;
    setIsRunning(true);
    setError(null);
    try {
      await controllerRef.current.run();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setIsRunning(false);
    }
  }, []);

  const submitUserInput = useCallback(async (taskId: string, input: { key: string; value: unknown }) => {
    if (!controllerRef.current) return;
    setIsRunning(true);
    try {
      await controllerRef.current.submitUserInput(taskId, input);
    } finally {
      setIsRunning(false);
    }
  }, []);

  const approveTask = useCallback(async (taskId: string, approvedBy: string) => {
    if (!controllerRef.current) return;
    setIsRunning(true);
    try {
      await controllerRef.current.approveTask(taskId, approvedBy);
    } finally {
      setIsRunning(false);
    }
  }, []);

  const cancel = useCallback((cancelledBy: string) => {
    controllerRef.current?.cancel(cancelledBy);
  }, []);

  return {
    controller: controllerRef.current,
    loopState,
    isRunning,
    error,
    materializePlan,
    acceptPlan,
    run,
    submitUserInput,
    approveTask,
    cancel,
  };
}
