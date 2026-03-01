import * as React from 'react';
import type { CapsuleSpec, CapsuleInstance } from '../../../shared/contracts';

interface CanvasSpec {
  canvasId: string;
  title: string;
  views: any[];
}

interface ShellStateContextValue {
  capsules: CapsuleInstance[];
  activeCapsuleId: string | null;
  spawnCapsule: (capsule: CapsuleSpec) => void;
  removeCapsule: (capsuleId: string) => void;
  setActiveCapsule: (id: string | null) => void;
  addJournalEvents: (events: any[]) => void;
  journalEvents: any[];
  canvasesByCapsuleId: Map<string, CanvasSpec>;
  showDiffPanel: boolean;
  setShowDiffPanel: (show: boolean) => void;
}

export const ShellStateContext = React.createContext<ShellStateContextValue | undefined>(undefined);

export const useShellState = (): ShellStateContextValue => {
  const context = React.useContext(ShellStateContext);
  console.log('[useShellState] Context value:', context);
  if (!context) {
    console.error('[useShellState] Context is undefined! Component is outside ShellStateProvider.');
    return {
      capsules: [],
      activeCapsuleId: null,
      spawnCapsule: () => {},
      removeCapsule: () => {},
      setActiveCapsule: () => {},
      addJournalEvents: () => {},
      journalEvents: [],
      canvasesByCapsuleId: new Map(),
      showDiffPanel: false,
      setShowDiffPanel: () => {},
    };
  }
  return context;
};

interface ShellStateProviderProps {
  children: React.ReactNode;
}

export const ShellStateProvider: React.FC<ShellStateProviderProps> = ({ children }) => {
  console.log('[ShellStateProvider] Rendering with children:', children);
  const [capsules, setCapsules] = React.useState<CapsuleInstance[]>([]);
  const [activeCapsuleId, setActiveCapsule] = React.useState<string | null>(null);
  const [journalEvents, setJournalEvents] = React.useState<any[]>([]);

  const spawnCapsule = React.useCallback((capsule: CapsuleSpec) => {
    const capsuleId =
      (capsule as any).capsuleId ??
      (capsule as any).id ??
      (capsule as any).capsule_id ??
      '';
    const newCapsule: CapsuleInstance = {
      capsuleId,
      frameworkId: (capsule as any).frameworkId || 'unknown',
      title: (capsule as any).title || 'Untitled Capsule',
      createdAt: Date.now(),
      state: {},
      activeCanvasId: undefined,
      persistenceMode: 'ephemeral',
      sandbox_policy: (capsule as any).sandboxPolicy || (capsule as any).sandbox_policy || { type: 'strict' },
      tool_scope: (capsule as any).toolScope || (capsule as any).tool_scope || [],
    };

    if (capsule.canvasBundle && capsule.canvasBundle.length > 0) {
      const isIFrame = capsule.canvasBundle.some(b => b.viewType === 'iframe_view');
      
      setCanvasesByCapsuleId(prev => {
        const next = new Map(prev);
        next.set(capsuleId, {
          canvasId: capsule.canvasBundle[0].canvasId,
          title: isIFrame ? '' : capsule.title,
          views: capsule.canvasBundle.map(b => ({
            viewId: 'v-' + b.canvasId,
            type: b.viewType as any,
            title: isIFrame ? undefined : capsule.title,
            bindings: b.bindings || {},
            data: {
              ...(b.bindings?.data || {}),
              url: b.bindings?.data?.url || ('http://127.0.0.1:8188/?v=' + Date.now())
            }
          }))
        });
        return next;
      });
    }

    setCapsules(prev => [...prev, newCapsule]);
    setActiveCapsule(capsuleId);
  }, []);

  const removeCapsule = React.useCallback((capsuleId: string) => {
    setCapsules(prev => prev.filter(capsule => capsule.capsuleId !== capsuleId));
    setActiveCapsule(prev => (prev === capsuleId ? null : prev));
  }, []);

  const addJournalEvents = React.useCallback((events: any[]) => {
    console.log('Journal events:', events);
    setJournalEvents(prev => [...prev, ...events]);
  }, []);

  const [showDiffPanel, setShowDiffPanel] = React.useState(false);
  const [canvasesByCapsuleId, setCanvasesByCapsuleId] = React.useState<Map<string, any>>(new Map());

  const value: ShellStateContextValue = {
    capsules,
    activeCapsuleId,
    spawnCapsule,
    removeCapsule,
    setActiveCapsule,
    addJournalEvents,
    journalEvents,
    canvasesByCapsuleId,
    showDiffPanel,
    setShowDiffPanel,
  };

  console.log('[ShellStateProvider] Context value provided:', value);

  return (
    <ShellStateContext.Provider value={value}>
      {children}
    </ShellStateContext.Provider>
  );
};
