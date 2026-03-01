import { useEffect, useMemo, useCallback, useRef, useState, Suspense } from 'react';
import { TabBar } from './ui/tabbar';
import { AssistantProfile } from './components/AssistantProfile';
import { SuggestionWidget } from './components/SuggestionWidget';
import { MarketplaceView } from './components/MarketplaceView';
import { LeftRail, type ViewMode } from './components/LeftRail';
import { CapsuleView } from './components/CapsuleView';
import { OpenWorkView } from './components/OpenWorkView';
import { ChatSessions } from './components/ChatSessions';
import { StudioView } from './components/StudioView';
import { RegistryView } from './components/RegistryView';
import { TwoModeRegistryView } from './components/TwoModeRegistryView';
import { WindowManagerProvider } from './components/windowing/WindowManager';
import { WindowContainer } from './components/windowing';
import { WorkspaceLauncher } from './components/WorkspaceLauncher';
import { DockStoreProvider, DockBar } from './components/dock';
import { TabsetStoreProvider, TabStrip } from './components/tabset';
import { OnboardingProvider } from './runtime/OnboardingContext';
import { OnboardingFlow } from './components/onboarding/OnboardingFlow';
import { ToastProvider, useToasts } from './runtime/ToastContext';
import { useShellState } from './runtime/ShellState';
import { api } from './runtime/ApiClient';
import { DiffPanel } from './components/DiffPanel';
import { ApprovalModal } from './components/ApprovalModal';
import { UpdateBanner } from './components/UpdateBanner';
import { SynthesisTransition } from './components/SynthesisTransition';
import { InspectorDrawer } from './components/InspectorDrawer';
import { RefineDrawer } from './components/RefineDrawer';
import { ConsoleDrawer } from './components/ConsoleDrawer';
import { BrainManagerWidget } from './components/BrainManagerWidget';
import { MemoryManagerWidget } from './components/MemoryManagerWidget';
import { BrainRuntimeTab } from './components/BrainRuntimeTab';
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
import type { ActionSpec, EvidenceObject } from '@a2rchitech/types/capsule-spec';
import { VoiceOrb } from './components/VoiceOrb';
import { GizziPresence } from './components/avatar';
import { ActivityPill } from './components/ActivityPill';
import type { NavTarget } from './runtime/ConversationStore';
import { conversationStore } from './runtime/ConversationStore';
import { activityCenter } from './runtime/ActivityCenter';
import { useBrain, type BrainConfig } from './runtime/BrainContext';
import './styles/layout.css';
import './styles/animations.css';
import './styles/diffs.css';
import './styles/tokens.css';
import './styles/spatial-shell.css';
import './styles/avatar.css';
import './styles/onboarding.css';

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
  const [viewMode, setViewMode] = useState<ViewMode>('canvas');
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
  const [activeChatSessionId, setActiveChatSessionId] = useState<string | undefined>();
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);

  // State for drawer visibility
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [refineOpen, setRefineOpen] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [brainManagerOpen, setBrainManagerOpen] = useState(false);
  const [memoryManagerOpen, setMemoryManagerOpen] = useState(false);

  const previousCapsuleId = useRef<string | null>(null);

  const isFluid = activeCapsuleId ? (
    activeCapsuleId === 'singleton-studio' ||
    activeCapsuleId === 'singleton-browser' ||
    activeCapsuleId === 'singleton-openwork'
  ) : false;

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

    const fetchFrameworks = async () => {
      try {
        // Use gateway client to fetch frameworks instead of direct fetch
        const data: FrameworkSpec[] = await api.getFrameworks();
        setFrameworks(data);
      } catch (err) {
        console.error('Failed to fetch frameworks:', err);
      }
    };

    fetchFrameworks();
  }, [setFrameworks]);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        // Use gateway client to fetch journal stream instead of direct fetch
        const events: KernelJournalEvent[] = await api.getJournalStream();
        addJournalEvents(events);
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

  // Navigation event listener (from ActivityPill and other sources)
  const { setActiveSession } = useBrain();
  useEffect(() => {
    const handleNavigate = (e: Event) => {
      const target = (e as CustomEvent<NavTarget>).detail;
      console.log('[App] Navigation event:', target.kind, target);

      switch (target.kind) {
        case 'tab':
          setViewMode(target.tabId as any);
          break;
        case 'chatSession':
          setActiveChatSessionId(target.chatSessionId);
          setViewMode('chats');
          break;
        case 'brainSession':
          setConsoleOpen(true);
          setActiveSession(target.sessionId);
          break;
      }
    };

    window.addEventListener('navigateToTarget', handleNavigate as EventListener);
    return () => window.removeEventListener('navigateToTarget', handleNavigate as EventListener);
  }, [setActiveSession]);

  // Voice transcript processing - create conversation, link brain session, start activity
  const { activeSessionId, sessions, createSession, setActiveSessionId } = useBrain();
  useEffect(() => {
    const processVoiceInput = async () => {
      // Only process if: have transcript, not listening, not already processing, have text
      if (isListening || isProcessingVoice || !voiceTranscript.trim()) return;

      setIsProcessingVoice(true);
      const text = voiceTranscript.trim();

      try {
        console.log('[App] Processing voice input:', text.substring(0, 50));

        // 1. Create conversation via ConversationStore
        const { conversationId, chatSessionId } = await conversationStore.createConversation({
          source: 'voice',
          title: text.substring(0, 40) + (text.length > 40 ? '...' : ''),
        });

        // 2. Ensure brain session exists
        let sessionId = activeSessionId;
        if (!sessionId) {
          // Create a default brain config
          const defaultConfig: BrainConfig = {
            id: `brain-${Date.now()}`,
            name: 'Voice Assistant',
            brain_type: 'api',
            model: 'claude-sonnet-4-20250514',
            requirements: [],
          };

          try {
            const session = await createSession(defaultConfig);
            sessionId = session.id;
            console.log('[App] Created brain session:', sessionId);
          } catch (err) {
            console.error('[App] Failed to create brain session:', err);
            // Fall back to API mode
            conversationStore.updateTitle(conversationId, 'API Chat');
            setIsProcessingVoice(false);
            setVoiceTranscript('');
            return;
          }
        }

        // 3. Link conversation to brain session
        conversationStore.linkBrainSession(conversationId, sessionId);

        // 4. Start activity tracking
        activityCenter.startActivity({
          kind: 'voice',
          chatSessionId,
          linkedBrainSessionId: sessionId,
          navTarget: { kind: 'chatSession', chatSessionId },
        });

        // 5. Send input to brain
        if (sessionId) {
          try {
            await api.sendBrainInput(sessionId, text);
            console.log('[App] Sent input to brain session:', sessionId);
          } catch (err) {
            console.error('[App] Failed to send input to brain:', err);
          }
        }

        // 6. Reset orb UI
        setIsListening(false);
        setVoiceTranscript('');

        // 7. Navigate only if user is on Home canvas (not already in chats/console)
        const isOnHome = viewMode === 'canvas' && !activeCapsuleId;
        if (isOnHome) {
          setActiveChatSessionId(chatSessionId);
          setViewMode('chats');
        } else {
          // User is already in a different view - show pill instead of forcing navigation
          console.log('[App] User already in viewMode:', viewMode, '- showing pill only');
        }

        console.log('[App] Voice input processed successfully');
      } catch (err) {
        console.error('[App] Failed to process voice input:', err);
      } finally {
        setIsProcessingVoice(false);
      }
    };

    processVoiceInput();
  }, [voiceTranscript, isListening, isProcessingVoice, activeSessionId, createSession, setActiveSessionId]);

  const handleSpawnGenerator = useCallback(() => {
    // Check if we're trying to spawn a browser or studio
    // For now, default to studio; we'll add browser spawning separately
    const studioId = 'singleton-studio';
    const existing = capsules.find(c => c.capsuleId === studioId);

    if (existing) {
      setActiveCapsule(studioId);
      return;
    }

    spawnCapsule({
      capsuleId: studioId,
      title: 'Studio',
      icon: '🛠️',
      category: 'development',
      status: 'ephemeral' as any,
      runRef: { runId: 'studio', sessionId: 'studio' },
      bindings: { journalRefs: [], artifactRefs: [] },
      canvasBundle: [
        {
          canvasId: 'canvas-studio',
          viewType: 'studio_view',
          bindings: { data: {} },
          risk: 'read',
          provenanceUI: { showTrail: false }
        }
      ],
      toolScope: { allowedTools: [], deniedTools: [], requiresConfirmation: [] },
      sandboxPolicy: { allow_network: true, allow_filesystem: true, max_memory_mb: 1024 },
      provenance: {
        frameworkId: 'agenticui',
        frameworkVersion: '1.0',
        agentId: 'user',
        modelId: 'agenticui',
        inputs: [],
        toolCalls: []
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as any);
  }, [capsules, spawnCapsule, setActiveCapsule]);

  const handleSpawnBrowser = useCallback(() => {
    const browserId = 'singleton-browser';
    const existing = capsules.find(c => c.capsuleId === browserId);

    if (existing) {
      setActiveCapsule(browserId);
      return;
    }

    spawnCapsule({
      capsuleId: browserId,
      title: 'Browser',
      icon: '🌐',
      category: 'utility',
      status: 'ephemeral' as any,
      runRef: { runId: 'browser', sessionId: 'browser' },
      bindings: { journalRefs: [], artifactRefs: [] },
      canvasBundle: [
        {
          canvasId: 'canvas-browser',
          viewType: 'browser_view',
          bindings: { data: {} },
          risk: 'read',
          provenanceUI: { showTrail: false }
        }
      ],
      toolScope: { allowedTools: [], deniedTools: [], requiresConfirmation: [] },
      sandboxPolicy: { allow_network: true, allow_filesystem: false, max_memory_mb: 512 },
      provenance: {
        frameworkId: 'browser',
        frameworkVersion: '1.0',
        agentId: 'user',
        modelId: 'browser',
        inputs: [],
        toolCalls: []
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as any);
  }, [capsules, spawnCapsule, setActiveCapsule]);

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
      const data: KernelCapsuleResponse = await api.dispatchIntent(intentText);
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
      const data: ActionResponse = await api.dispatchAction({
        action_id: action.actionId,
        capsule_id: capsuleId,
        view_id: viewId,
        context: {
          capsule_title: capsuleTitle,
          safety_tier: action.safetyTier,
          tool_ref: action.toolRef,
          source: 'action_dock',
        },
      });
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

      {/* Left Rail - Fixed 56px dock */}
      <LeftRail
        viewMode={viewMode as any}
        onViewModeChange={(mode) => setViewMode(mode as 'canvas' | 'studio' | 'registry' | 'marketplace' | 'chats')}
        onSpawnGenerator={handleSpawnGenerator}
        onSpawnBrowser={handleSpawnBrowser}
        activeCapsuleId={activeCapsuleId}
        inspectorOpen={inspectorOpen}
        onToggleInspector={() => setInspectorOpen(!inspectorOpen)}
        consoleOpen={consoleOpen}
        onToggleConsole={() => setConsoleOpen(!consoleOpen)}
        refineOpen={refineOpen}
        onToggleRefine={() => setRefineOpen(!refineOpen)}
        brainManagerOpen={brainManagerOpen}
        onToggleBrainManager={() => setBrainManagerOpen(!brainManagerOpen)}
        memoryManagerOpen={memoryManagerOpen}
        onToggleMemoryManager={() => setMemoryManagerOpen(!memoryManagerOpen)}
      />

      {/* Main Canvas Area - offset by rail width */}
      <div className="canvas-sovereign">
        <TabStrip />
        <WindowContainer />
        {viewMode === 'marketplace' ? (
          <MarketplaceView />
        ) : viewMode === 'chats' ? (
          <ChatSessions
            onSelectSession={(sessionId) => {
              setActiveChatSessionId(sessionId);
            }}
            onNewSession={() => {}}
            onClose={() => setViewMode('canvas')}
            activeSessionId={activeChatSessionId}
          />
        ) : viewMode === 'studio' ? (
          <StudioView />
        ) : viewMode === 'registry' ? (
          <TwoModeRegistryView />
        ) : viewMode === 'openwork' ? (
          <OpenWorkView />
        ) : (
          <>
            <SynthesisTransition
              isSynthesizing={isSynthesizing}
              onComplete={() => setIsSynthesizing(false)}
            >
              <div className={`canvas-inner ${isFluid ? 'fluid' : ''}`}>
                <Suspense fallback={<div className="canvas-loading">Loading Capsule...</div>}>
                  {activeCapsuleId ? (
                    <CapsuleView
                      capsuleId={activeCapsuleId}
                      title={activeCapsule?.title || 'Unknown'}
                      isActive={true}
                    />
                  ) : (
                    <div className="canvas-empty">
                      <ActivityPill />
                    </div>
                  )}
                </Suspense>
                {/* Terminal Access Indicator - subtle indicator at bottom of canvas */}
                <div className="terminal-access-indicator" onClick={() => setConsoleOpen(true)}>
                  <div className="terminal-indicator-line"></div>
                  <div className="terminal-indicator-text">Terminal (Ctrl/Cmd+`)</div>
                </div>
              </div>
            </SynthesisTransition>
          </>
        )}
      </div>

      {/* Inspector Drawer - Slides in from left over canvas */}
      <InspectorDrawer
        isOpen={inspectorOpen}
        onClose={() => setInspectorOpen(false)}
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
        highlightEvidenceId={highlightEvidenceId}
      />

      {/* Refine Drawer - Slides in from right over canvas */}
      <RefineDrawer
        isOpen={refineOpen}
        onClose={() => setRefineOpen(false)}
        actions={activeActions}
        templateSuggestions={activeCapsuleId ? templateSuggestions : []}
        activeTemplateType={selectedTemplateType}
        onTemplateSelect={handleTemplateSelect}
        onActionClick={handleActionClick}
      />

      {/* Console Drawer - Slides up from bottom */}
      <ConsoleDrawer
        isOpen={consoleOpen}
        onToggle={() => setConsoleOpen(!consoleOpen)}
      />

      {/* Gizzi Presence - Docked launcher with mode panel */}
      <GizziPresence
        VoiceOrbComponent={VoiceOrb}
        voiceOrbProps={{
          isListening,
          onToggleListening: () => setIsListening(!isListening),
          transcript: voiceTranscript,
          onTranscript: setVoiceTranscript,
        }}
      />

      {/* Brain Manager Widget - Side-drawer/overlay style (old component kept for rollback) */}
      {false && <BrainManagerWidget 
        isOpen={brainManagerOpen} 
        onClose={() => setBrainManagerOpen(false)} 
      />}

      {/* Brain Runtime Tab - New professional redesign */}
      <BrainRuntimeTab 
        isOpen={brainManagerOpen} 
        onClose={() => setBrainManagerOpen(false)} 
      />

      {/* Memory Manager Widget */}
      <MemoryManagerWidget 
        isOpen={memoryManagerOpen} 
        onClose={() => setMemoryManagerOpen(false)} 
      />

      {/* Workspace Launcher */}
      <WorkspaceLauncher />

      {/* Dock Bar */}
      <DockBar />
    </div>
  );
};

export const App: React.FC = () => (
  <ToastProvider>
    <OnboardingProvider>
      <OnboardingFlow />
      <WindowManagerProvider>
        <DockStoreProvider>
          <TabsetStoreProvider>
            <AppContent />
          </TabsetStoreProvider>
        </DockStoreProvider>
      </WindowManagerProvider>
    </OnboardingProvider>
  </ToastProvider>
);