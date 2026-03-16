/**
 * Browser Agent Store - State management for agentic browsing
 * 
 * Manages:
 * - Agent status (Idle/Running/Waiting/Blocked/Done)
 * - Mode (Human/Assist/Agent)
 * - Current action execution
 * - Receipt stream
 * - Event subscriptions
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import {
  BrowserAgentStatus,
  BrowserAgentMode,
  BrowserEndpoint,
  BrowserAction,
  PageState,
  RiskTier,
} from './browserAgent.types';
import {
  ReceiptGenerator,
  getReceiptGenerator,
  ReceiptQueryParams,
  ReceiptQueryResult,
} from './receiptService';
import { getPolicyEngine } from './policyService';
import { getObservabilityService } from './observabilityService';
import { getEnvironmentManager } from './environmentService';

// ============================================================================
// Store State
// ============================================================================

export interface BrowserAgentState {
  // Agent status
  status: BrowserAgentStatus;
  mode: BrowserAgentMode;
  endpoint: BrowserEndpoint | null;
  
  // Current execution
  currentRunId: string | null;
  currentAction: {
    action: BrowserAction;
    stepIndex: number;
    totalSteps: number;
    boundingBox?: { x: number; y: number; width: number; height: number } | null;
    label?: string;
  } | null;
  
  // Goal
  goal: string;
  
  // Approval
  requiresApproval: boolean;
  approvalActionSummary?: string;
  approvalRiskTier?: RiskTier;
  
  // Receipts
  receipts: string[];  // Receipt IDs
  
  // Connected endpoints
  connectedEndpoints: BrowserEndpoint[];
  
  // Actions
  setGoal: (goal: string) => void;
  runGoal: (goal: string) => void;
  stopExecution: () => void;
  takeOver: () => void;
  handOff: () => void;
  approveAction: () => void;
  denyAction: () => void;
  captureScreenshot: () => void;
  openDrawer: () => void;
  
  // Mode
  setMode: (mode: BrowserAgentMode) => void;
  
  // Endpoint
  setEndpoint: (endpoint: BrowserEndpoint | null) => void;
  addEndpoint: (endpoint: BrowserEndpoint) => void;
  removeEndpoint: (endpointId: string) => void;
  
  // Receipts
  addReceipt: (receiptId: string) => void;
  queryReceipts: (params: ReceiptQueryParams) => Promise<ReceiptQueryResult>;
  
  // Execution simulation (for demo)
  _simulateExecution: () => void;
}

// ============================================================================
// Store Creation
// ============================================================================

export const useBrowserAgentStore = create<BrowserAgentState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    status: 'Idle',
    mode: 'Human',
    endpoint: null,
    currentRunId: null,
    currentAction: null,
    goal: '',
    requiresApproval: false,
    approvalActionSummary: undefined,
    approvalRiskTier: undefined,
    receipts: [],
    connectedEndpoints: [],
    
    // Goal
    setGoal: (goal) => set({ goal }),
    
    // Run goal
    runGoal: (goal) => {
      const runId = 'run_' + Date.now();
      
      // Log to observability
      const obs = getObservabilityService();
      obs.log({
        event_type: 'agent.run.start',
        severity: 'info',
        source: 'browserAgentStore',
        message: `Starting agent run with goal: ${goal}`,
        payload: {
          runId,
          goal,
          mode: get().mode,
          endpoint: get().endpoint?.type,
        },
      });
      
      // Get current environment
      const envManager = getEnvironmentManager();
      envManager.getCurrentEnvironment().then(env => {
        obs.log({
          event_type: 'agent.run.environment',
          severity: 'info',
          source: 'browserAgentStore',
          message: `Running in environment: ${env}`,
          payload: { runId, environment: env },
        });
      });

      set({
        goal,
        status: 'Running',
        currentRunId: runId,
      });

      // Start simulated execution
      get()._simulateExecution();
    },
    
    // Stop execution
    stopExecution: () => {
      const state = get();
      
      // Log to observability
      const obs = getObservabilityService();
      obs.log({
        event_type: 'agent.run.stop',
        severity: 'info',
        source: 'browserAgentStore',
        message: 'Agent execution stopped by user',
        payload: {
          runId: state.currentRunId,
          status: state.status,
        },
      });
      
      set({
        status: 'Done',
        currentAction: null,
        requiresApproval: false,
      });
    },
    
    // Take over control
    takeOver: () => {
      set({ mode: 'Human', status: 'Blocked' });
    },
    
    // Hand off to agent
    handOff: () => {
      set({ mode: 'Agent', status: 'Running' });
    },
    
    // Approve action
    approveAction: () => {
      const state = get();
      
      // Log approval to observability
      const obs = getObservabilityService();
      obs.log({
        event_type: 'agent.approval.granted',
        severity: 'info',
        source: 'browserAgentStore',
        message: 'User approved pending action',
        payload: {
          runId: state.currentRunId,
          actionSummary: state.approvalActionSummary,
          riskTier: state.approvalRiskTier,
        },
      });
      
      set({ requiresApproval: false });
      // Continue execution
      setTimeout(() => {
        const currentState = get();
        if (currentState.currentAction) {
          // Simulate action completion
          get()._simulateExecution();
        }
      }, 500);
    },
    
    // Deny action
    denyAction: () => {
      set({
        requiresApproval: false,
        status: 'Blocked',
      });
    },
    
    // Capture screenshot
    captureScreenshot: () => {
      const state = get();
      
      // Log to observability
      const obs = getObservabilityService();
      obs.log({
        event_type: 'agent.screenshot.capture',
        severity: 'info',
        source: 'browserAgentStore',
        message: 'Screenshot captured',
        payload: {
          runId: state.currentRunId,
          status: state.status,
        },
      });
      
      console.log('Capturing screenshot...');
      // @placeholder APPROVED - Browser runtime integration pending
      // @ticket GAP-56
      // Stub: call browser runtime to capture
    },

    // Open drawer
    openDrawer: () => {
      console.log('Opening drawer...');
      // @placeholder APPROVED - Drawer event dispatch pending
      // @ticket GAP-56
      // Stub: dispatch drawer open event
    },
    
    // Set mode
    setMode: (mode) => set({ mode }),
    
    // Set endpoint
    setEndpoint: (endpoint) => set({ endpoint }),
    
    // Add endpoint
    addEndpoint: (endpoint) => {
      const endpoints = get().connectedEndpoints;
      set({ connectedEndpoints: [...endpoints, endpoint] });
    },
    
    // Remove endpoint
    removeEndpoint: (endpointId) => {
      const endpoints = get().connectedEndpoints.filter(e => {
        if (e.type === 'shell_browser') {
          return e.sessionId !== endpointId;
        }
        return e.endpointId !== endpointId;
      });
      set({ connectedEndpoints: endpoints });
    },
    
    // Add receipt
    addReceipt: (receiptId) => {
      const receipts = get().receipts;
      set({ receipts: [...receipts, receiptId] });
    },
    
    // Query receipts
    queryReceipts: async (params) => {
      const generator = getReceiptGenerator();
      return generator.queryReceipts(params);
    },
    
    // Simulated execution (for demo)
    _simulateExecution: () => {
      const state = get();
      if (!state.currentRunId) return;
      
      // Simulated action sequence
      const actions: Array<{
        type: string;
        label: string;
        riskTier: RiskTier;
        requiresApproval: boolean;
        boundingBox: { x: number; y: number; width: number; height: number };
      }> = [
        { type: 'Navigate', label: 'Navigating...', riskTier: 1, requiresApproval: false, boundingBox: { x: 0, y: 0, width: 0, height: 0 } },
        { type: 'Click', label: 'Clicking login...', riskTier: 1, requiresApproval: false, boundingBox: { x: 100, y: 200, width: 120, height: 40 } },
        { type: 'Type', label: 'Typing credentials...', riskTier: 2, requiresApproval: false, boundingBox: { x: 100, y: 250, width: 200, height: 30 } },
        { type: 'Click', label: 'Clicking submit...', riskTier: 3, requiresApproval: true, boundingBox: { x: 100, y: 300, width: 100, height: 40 } },
        { type: 'Extract', label: 'Extracting data...', riskTier: 0, requiresApproval: false, boundingBox: { x: 0, y: 400, width: 800, height: 600 } },
      ];
      
      let stepIndex = 0;
      
      const executeNext = () => {
        const currentState = get();
        if (currentState.status !== 'Running' || stepIndex >= actions.length) {
          set({ status: 'Done', currentAction: null });
          return;
        }
        
        const action = actions[stepIndex];
        
        // Update current action
        set({
          currentAction: {
            action: {
              id: 'action_' + stepIndex,
              type: action.type as any,
              riskTier: action.riskTier,
              timeoutMs: 5000,
              retries: 0,
              target: { strategy: 'css', value: '.element' },
              evidence: { capture: ['screenshot_target', 'dom_hash'] },
            },
            stepIndex: stepIndex + 1,
            totalSteps: actions.length,
            boundingBox: action.boundingBox,
            label: action.label,
          },
        });
        
        // Check if approval required
        if (action.requiresApproval && currentState.mode === 'Agent') {
          set({
            status: 'WaitingApproval',
            requiresApproval: true,
            approvalActionSummary: action.label,
            approvalRiskTier: action.riskTier,
          });
          return;  // Wait for approval
        }
        
        // Simulate action completion
        setTimeout(async () => {
          const obs = getObservabilityService();
          
          // Log action start
          await obs.log({
            event_type: 'agent.action.start',
            severity: 'info',
            source: 'browserAgentStore',
            message: `Starting action: ${action.label}`,
            payload: {
              runId: currentState.currentRunId!,
              actionId: 'action_' + stepIndex,
              actionType: action.type,
              riskTier: action.riskTier,
            },
          });
          
          // Start trace span for action
          const spanId = await obs.startSpan(`action:${action.type}`, {
            action_type: action.type,
            risk_tier: String(action.riskTier),
            step_index: String(stepIndex),
          });
          
          // Generate receipt
          const generator = getReceiptGenerator();
          generator.startAction({
            runId: currentState.currentRunId!,
            actionId: 'action_' + stepIndex,
            action: {
              id: 'action_' + stepIndex,
              type: action.type as any,
              riskTier: action.riskTier,
              timeoutMs: 5000,
              retries: 0,
              target: { strategy: 'css', value: '.element' },
              evidence: { capture: ['screenshot_target', 'dom_hash'] },
            },
            beforeState: {
              url: 'https://example.com',
              title: 'Example',
              domHash: 'hash_' + stepIndex,
            },
          }).then(({ trace }) => {
            generator.generateReceipt({
              runId: currentState.currentRunId!,
              actionId: 'action_' + stepIndex,
              action: {
                id: 'action_' + stepIndex,
                type: action.type as any,
                riskTier: action.riskTier,
                timeoutMs: 5000,
                retries: 0,
                target: { strategy: 'css', value: '.element' },
                evidence: { capture: ['screenshot_target', 'dom_hash'] },
              },
              status: 'success',
              beforeState: {
                url: 'https://example.com',
                title: 'Example',
                domHash: 'hash_before',
              },
              afterState: {
                url: 'https://example.com',
                title: 'Example',
                domHash: 'hash_after',
              },
              artifacts: [
                {
                  kind: 'screenshot',
                  sha256: 'screenshot_hash_' + stepIndex,
                  mime: 'image/png',
                },
                {
                  kind: 'dom_snippet',
                  sha256: 'dom_hash_' + stepIndex,
                },
              ],
              trace,
            }).then(async (receipt) => {
              get().addReceipt(receipt.runId + ':' + receipt.actionId);
              
              // Log receipt generation
              await obs.log({
                event_type: 'receipt.generated',
                severity: 'info',
                source: 'browserAgentStore',
                message: `Receipt generated for action: ${action.type}`,
                payload: {
                  runId: receipt.runId,
                  actionId: receipt.actionId,
                },
              });
              
              // End trace span
              await obs.endSpan(spanId, 'ok');
              
              // Record performance
              await obs.recordPerformance(1500, false);
            });
          });

          stepIndex++;
          executeNext();
        }, 1500);
      };
      
      executeNext();
    },
  }))
);

// ============================================================================
// Selectors
// ============================================================================

export const selectStatus = (state: BrowserAgentState) => state.status;
export const selectMode = (state: BrowserAgentState) => state.mode;
export const selectCurrentAction = (state: BrowserAgentState) => state.currentAction;
export const selectRequiresApproval = (state: BrowserAgentState) => state.requiresApproval;
export const selectGoal = (state: BrowserAgentState) => state.goal;
export const selectReceipts = (state: BrowserAgentState) => state.receipts;

export default useBrowserAgentStore;
