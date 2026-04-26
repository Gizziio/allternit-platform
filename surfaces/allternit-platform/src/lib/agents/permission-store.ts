/**
 * Permission Store - Global permission request management
 * 
 * Handles permission requests from agents across all surfaces.
 * Each permission request is tied to a session and surface.
 * 
 * @module permission-store
 */

import { create } from 'zustand';
import type { AgentModeSurface } from '@/stores/agent-surface-mode.store';

export interface PendingPermissionRequest {
  requestId: string;
  sessionId: string;
  surface: AgentModeSurface;
  permission: string;
  patterns: string[];
  metadata: Record<string, unknown>;
  always: string[];
  tool?: { messageID: string; callID: string };
  createdAt: string;
}

export interface PermissionDecision {
  requestId: string;
  decision: 'once' | 'always' | 'reject';
  timestamp: string;
}

interface PermissionState {
  pendingPermissions: Record<string, PendingPermissionRequest>;
  permissionHistory: PermissionDecision[];
  allowedPermissions: Record<string, string[]>; // sessionId -> permissions[]
  
  // Actions
  addPermissionRequest: (request: Omit<PendingPermissionRequest, 'createdAt'>) => void;
  replyPermission: (requestId: string, reply: 'once' | 'always' | 'reject') => void;
  clearPermissionRequest: (requestId: string) => void;
  clearSessionPermissions: (sessionId: string) => void;
  isPermissionAllowed: (sessionId: string, permission: string) => boolean;
  getPendingForSession: (sessionId: string) => PendingPermissionRequest[];
  getPendingForSurface: (surface: AgentModeSurface) => PendingPermissionRequest[];
}

export const usePermissionStore = create<PermissionState>((set, get) => ({
  pendingPermissions: {},
  permissionHistory: [],
  allowedPermissions: {},

  addPermissionRequest: (request) => {
    const requestWithTimestamp: PendingPermissionRequest = {
      ...request,
      createdAt: new Date().toISOString(),
    };
    
    set((state) => ({
      pendingPermissions: {
        ...state.pendingPermissions,
        [request.requestId]: requestWithTimestamp,
      },
    }));
  },

  replyPermission: (requestId, reply) => {
    const request = get().pendingPermissions[requestId];
    if (!request) return;

    // Record decision in history
    const decision: PermissionDecision = {
      requestId,
      decision: reply,
      timestamp: new Date().toISOString(),
    };

    set((state) => {
      const newPending = { ...state.pendingPermissions };
      delete newPending[requestId];

      const newHistory = [...state.permissionHistory, decision];

      // If 'always', add to allowed permissions for this session
      let newAllowed = state.allowedPermissions;
      if (reply === 'always') {
        newAllowed = {
          ...state.allowedPermissions,
          [request.sessionId]: [
            ...(state.allowedPermissions[request.sessionId] || []),
            request.permission,
          ],
        };
      }

      return {
        pendingPermissions: newPending,
        permissionHistory: newHistory,
        allowedPermissions: newAllowed,
      };
    });

    // TODO: Call backend API to persist permission decision
    // permissionApi.replyPermission(requestId, reply).catch(console.error);
  },

  clearPermissionRequest: (requestId) => {
    set((state) => {
      const newPending = { ...state.pendingPermissions };
      delete newPending[requestId];
      return { pendingPermissions: newPending };
    });
  },

  clearSessionPermissions: (sessionId) => {
    set((state) => {
      const newPending: Record<string, PendingPermissionRequest> = {};
      for (const [id, req] of Object.entries(state.pendingPermissions)) {
        if (req.sessionId !== sessionId) {
          newPending[id] = req;
        }
      }
      
      const newAllowed = { ...state.allowedPermissions };
      delete newAllowed[sessionId];

      return {
        pendingPermissions: newPending,
        allowedPermissions: newAllowed,
      };
    });
  },

  isPermissionAllowed: (sessionId, permission) => {
    const allowed = get().allowedPermissions[sessionId] || [];
    return allowed.includes(permission);
  },

  getPendingForSession: (sessionId) => {
    return Object.values(get().pendingPermissions).filter(
      (r) => r.sessionId === sessionId
    );
  },

  getPendingForSurface: (surface) => {
    return Object.values(get().pendingPermissions).filter(
      (r) => r.surface === surface
    );
  },
}));

// ============================================================================
// Question Store - Global question request management
// ============================================================================

export interface Question {
  header?: string;
  question: string;
  options: Array<{ label: string; description: string }>;
  custom?: boolean;
  multiple?: boolean;
}

export interface PendingQuestionRequest {
  requestId: string;
  sessionId: string;
  surface: AgentModeSurface;
  questions: Question[];
  createdAt: string;
}

export interface QuestionAnswer {
  questionIndex: number;
  answer: string | string[];
}

interface QuestionState {
  pendingQuestions: Record<string, PendingQuestionRequest>;
  questionHistory: Array<{ requestId: string; answers: QuestionAnswer[]; timestamp: string }>;
  
  // Actions
  addQuestionRequest: (request: Omit<PendingQuestionRequest, 'createdAt'>) => void;
  replyQuestion: (requestId: string, answers: QuestionAnswer[]) => void;
  rejectQuestion: (requestId: string) => void;
  clearQuestionRequest: (requestId: string) => void;
  clearSessionQuestions: (sessionId: string) => void;
  getPendingQuestionsForSession: (sessionId: string) => PendingQuestionRequest[];
  getPendingQuestionsForSurface: (surface: AgentModeSurface) => PendingQuestionRequest[];
}

export const useQuestionStore = create<QuestionState>((set, get) => ({
  pendingQuestions: {},
  questionHistory: [],

  addQuestionRequest: (request) => {
    const requestWithTimestamp: PendingQuestionRequest = {
      ...request,
      createdAt: new Date().toISOString(),
    };
    
    set((state) => ({
      pendingQuestions: {
        ...state.pendingQuestions,
        [request.requestId]: requestWithTimestamp,
      },
    }));
  },

  replyQuestion: (requestId, answers) => {
    const request = get().pendingQuestions[requestId];
    if (!request) return;

    set((state) => {
      const newPending = { ...state.pendingQuestions };
      delete newPending[requestId];

      return {
        pendingQuestions: newPending,
        questionHistory: [
          ...state.questionHistory,
          { requestId, answers, timestamp: new Date().toISOString() },
        ],
      };
    });

    // TODO: Call backend API
    // questionApi.replyQuestion(requestId, answers).catch(console.error);
  },

  rejectQuestion: (requestId) => {
    set((state) => {
      const newPending = { ...state.pendingQuestions };
      delete newPending[requestId];
      return { pendingQuestions: newPending };
    });
  },

  clearQuestionRequest: (requestId) => {
    set((state) => {
      const newPending = { ...state.pendingQuestions };
      delete newPending[requestId];
      return { pendingQuestions: newPending };
    });
  },

  clearSessionQuestions: (sessionId) => {
    set((state) => {
      const newPending: Record<string, PendingQuestionRequest> = {};
      for (const [id, req] of Object.entries(state.pendingQuestions)) {
        if (req.sessionId !== sessionId) {
          newPending[id] = req;
        }
      }
      return { pendingQuestions: newPending };
    });
  },

  getPendingQuestionsForSession: (sessionId) => {
    return Object.values(get().pendingQuestions).filter(
      (r) => r.sessionId === sessionId
    );
  },

  getPendingQuestionsForSurface: (surface) => {
    return Object.values(get().pendingQuestions).filter(
      (r) => r.surface === surface
    );
  },
}));

// Selector hooks for convenience
export function usePendingPermissions(sessionId?: string) {
  return usePermissionStore((state) => 
    sessionId ? state.getPendingForSession(sessionId) : Object.values(state.pendingPermissions)
  );
}

export function usePermissionActions() {
  return usePermissionStore((state) => ({
    replyPermission: state.replyPermission,
    addPermissionRequest: state.addPermissionRequest,
    isPermissionAllowed: state.isPermissionAllowed,
  }));
}

export function usePendingQuestions(sessionId?: string) {
  return useQuestionStore((state) => 
    sessionId ? state.getPendingQuestionsForSession(sessionId) : Object.values(state.pendingQuestions)
  );
}

export function useQuestionActions() {
  return useQuestionStore((state) => ({
    replyQuestion: state.replyQuestion,
    rejectQuestion: state.rejectQuestion,
    addQuestionRequest: state.addQuestionRequest,
  }));
}
