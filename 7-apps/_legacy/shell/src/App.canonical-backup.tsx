import { useEffect, useMemo, useRef, useState } from 'react';
import { TabBar } from './ui/tabbar';
import { AssistantProfile } from './components/AssistantProfile';
import { SuggestionWidget } from './components/SuggestionWidget';
import { MarketplaceView } from './components/MarketplaceView';
import { SplitPane } from './components/SplitPane';
import { EvidenceRail } from './components/EvidenceRail';
import { SynthesisTransition } from './components/SynthesisTransition';
import { ActionDock } from './components/ActionDock';
import { ApprovalModal } from './components/ApprovalModal';
import { UpdateBanner } from './components/UpdateBanner';
import { DiffPanel } from './components/DiffPanel';
import { ToastProvider, useToasts } from './runtime/ToastContext';
import { useShellState } from './runtime/ShellState';
import { api } from './runtime/ApiClient';
import type {
  AssistantIdentity,
  ActionResponse,
  FrameworkSpec,
  KernelCapsuleResponse,
  KernelJournalEvent,
  Suggestion,
} from '../../shared/contracts';
import type { GoalToken } from './components/GoalTokens';
import type { TemplateSuggestion } from './components/TemplateSuggestions';
import type { ActionSpec, EvidenceObject } from '../../types/capsule-spec';
import { Orb } from '../../ui/src/a2ui';
import './styles/layout.css';
import './styles/animations.css';
import './styles/diffs.css';
import './styles/tokens.css';

const TEMPLATE_SUGGESTIONS: TemplateSuggestion[] = [
  { label: 'Compare', capsuleType: 'fwk.diff_review', icon: '⚖️' },
  { label: 'Plan', capsuleType: 'fwk.plan', icon: '📋' },
  { label: 'Study', capsuleType: 'fwk.research', icon: '📚' },
  { label: 'Build', capsuleType: 'fwk.build', icon: '🔨' },
];

const DEFAULT_GOAL_TOKENS: GoalToken[] = [
  { kind: 'intent', value: 'Plan', weight: 0.9 },
  { kind: 'entity', value: 'Workspace', weight: 0.6 },
];

const resolveRecommendedTemplate = (tokens: GoalToken[]): string | null => {
  const intentToken = tokens.find((token) => token.kind === 'intent');
  const normalized = intentToken?.value.toLowerCase() ?? '';

  if (normalized.includes('compare')) return 'fwk.diff_review';
  if (normalized.includes('plan') || normalized.includes('schedule')) return 'fwk.plan';
  if (normalized.includes('study') || normalized.includes('research')) return 'fwk.research';
  if (normalized.includes('build') || normalized.includes('implement')) return 'fwk.build';

  return null;
};

const normalizeActions = (actions: any[]): ActionSpec[] => {
  if (!Array.isArray(actions)) return [];
  return actions
    .map((action) => {
      const actionId = action.actionId ?? action.action_id ?? action.id ?? '';
      if (!actionId) return null;
      return {
        actionId,
        label: action.label ?? action.name ?? action.action_id ?? actionId,
        safetyTier: action.safetyTier ?? action.safety_tier ?? 'read',
        toolRef: action.toolRef ?? action.tool_ref ?? '',
        inputSchema: action.inputSchema ?? action.input_schema ?? {},
        uiAffordance: action.uiAffordance ?? action.ui_affordance,
      } as ActionSpec;
    })
    .filter(Boolean) as ActionSpec[];
};

const requiresApproval = (action: ActionSpec): boolean =>
  action.safetyTier !== 'read';

interface DiffEvent {
  type: string;
  message: string;
  timestamp: number;
  evidenceId?: string;
}

interface PendingApproval {
  action: ActionSpec;
  capsuleId: string;
  capsuleTitle: string;
}

const AppContent: React.FC = () => {
  const {
    capsules,
    activeCapsuleId,
    spawnCapsule,
    removeCapsule,
    setActiveCapsule,
    addJournalEvents,
    showDiffPanel,
    setShowDiffPanel,
  } = useShellState();
  const { addToast } = useToasts();
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [assistant, setAssistant] = useState<AssistantIdentity | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [viewMode, setViewMode] = useState<'canvas' | 'marketplace'>('canvas');
  const [, setFrameworks] = useState<FrameworkSpec[]>([]);
  const [goalTokens, setGoalTokens] = useState<GoalToken[]>(DEFAULT_GOAL_TOKENS);
  const [selectedTemplateType, setSelectedTemplateType] = useState<string | null>(
    TEMPLATE_SUGGESTIONS[1]?.capsuleType ?? TEMPLATE_SUGGESTIONS[0]?.capsuleType ?? null
  );
  const [draftEvidence, setDraftEvidence] = useState<EvidenceObject[]>([]);
  const [capsuleEvidence, setCapsuleEvidence] = useState<Record<string, EvidenceObject[]>>({});
  const [capsuleActions, setCapsuleActions] = useState<Record<string, ActionSpec[]>>({});
  const [updateBannerByCapsule, setUpdateBannerByCapsule] = useState<Record<string, string>>({});
  const [diffEventsByCapsule, setDiffEventsByCapsule] = useState<Record<string, DiffEvent[]>>({});
  const [highlightEvidenceId, setHighlightEvidenceId] = useState<string | null>(null);
  const [canvasTransition, setCanvasTransition] = useState<'idle' | 'left' | 'right'>('idle');
  const [pendingApproval, setPendingApproval] = useState<PendingApproval | null>(null);
  const previousCapsuleId = useRef<string | null>(null);

  const recommendedTemplateType = useMemo(() => resolveRecommendedTemplate(goalTokens), [goalTokens]);
  const activeEvidence = activeCapsuleId ? capsuleEvidence[activeCapsuleId] || [] : draftEvidence;
  const activeCapsule = capsules.find((capsule) => capsule.capsuleId === activeCapsuleId);
  const activeActions = activeCapsuleId ? capsuleActions[activeCapsuleId] || [] : [];
  const templateSuggestions = TEMPLATE_SUGGESTIONS;
  const isEditing = !activeCapsuleId;
  const activeDiffEvents = activeCapsuleId ? diffEventsByCapsule[activeCapsuleId] || [] : [];
  const updateBannerMessage = activeCapsuleId ? updateBannerByCapsule[activeCapsuleId] ?? null : null;

  useEffect(() => {
    api.getAssistant().then(setAssistant).catch(console.error);

    fetch('http://localhost:3003/frameworks')
      .then((res) => res.json())
      .then((data: FrameworkSpec[]) => {
        setFrameworks(data);
      })
      .catch((err) => {
        console.error('Failed to fetch frameworks:', err);
      });
  }, [setFrameworks]);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch('http://localhost:3004/v1/journal/stream');
        if (response.ok) {
          const events: KernelJournalEvent[] = await response.json();
          addJournalEvents(events);
        }

        const newSuggestions = await api.getSuggestions();
        setSuggestions(newSuggestions);
      } catch (err) {
        console.error('Failed to poll journal/suggestions:', err);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [addJournalEvents]);

  useEffect(() => {
    const previousId = previousCapsuleId.current;
    if (previousId === activeCapsuleId) return;

    const prevIndex = previousId ? capsules.findIndex((capsule) => capsule.capsuleId === previousId) : -1;
    const nextIndex = activeCapsuleId ? capsules.findIndex((capsule) => capsule.capsuleId === activeCapsuleId) : -1;
    if (prevIndex !== -1 && nextIndex !== -1) {
      setCanvasTransition(prevIndex < nextIndex ? 'right' : 'left');
      const timer = setTimeout(() => setCanvasTransition('idle'), 300);
      previousCapsuleId.current = activeCapsuleId;
      return () => clearTimeout(timer);
    }

    previousCapsuleId.current = activeCapsuleId;
  }, [activeCapsuleId, capsules]);

  useEffect(() => {
    if (!activeCapsuleId) {
      setShowDiffPanel(false);
    }
  }, [activeCapsuleId, setShowDiffPanel]);

  const setEvidenceForActive = (updater: (current: EvidenceObject[]) => EvidenceObject[]) => {
    if (activeCapsuleId) {
      setCapsuleEvidence(prev => ({
        ...prev,
        [activeCapsuleId]: updater(prev[activeCapsuleId] || []),
      }));
      return;
    }
    setDraftEvidence(updater);
  };

  const addDiffEvent = (capsuleId: string, event: DiffEvent) => {
    setDiffEventsByCapsule(prev => ({
      ...prev,
      [capsuleId]: [...(prev[capsuleId] || []), event],
    }));
  };

  const handleAddEvidence = (input: string) => {
    const trimmed = input.trim();
    if (!trimmed) return;
    const id = `ev_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
    const isUrl = /^https?:\/\//i.test(trimmed);
    let title = trimmed;
    let uri: string | undefined;
    let favicon: string | undefined;
    if (isUrl) {
      try {
        const url = new URL(trimmed);
        title = url.hostname;
        uri = url.toString();
        favicon = `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=64`;
      } catch {
        uri = trimmed;
      }
    }

    const newEvidence: EvidenceObject = {
      evidenceId: id,
      kind: isUrl ? 'url' : 'note',
      title,
      uri,
      favicon,
      snapshotRef: `snap_${id}`,
      extractedSchema: {},
      metadata: {},
      extractionStatus: 'loading',
      pinState: 'none',
      freshness: 'recent',
      confidence: 0.86,
    };

    setEvidenceForActive(current => [newEvidence, ...current]);

    setTimeout(() => {
      setEvidenceForActive(current =>
        current.map(evidence =>
          evidence.evidenceId === id ? { ...evidence, extractionStatus: 'ready' } : evidence
        )
      );
    }, 700);

    if (activeCapsuleId) {
      const message = `Updated evidence: +1 item (${id.slice(0, 8)}...)`;
      setUpdateBannerByCapsule(prev => ({
        ...prev,
        [activeCapsuleId]: message,
      }));
      addDiffEvent(activeCapsuleId, {
        type: 'evidenceAdded',
        message: `Added ${title}`,
        timestamp: Date.now(),
        evidenceId: id,
      });
    }
  };

  const cleanupCapsuleState = (capsuleId: string) => {
    setCapsuleEvidence(prev => {
      const next = { ...prev };
      delete next[capsuleId];
      return next;
    });
    setUpdateBannerByCapsule(prev => {
      const next = { ...prev };
      delete next[capsuleId];
      return next;
    });
    setDiffEventsByCapsule(prev => {
      const next = { ...prev };
      delete next[capsuleId];
      return next;
    });
    setCapsuleActions(prev => {
      const next = { ...prev };
      delete next[capsuleId];
      return next;
    });
    setPendingApproval(prev => (prev?.capsuleId === capsuleId ? null : prev));
  };

  const closeCapsule = (capsuleId: string) => {
    removeCapsule(capsuleId);
    cleanupCapsuleState(capsuleId);
    setShowDiffPanel(false);
  };

  const handlePinToggle = (evidenceId: string) => {
    setEvidenceForActive(current =>
      current.map(evidence => {
        if (evidence.evidenceId !== evidenceId) return evidence;
        const nextPinState = evidence.pinState === 'pinned' ? 'none' : 'pinned';
        return { ...evidence, pinState: nextPinState };
      })
    );
  };

  const handleExcludeToggle = (evidenceId: string) => {
    setEvidenceForActive(current =>
      current.map(evidence => {
        if (evidence.evidenceId !== evidenceId) return evidence;
        const nextPinState = evidence.pinState === 'excluded' ? 'none' : 'excluded';
        return { ...evidence, pinState: nextPinState };
      })
    );
  };

  const handleHighlightEvidence = (evidenceId: string) => {
    setHighlightEvidenceId(evidenceId);
    const target = document.getElementById(`evidence-${evidenceId}`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setTimeout(() => setHighlightEvidenceId(null), 1600);
  };

  const handleTemplateSelect = async (capsuleType: string) => {
    setSelectedTemplateType(capsuleType);
    if (!activeCapsuleId) return;

    const templateLabel = templateSuggestions.find((template) => template.capsuleType === capsuleType)?.label ?? 'Template';
    try {
      await api.recompileCapsule(activeCapsuleId, capsuleType);
      addToast(`Recompiled using ${templateLabel}`, 'success', 4000);
    } catch (err) {
      console.error('Failed to recompile capsule:', err);
      addToast(`Failed to recompile capsule`, 'error', 5000);
    }
  };

  const handleIntent = async () => {
    setIsSynthesizing(true);
    const inferredTemplateType = selectedTemplateType ?? recommendedTemplateType ?? templateSuggestions[0]?.capsuleType;
    const templateLabel = templateSuggestions.find((template) => template.capsuleType === inferredTemplateType)?.label ?? 'Generic';
    const goalText = goalTokens.map((token) => token.value).join(' ').trim();
    const intentText = goalText ? `${goalText} (${templateLabel})` : `Apply template: ${templateLabel}`;
    const draftEvidenceSnapshot = [...draftEvidence];
    const draftGoalSnapshot = [...goalTokens];

    try {
      const response = await fetch('http://localhost:3004/v1/intent/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent_text: intentText }),
      });

      if (!response.ok) {
        throw new Error(`Kernel returned ${response.status}`);
      }

      const data: KernelCapsuleResponse = await response.json();
      const capsulePayload: any = (data as any).capsule ?? data;
      const capsuleId: string | undefined =
        capsulePayload?.capsuleId ??
        capsulePayload?.id ??
        (data as any).capsule_id ??
        (data as any).capsuleId;

      if (!capsuleId) {
        throw new Error('Kernel response missing capsule id');
      }

      spawnCapsule(capsulePayload as any);
      setCapsuleActions(prev => ({
        ...prev,
        [capsuleId]: normalizeActions((capsulePayload as any)?.actions || []),
      }));
      setActiveCapsule(capsuleId);
      setCapsuleEvidence(prev => ({
        ...prev,
        [capsuleId]: draftEvidenceSnapshot,
      }));
      setDraftEvidence([]);
      addToast(`Created ${capsulePayload?.title || 'Capsule'}`, 'success', 5000, {
        actionLabel: 'Undo',
        onAction: () => {
          closeCapsule(capsuleId);
          setDraftEvidence(draftEvidenceSnapshot);
          setGoalTokens(draftGoalSnapshot);
        },
      });
    } catch (err) {
      console.error('Failed to dispatch intent:', err);
      addToast(`Failed to create capsule`, 'error', 5000);
    } finally {
      setIsSynthesizing(false);
    }
  };

  const dispatchAction = async (action: ActionSpec, capsuleId: string) => {
    const capsule = capsules.find((entry) => entry.capsuleId === capsuleId);
    const capsuleTitle = capsule?.title ?? 'Capsule';
    const viewId = (capsule as any)?.activeCanvasId ?? 'action_dock';

    try {
      const response = await fetch('http://localhost:3004/v1/actions/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_id: action.actionId,
          capsule_id: capsuleId,
          view_id: viewId,
          context: {
            capsule_title: capsuleTitle,
            safety_tier: action.safetyTier,
            tool_ref: action.toolRef,
            source: 'action_dock',
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Kernel returned ${response.status}`);
      }

      const data: ActionResponse = await response.json();
      if (data.events?.length) {
        addJournalEvents(data.events);
      }
      addToast(data.message || `Action ${action.label} executed`, 'success', 5000);
    } catch (err) {
      console.error('Failed to dispatch action:', err);
      addToast(`Failed to execute ${action.label}`, 'error', 5000);
    }
  };

  const handleActionClick = (actionId: string) => {
    if (!activeCapsuleId) return;
    const action = activeActions.find((entry) => entry.actionId === actionId);
    if (!action) return;

    if (requiresApproval(action)) {
      setPendingApproval({
        action,
        capsuleId: activeCapsuleId,
        capsuleTitle: activeCapsule?.title ?? 'Capsule',
      });
      return;
    }

    dispatchAction(action, activeCapsuleId);
  };

  const handleApprovalConfirm = () => {
    if (!pendingApproval) return;
    const { action, capsuleId } = pendingApproval;
    setPendingApproval(null);
    dispatchAction(action, capsuleId);
  };

  const handleApprovalCancel = () => {
    setPendingApproval(null);
  };

  return (
    <div className="shell-layout">
      {pendingApproval && (
        <ApprovalModal
          action={pendingApproval.action}
          capsuleTitle={pendingApproval.capsuleTitle}
          onConfirm={handleApprovalConfirm}
          onCancel={handleApprovalCancel}
        />
      )}
      {updateBannerMessage && (
        <UpdateBanner
          message={updateBannerMessage}
          onClick={() => setShowDiffPanel(true)}
          onDismiss={() => {
            if (!activeCapsuleId) return;
            setUpdateBannerByCapsule(prev => {
              const next = { ...prev };
              delete next[activeCapsuleId];
              return next;
            });
          }}
        />
      )}
      <DiffPanel
        events={activeDiffEvents}
        isOpen={showDiffPanel}
        onClose={() => setShowDiffPanel(false)}
        onHighlightSection={handleHighlightEvidence}
      />
      <div className="framework-sidebar">
        <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
            <Orb endpoint="http://localhost:3004/v1/embodiment/stream" />
        </div>
        <AssistantProfile identity={assistant} onUpdate={setAssistant} />
        <div className="sidebar-nav">
          <button
            className={`nav-item ${viewMode === 'canvas' ? 'active' : ''}`}
            onClick={() => setViewMode('canvas')}
            type="button"
          >
            🖥️ Workspace
          </button>
          <button
            className={`nav-item ${viewMode === 'marketplace' ? 'active' : ''}`}
            onClick={() => setViewMode('marketplace')}
            type="button"
          >
            🛒 Marketplace
          </button>
        </div>
        <SuggestionWidget suggestions={suggestions} />
        {showDiffPanel && (
          <button
            className="nav-item diff-toggle"
            onClick={() => setShowDiffPanel(false)}
            type="button"
          >
            📊 Diff Panel
          </button>
        )}
      </div>
      <div className="main-shell">
        {viewMode === 'marketplace' ? (
          <MarketplaceView />
        ) : (
          <>
            <TabBar
              capsules={capsules}
              activeCapsuleId={activeCapsuleId}
              onActivate={(id) => {
                setActiveCapsule(id);
              }}
              onClose={(id) => {
                closeCapsule(id);
              }}
            />
            <SynthesisTransition
              isSynthesizing={isSynthesizing}
              onComplete={() => setIsSynthesizing(false)}
            >
              <SplitPane
                leftPane={
                  <EvidenceRail
                    evidence={activeEvidence}
                    onPinToggle={handlePinToggle}
                    onExclude={handleExcludeToggle}
                    onAddEvidence={handleAddEvidence}
                    onSynthesize={handleIntent}
                    canSynthesize
                    goalTokens={goalTokens}
                    onGoalTokensUpdate={setGoalTokens}
                    onGoalTokensRemove={setGoalTokens}
                    templateSuggestions={templateSuggestions}
                    selectedTemplateType={selectedTemplateType}
                    recommendedTemplateType={recommendedTemplateType}
                    onTemplateSelect={handleTemplateSelect}
                    showGoalTools={isEditing}
                    showSynthesize={isEditing}
                    showComposer
                    highlightEvidenceId={highlightEvidenceId}
                  />
                }
                centerPane={
                  <div className={`canvas-switch canvas-switch-${canvasTransition}`}>
                    {activeCapsuleId ? (
                      <div className="canvas-content">
                        <p>Active capsule: {activeCapsuleId}</p>
                        <p>Capsule rendering placeholder - will be replaced with actual capsule canvas</p>
                      </div>
                    ) : (
                      <div className="canvas-placeholder">
                        <p>Canvas Area - Active capsule: {activeCapsuleId}</p>
                      </div>
                    )}
                  </div>
                }
                rightPane={
                  <ActionDock
                    actions={activeActions}
                    templateSuggestions={activeCapsuleId ? templateSuggestions : []}
                    activeTemplateType={selectedTemplateType}
                    onTemplateSelect={handleTemplateSelect}
                    onActionClick={handleActionClick}
                  />
                }
              />
            </SynthesisTransition>
          </>
        )}
      </div>
    </div>
  );
};

export const App: React.FC = () => (
  <ToastProvider>
    <AppContent />
  </ToastProvider>
);
