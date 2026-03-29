/**
 * BrowserAgentBar - Top-docked control surface for agentic browsing
 * 
 * This is the primary "cockpit" for controlling browser automation.
 * Docks at TOP of BrowserView (not bottom - avoids conflicts with drawer/page footers).
 * 
 * Features:
 * - Endpoint selector (Shell Browser | Extension endpoints)
 * - Goal input with Run/Stop
 * - Mode toggle (Human | Assist | Agent)
 * - Take Over / Hand Off controls
 * - Approve button (conditional on requires_approval state)
 * - Capture button
 * - Session menu
 * - Status pill (Idle / Running / Waiting / Blocked / Done)
 * - Open Drawer button (auto-selects correct tab)
 */

"use client";

import React, { useCallback } from 'react';
import {
  Play,
  Square,
  Hand,
  Sparkle,
  CheckCircle,
  Warning,
  XCircle,
  Clock,
  CaretDown,
  Database,
  WifiHigh,
  WifiSlash,
  Camera,
  DotsThreeVertical,
  SidebarSimple,
  Shield,
  ShieldWarning,
  Lightning,
} from '@phosphor-icons/react';
import { GlassSurface } from '@/design/GlassSurface';
import {
  BrowserAgentStatus,
  BrowserAgentMode,
  BrowserEndpoint,
  RiskTier,
  STATUS_TO_RENDERER,
  MODE_TO_RISK_LIMIT,
  getRiskTierLabel,
} from './browserAgent.types';
import { useBrowserAgentStore } from './browserAgent.store';
import { getPolicyEngine } from '@/capsules/browser/policyService';
import { getObservabilityService } from '@/capsules/browser/observabilityService';

// ============================================================================
// Component
// ============================================================================

export function BrowserAgentBar({ 
  className,
  guidanceMessages = [],
}: { 
  className?: string;
  guidanceMessages?: string[];
}) {
  // Get state and actions from store
  const {
    status,
    mode,
    endpoint,
    goal,
    setGoal,
    runGoal,
    stopExecution,
    takeOver,
    handOff,
    approveAction,
    captureScreenshot,
    openDrawer,
    setMode,
    requiresApproval,
    approvalActionSummary,
    approvalRiskTier,
    currentAction,
    connectedEndpoints,
  } = useBrowserAgentStore();

  // Local state
  const [inputValue, setInputValue] = React.useState(goal);
  const [isExpanded, setIsExpanded] = React.useState(status === 'Running' || status === 'WaitingApproval');
  const [showEndpointMenu, setShowEndpointMenu] = React.useState(false);
  const [showSessionMenu, setShowSessionMenu] = React.useState(false);
  const [isPolicyCheckPending, setIsPolicyCheckPending] = React.useState(false);
  const [policyDenialReason, setPolicyDenialReason] = React.useState<string | null>(null);

  // Sync with external goal
  React.useEffect(() => {
    setInputValue(goal);
  }, [goal]);

  // Auto-expand when running or waiting
  React.useEffect(() => {
    if (status === 'Running' || status === 'WaitingApproval') {
      setIsExpanded(true);
    }
  }, [status]);

  // Handle submit
  const handleSubmit = useCallback(async () => {
    if (inputValue.trim()) {
      const goalText = inputValue.trim();
      
      // Perform policy check before running
      setIsPolicyCheckPending(true);
      setPolicyDenialReason(null);
      
      try {
        const policyEngine = getPolicyEngine();
        const policyResult = await policyEngine.checkPolicy({
          capability: 'execute',
          riskTier: MODE_TO_RISK_LIMIT[mode],
          target: { host: window.location.host, path: window.location.pathname },
        } as any);
        
        // Log policy check
        const obs = getObservabilityService();
        await obs.log({
          event_type: 'policy.check',
          severity: 'info',
          source: 'BrowserAgentBar',
          message: `Policy check for goal: ${goalText}`,
          payload: {
            goal: goalText,
            mode,
            riskTier: MODE_TO_RISK_LIMIT[mode],
            decision: policyResult.decision,
            ruleId: policyResult.ruleId,
          },
        });
        
        if (policyResult.decision === 'deny') {
          setPolicyDenialReason(policyResult.reason || 'Policy violation');
          setIsPolicyCheckPending(false);
          return;
        }
        
        if (policyResult.decision === 'require_confirm') {
          // Store policy result for approval flow
                  await obs.log({
                    event_type: 'policy.confirmation_required',
                    severity: 'warn',
                    source: 'BrowserAgentBar',
          
            message: `Confirmation required: ${policyResult.reason}`,
            payload: {
              goal: goalText,
              confirmationLevel: policyResult.confirmationLevel,
            },
          });
        }
        
        // Clear any previous denial and run
        setPolicyDenialReason(null);
        runGoal(goalText);
        setInputValue('');
        setIsPolicyCheckPending(false);
      } catch (error) {
        console.error('Policy check failed:', error);
        setPolicyDenialReason('Policy check error');
        setIsPolicyCheckPending(false);
      }
    }
  }, [inputValue, runGoal, mode]);

  // Handle key press
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  // Get status label
  const getStatusLabel = (): string => {
    switch (status) {
      case 'Idle':
        return 'Ready';
      case 'Running':
        return currentAction?.stepIndex && currentAction?.totalSteps
          ? `Step ${currentAction.stepIndex}/${currentAction.totalSteps}`
          : 'Running';
      case 'WaitingApproval':
        return 'Waiting Approval';
      case 'Blocked':
        return 'Blocked';
      case 'Done':
        return 'Complete';
      default:
        return 'Unknown';
    }
  };

  // Get mode label
  const getModeLabel = (): string => {
    const tier = MODE_TO_RISK_LIMIT[mode];
    return `${mode} (Tier ${tier})`;
  };

  // Get endpoint label
  const getEndpointLabel = (): string => {
    if (!endpoint) return 'Not connected';
    if (endpoint.type === 'shell_browser') return 'Shell Browser';
    return `Extension (${(endpoint as any).tabId})`;
  };

  // Check if connected
  const isConnected = endpoint !== null;

  return (
    <GlassSurface
      intensity="thick"
      className={`
        relative z-50 border-b
        transition-all duration-300
        ${className || ''}
      `}
      style={{
        background: 'var(--glass-bg-thick)',
        borderBottom: '1px solid var(--border-subtle)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
      }}
    >
      {/* Guidance Messages (for wizard integration) */}
      {guidanceMessages.length > 0 && (
        <div className="guidance-messages-bar px-4 py-2 border-b border-border/50 bg-purple-500/10">
          <div className="flex items-start gap-2">
            <Sparkle className="w-4 h-4 text-purple-400 mt-0.5" />
            <div className="flex-1">
              {guidanceMessages.map((msg, idx) => (
                <p key={idx} className="text-sm text-purple-200">{msg}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Bar */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* LEFT: Endpoint Selector + Status */}
        <div className="flex items-center gap-2 min-w-[180px]">
          <div className="relative">
            <button
              onClick={() => setShowEndpointMenu(!showEndpointMenu)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg
                bg-secondary/50 hover:bg-secondary
                border border-border/50
                transition-colors
                text-sm"
            >
              {isConnected ? (
                <WifiHigh className="w-4 h-4 text-green-500" />
              ) : (
                <WifiSlash className="w-4 h-4 text-red-500" />
              )}
              <span className="max-w-[120px] truncate">{getEndpointLabel()}</span>
              <CaretDown className="w-3 h-3 opacity-50" />
            </button>

            {/* Endpoint Menu */}
            {showEndpointMenu && (
              <EndpointMenu
                endpoints={connectedEndpoints}
                selectedEndpoint={endpoint}
                onSelect={(ep) => {
                  // Handle endpoint selection
                  setShowEndpointMenu(false);
                }}
                onClose={() => setShowEndpointMenu(false)}
              />
            )}
          </div>

          {/* Connection Status Dot */}
          <div
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
            }`}
          />
        </div>

        {/* CENTER: Goal Input + Run/Stop */}
        <div className="flex-1 flex items-center gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                status === 'Running'
                  ? 'Agent is executing...'
                  : status === 'WaitingApproval'
                  ? 'Waiting for approval...'
                  : 'Tell the agent what to do...'
              }
              disabled={status === 'Running' || status === 'WaitingApproval' || isPolicyCheckPending}
              className="w-full px-4 py-2 rounded-lg
                bg-primary/50
                border border-border/50
                focus:border-accent/50 focus:outline-none
                text-sm
                placeholder:text-muted-foreground
                transition-colors
                ${policyDenialReason ? 'border-red-500/50 bg-red-500/10' : ''}"
            />
            {policyDenialReason && (
              <div className="absolute -bottom-6 left-0 text-xs text-red-500 flex items-center gap-1">
                <ShieldWarning size={12} />
                {policyDenialReason}
              </div>
            )}
          </div>

          {status === 'Running' || status === 'WaitingApproval' ? (
            <button
              onClick={stopExecution}
              className="flex items-center gap-2 px-4 py-2 rounded-lg
                bg-red-500/20 hover:bg-red-500/30
                border border-red-500/50
                text-red-500
                transition-colors"
            >
              <Square size={16} />
              <span className="text-sm font-medium">Stop</span>
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!inputValue.trim() || isPolicyCheckPending}
              className="flex items-center gap-2 px-4 py-2 rounded-lg
                bg-accent/20 hover:bg-accent/30
                border border-accent/50
                text-accent
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors
                relative"
            >
              {isPolicyCheckPending ? (
                <Clock className="w-4 h-4 animate-spin" />
              ) : (
                <Play size={16} />
              )}
              <span className="text-sm font-medium">
                {isPolicyCheckPending ? 'Checking...' : 'Run'}
              </span>
            </button>
          )}
        </div>

        {/* RIGHT: Controls */}
        <div className="flex items-center gap-2">
          {/* Mode Toggle */}
          <ModeToggle mode={mode} onModeChange={setMode} disabled={status === 'Running'} />

          {/* Take Over / Hand Off */}
          {mode === 'Assist' || mode === 'Agent' ? (
            <button
              onClick={takeOver}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                bg-secondary/50 hover:bg-secondary
                border border-border/50
                transition-colors
                text-sm"
            >
              <Hand size={16} />
              <span>Take Over</span>
            </button>
          ) : (
            <button
              onClick={handOff}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                bg-secondary/50 hover:bg-secondary
                border border-border/50
                transition-colors
                text-sm"
            >
              <Sparkle size={16} />
              <span>Hand Off</span>
            </button>
          )}

          {/* Approve (conditional) */}
          {requiresApproval && (
            <button
              onClick={approveAction}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg
                bg-green-500/20 hover:bg-green-500/30
                border border-green-500/50
                text-green-500
                animate-pulse
                transition-colors"
            >
              <CheckCircle size={16} />
              <span className="font-medium">Approve</span>
            </button>
          )}

          {/* Capture */}
          <button
            onClick={captureScreenshot}
            className="p-2 rounded-lg
              bg-secondary/50 hover:bg-secondary
              border border-border/50
              transition-colors"
            title="Capture screenshot"
          >
            <Camera size={16} />
          </button>

          {/* Session Menu */}
          <div className="relative">
            <button
              onClick={() => setShowSessionMenu(!showSessionMenu)}
              className="p-2 rounded-lg
                bg-secondary/50 hover:bg-secondary
                border border-border/50
                transition-colors"
            >
              <DotsThreeVertical size={16} />
            </button>

            {showSessionMenu && (
              <SessionMenu
                status={status}
                stepIndex={currentAction?.stepIndex}
                totalSteps={currentAction?.totalSteps}
                onClose={() => setShowSessionMenu(false)}
              />
            )}
          </div>

          {/* Status Pill */}
          <div
            className={`
              flex items-center gap-2 px-3 py-1.5 rounded-full
              text-xs font-medium
              ${STATUS_TO_RENDERER[status]}
              bg-opacity-20
            `}
          >
            {status === 'Running' && <Clock className="w-3 h-3 animate-pulse" />}
            {status === 'WaitingApproval' && <ShieldWarning className="w-3 h-3 animate-pulse" />}
            {status === 'Blocked' && <XCircle size={12} />}
            {status === 'Done' && <CheckCircle size={12} />}
            <span>{getStatusLabel()}</span>
          </div>

          {/* Open Drawer */}
          <button
            onClick={openDrawer}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
              bg-secondary/50 hover:bg-secondary
              border border-border/50
              transition-colors
              text-sm"
          >
            <SidebarSimple size={16} />
            <span>Drawer</span>
          </button>
        </div>
      </div>

      {/* Expanded Section (when running) */}
      {isExpanded && (status === 'Running' || status === 'WaitingApproval') && (
        <div className="px-4 pb-3 pt-0 border-t border-border/30 mt-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              {requiresApproval ? (
                <span className="flex items-center gap-1 text-yellow-500">
                  <ShieldWarning size={12} />
                  {approvalActionSummary || 'Action requires approval'}
                  {approvalRiskTier && (
                    <span className="px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-500">
                      Tier {approvalRiskTier}
                    </span>
                  )}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-blue-500">
                  <Lightning size={12} />
                  Agent executing...
                </span>
              )}
            </div>
            {currentAction?.stepIndex && currentAction?.totalSteps && (
              <div className="flex items-center gap-2">
                <div className="w-32 h-1.5 rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{ width: `${(currentAction.stepIndex / currentAction.totalSteps) * 100}%` }}
                  />
                </div>
                <span>{Math.round((currentAction.stepIndex / currentAction.totalSteps) * 100)}%</span>
              </div>
            )}
          </div>
        </div>
      )}
    </GlassSurface>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function EndpointMenu({
  endpoints,
  selectedEndpoint,
  onSelect,
  onClose,
}: {
  endpoints: BrowserEndpoint[];
  selectedEndpoint: BrowserEndpoint | null;
  onSelect: (endpoint: BrowserEndpoint) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="absolute top-full right-0 mt-2 w-64
        bg-popover border border-border rounded-lg shadow-lg
        z-50 overflow-hidden"
    >
      <div className="px-3 py-2 border-b border-border bg-secondary/50">
        <h4 className="text-sm font-medium">Select Endpoint</h4>
      </div>
      <div className="py-1">
        {endpoints.length === 0 ? (
          <div className="px-3 py-4 text-sm text-muted-foreground text-center">
            No endpoints available
          </div>
        ) : (
          endpoints.map((ep, i) => (
            <button
              key={i}
              onClick={() => onSelect(ep)}
              className={`
                w-full px-3 py-2 text-left text-sm
                hover:bg-accent/10
                flex items-center gap-2
                ${
                  selectedEndpoint?.type === ep.type &&
                  (ep.type === 'shell_browser'
                    ? (selectedEndpoint as any)?.sessionId === (ep as any).sessionId
                    : (selectedEndpoint as any)?.endpointId === (ep as any).endpointId)
                    ? 'bg-accent/20'
                    : ''
                }
              `}
            >
              {ep.type === 'shell_browser' ? (
                <Database size={16} />
              ) : (
                <WifiHigh size={16} />
              )}
              <span>
                {ep.type === 'shell_browser'
                  ? 'Shell Browser'
                  : `Extension Tab ${ep.tabId}`}
              </span>
            </button>
          ))
        )}
      </div>
      <div className="px-3 py-2 border-t border-border bg-secondary/30">
        <button
          onClick={onClose}
          className="w-full text-xs text-muted-foreground hover:text-foreground text-center"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function ModeToggle({
  mode,
  onModeChange,
  disabled,
}: {
  mode: BrowserAgentMode;
  onModeChange: (mode: BrowserAgentMode) => void;
  disabled?: boolean;
}) {
  const modes: BrowserAgentMode[] = ['Human', 'Assist', 'Agent'];

  return (
    <div
      className={`
        flex items-center gap-1 p-1 rounded-lg
        bg-secondary/50 border border-border/50
        ${disabled ? 'opacity-50' : ''}
      `}
    >
      {modes.map((m) => (
        <button
          key={m}
          disabled={disabled}
          onClick={() => onModeChange(m)}
          className={`
            px-3 py-1.5 rounded-md text-xs font-medium
            transition-colors
            ${
              mode === m
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-secondary/80 text-muted-foreground'
            }
          `}
        >
          {m}
        </button>
      ))}
    </div>
  );
}

function SessionMenu({
  status,
  stepIndex,
  totalSteps,
  onClose,
}: {
  status: BrowserAgentStatus;
  stepIndex?: number;
  totalSteps?: number;
  onClose: () => void;
}) {
  return (
    <div
      className="absolute top-full right-0 mt-2 w-56
        bg-popover border border-border rounded-lg shadow-lg
        z-50 overflow-hidden"
    >
      <div className="px-3 py-2 border-b border-border bg-secondary/50">
        <h4 className="text-sm font-medium">Session</h4>
      </div>
      <div className="py-1">
        <div className="px-3 py-2 text-xs text-muted-foreground">
          Status: <span className="text-foreground">{status}</span>
        </div>
        {stepIndex && totalSteps && (
          <div className="px-3 py-2 text-xs text-muted-foreground">
            Progress: {stepIndex}/{totalSteps}
          </div>
        )}
      </div>
      <div className="px-3 py-2 border-t border-border bg-secondary/30">
        <button
          onClick={onClose}
          className="w-full text-xs text-muted-foreground hover:text-foreground text-center"
        >
          Close
        </button>
      </div>
    </div>
  );
}

export default BrowserAgentBar;
