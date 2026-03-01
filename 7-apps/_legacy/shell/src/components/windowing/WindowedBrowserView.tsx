import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { useWindowManager, useWindow, useWindowBounds } from './index';
import { getElectronBrowserHost } from '../../host/electronBrowserHost';
import { navigateTo } from '../../host/browserActions';
import { emitIntentChanged, emitNavRequested } from '../../host/browserEvents';
import { CapsuleWindowFrame } from './CapsuleWindowFrame';
import { InspectorCapsule } from './InspectorCapsule';
import { AgentStepsCapsule } from './AgentStepsCapsule';
import { A2UISurface } from '../a2ui/A2UISurface';
import { browserAdapter, BROWSER_ACTION_IDS } from './BrowserAdapter';
import { useAgUi } from './useAgUi';

// ============================================================================
// Types
// ============================================================================

export interface BrowserState {
  intent: 'user' | 'agent';
  url: string;
  title: string;
  loading: boolean;
  tabId: string | null;
  tabs: Array<{ id: string; url: string; title: string }>;
  error: string | null;
}

// ============================================================================
// Styles
// ============================================================================

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  chrome: {
    flexShrink: 0,
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    padding: '0 8px',
    backgroundColor: '#1E1E1E',
    borderBottom: '1px solid #333',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
    zIndex: 10,
    overflow: 'hidden',
  },
  browserSurface: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#fff',
    position: 'relative' as const,
    overflow: 'hidden',
  },
  contentLayout: {
    flex: 1,
    display: 'flex',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  rightRail: {
    width: '300px',
    backgroundColor: '#1A1A2E',
    borderLeft: '1px solid #333',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  stageSurface: {
    width: '100%',
    height: '100%',
    position: 'absolute' as const,
    top: 0,
    left: 0,
  },
};

// CSS overrides for A2UI components in the Browser Chrome
const CHROME_CSS = `
  .browser-chrome-surface {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
  }
  .browser-chrome-surface .a2ui-container {
    display: flex;
    flex-direction: row;
    align-items: center;
    height: 100%;
  }
  .browser-chrome-surface .a2ui-container.a2ui-grow {
    flex: 1;
  }
  .browser-chrome-surface .a2ui-button {
    height: 28px;
    display: flex;
    alignItems: center;
    justifyContent: center;
    border: none;
    border-radius: 4px;
    background: #333;
    color: #FFF;
    cursor: pointer;
    font-size: 13px;
    padding: 0 12px;
    white-space: nowrap;
  }
  .browser-chrome-surface .a2ui-button.ghost {
    background: transparent;
    color: #E0E0E0;
    font-size: 16px;
  }
  .browser-chrome-surface .a2ui-button.primary {
    background: #4A90E2;
  }
  .browser-chrome-surface .a2ui-textfield {
    flex: 1;
    background: #2D2D2D;
    border: 1px solid #444;
    color: white;
    border-radius: 14px;
    height: 28px;
    padding: 0 12px;
    font-size: 13px;
    width: 100%;
  }
`;

// ============================================================================
// Component Props
// ============================================================================

interface WindowedBrowserViewProps {
  capsuleId: string;
  spaceId: string;
  initialUrl?: string;
  windowId?: string;
  onWindowCreated?: (windowId: string) => void;
  onClose?: () => void;
  onOpenInspector?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export const WindowedBrowserView: React.FC<WindowedBrowserViewProps> = ({
  capsuleId,
  spaceId,
  initialUrl = 'https://www.google.com',
  windowId: providedWindowId,
  onWindowCreated,
  onClose,
  onOpenInspector,
}) => {
  const { createWindow, focusWindow, getWindow, closeWindow, getContentBoundsForElectron } = useWindowManager();
  const [windowId, setWindowId] = useState<string | null>(providedWindowId ?? null);
  const [browserState, setBrowserState] = useState<BrowserState>({
    intent: 'user',
    url: initialUrl,
    title: 'Google',
    loading: false,
    tabId: null,
    tabs: [],
    error: null,
  });
  const [showInspector, setShowInspector] = useState(false);
  const [showAgentSteps, setShowAgentSteps] = useState(false);
  const [dockedPanel, setDockedPanel] = useState<'inspector' | 'agent_steps' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const stageSurfaceRef = useRef<HTMLDivElement>(null);
  const [titleBarHeight, setTitleBarHeight] = useState(32);
  const initStartedRef = useRef(false);
  const stageReadyRef = useRef(false);
  const stagedTabIdRef = useRef<string | null>(null);
  
  const browserDataRef = useRef(browserState);
  useEffect(() => {
    Object.assign(browserDataRef.current, browserState);
  }, [browserState]);

  const { isConnected: isAgUiConnected, applyPatchesToSchema } = useAgUi();

  const chromeSchema = useMemo(() => {
    const base = browserAdapter.renderChrome(browserState);
    console.log('[FPRINT] BrowserAdapter schema output:', {
      nodeType: base.type,
      childCount: base.props?.children?.length,
      types: base.props?.children?.map((c: any) => c.type)
    });
    return applyPatchesToSchema(base);
  }, [browserState.intent, browserState.loading, browserState.tabId, browserState.tabs, browserState.error, applyPatchesToSchema]);

  const handleModelChange = useCallback((path: string, value: unknown) => {
    (browserDataRef.current as any)[path] = value;
  }, []);

  const handleTabAdd = useCallback(async (url: string = 'https://www.google.com') => {
    const host = getElectronBrowserHost();
    const result = await host.createTab(url, 'user');
    if (result.success && result.tabId) {
      const newTab = { id: result.tabId, url, title: 'New Tab' };
      setBrowserState(prev => ({
        ...prev,
        tabs: [...prev.tabs, newTab],
        tabId: result.tabId!,
        url: url,
        title: 'New Tab'
      }));
      stagedTabIdRef.current = result.tabId;
      const bounds = getContentBoundsForElectron(windowId!, { titleBarHeight });
      if (bounds) await host.attachStage(result.tabId, bounds);
    }
  }, [windowId, titleBarHeight, getContentBoundsForElectron]);

  const handleTabSwitch = useCallback(async (tabId: string) => {
    const tab = browserState.tabs.find(t => t.id === tabId);
    if (!tab) return;
    const host = getElectronBrowserHost();
    const currentTabId = stagedTabIdRef.current;
    if (currentTabId) await host.detachStage(currentTabId);
    stagedTabIdRef.current = tabId;
    setBrowserState(prev => ({ ...prev, tabId: tabId, url: tab.url, title: tab.title }));
    const bounds = getContentBoundsForElectron(windowId!, { titleBarHeight });
    if (bounds) await host.attachStage(tabId, bounds);
  }, [browserState.tabs, windowId, titleBarHeight, getContentBoundsForElectron]);

  const handleNavigation = useCallback(async (url: string) => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;
    let normalizedUrl = trimmedUrl;
    if (!/^https?:\/\//i.test(normalizedUrl)) normalizedUrl = `https://${normalizedUrl}`;
    setBrowserState(prev => ({ 
      ...prev, 
      url: normalizedUrl, 
      loading: true,
      tabs: prev.tabs.map(t => t.id === prev.tabId ? { ...t, url: normalizedUrl } : t)
    }));
    const tabId = stagedTabIdRef.current;
    if (!tabId) {
      setBrowserState(prev => ({ ...prev, loading: false }));
      return;
    }
    emitNavRequested(tabId, normalizedUrl, browserState.intent);
    await navigateTo(normalizedUrl, browserState.intent);
    setBrowserState(prev => ({ ...prev, loading: false }));
  }, [browserState.intent]);

  const handleIntentChange = useCallback(async (intent: 'user' | 'agent') => {
    setBrowserState(prev => ({ ...prev, intent, loading: true }));
    const tabId = stagedTabIdRef.current;
    if (tabId) {
      emitIntentChanged(tabId, intent, 'user');
      if (intent === 'agent') await navigateTo(browserState.url, 'agent');
      else await navigateTo(browserState.url, 'user');
    }
    setBrowserState(prev => ({ ...prev, loading: false }));
  }, [browserState.url]);

  const handleNav = useCallback(async (action: string) => {
    const host = getElectronBrowserHost();
    const tabId = stagedTabIdRef.current;
    if (!tabId) return;
    switch (action) {
      case 'back': host.goBack(tabId); break;
      case 'forward': host.goForward(tabId); break;
      case 'reload': host.reload(tabId); break;
    }
  }, []);

  const handleA2UIAction = useCallback((actionId: string, context: any) => {
    switch (actionId) {
      case BROWSER_ACTION_IDS.NAV_BACK: handleNav('back'); break;
      case BROWSER_ACTION_IDS.NAV_FORWARD: handleNav('forward'); break;
      case BROWSER_ACTION_IDS.NAV_RELOAD: handleNav('reload'); break;
      case BROWSER_ACTION_IDS.NAV_GO: handleNavigation((browserDataRef.current as any).url || context.url); break;
      case BROWSER_ACTION_IDS.MODE_TOGGLE: handleIntentChange(browserState.intent === 'user' ? 'agent' : 'user'); break;
      case BROWSER_ACTION_IDS.VIEW_INSPECTOR: setShowInspector(prev => !prev); break;
      case BROWSER_ACTION_IDS.DOCK_INSPECTOR: setDockedPanel(prev => prev === 'inspector' ? null : 'inspector'); break;
      case BROWSER_ACTION_IDS.VIEW_AGENT_STEPS: setShowAgentSteps(prev => !prev); break;
      case BROWSER_ACTION_IDS.DOCK_AGENT_STEPS: setDockedPanel(prev => prev === 'agent_steps' ? null : 'agent_steps'); break;
      case BROWSER_ACTION_IDS.TAB_ADD: handleTabAdd(); break;
      case BROWSER_ACTION_IDS.TAB_SWITCH: handleTabSwitch(context.id); break;
    }
  }, [handleNav, handleNavigation, handleIntentChange, handleTabAdd, handleTabSwitch, browserState.intent]);

  useEffect(() => {
    const host = getElectronBrowserHost();
    if (!host.isAvailable()) return;
    if (browserState.tabId || initStartedRef.current) return;
    initStartedRef.current = true;
    const timeoutId = setTimeout(() => {
      if (initStartedRef.current && !stageReadyRef.current) {
        setBrowserState(prev => ({ ...prev, error: 'Initialization timed out.' }));
        initStartedRef.current = false;
      }
    }, 10000);
    const initBrowser = async () => {
      let currentWindowId = windowId;
      if (!currentWindowId) {
        currentWindowId = createWindow({
          capsuleId, spaceId, title: 'Browser',
          x: 100, y: 100, width: 1024, height: 768,
        });
        setWindowId(currentWindowId);
        onWindowCreated?.(currentWindowId);
      }
      const result = await host.createTab(initialUrl, 'user');
      if (!result.success || !result.tabId) {
        setBrowserState(prev => ({ ...prev, error: 'Failed to create tab' }));
        initStartedRef.current = false;
        return;
      }
      stagedTabIdRef.current = result.tabId;
      setBrowserState(prev => ({ 
        ...prev, tabId: result.tabId!, 
        tabs: [{ id: result.tabId!, url: initialUrl, title: 'Google' }] 
      }));
      const bounds = getContentBoundsForElectron(currentWindowId, { titleBarHeight });
      if (bounds) await host.attachStage(result.tabId!, bounds);
      stageReadyRef.current = true;
      clearTimeout(timeoutId);
    };
    void initBrowser().catch(() => clearTimeout(timeoutId));
  }, [windowId, browserState.tabId, initialUrl, titleBarHeight, capsuleId, spaceId, createWindow, getContentBoundsForElectron, onWindowCreated]);

  useWindowBounds(windowId ?? '', useCallback(() => {
    const currentTabId = stagedTabIdRef.current;
    if (!currentTabId || !stageSurfaceRef.current || !stageReadyRef.current) return;
    const r = stageSurfaceRef.current.getBoundingClientRect();
    void getElectronBrowserHost().setStageBounds(currentTabId, {
      x: Math.round(r.left), y: Math.round(r.top),
      width: Math.round(Math.max(64, r.width)), height: Math.round(Math.max(64, r.height)),
    });
  }, [windowId]));

  const capsuleWindow = windowId ? useWindow(windowId) : null;
  useEffect(() => { if (windowId) focusWindow(windowId); }, [windowId, focusWindow]);
  useEffect(() => setTitleBarHeight(32), []);

  if (!windowId || !capsuleWindow) return <div style={{ padding: '20px', color: '#9ca3af' }}>Initializing window...</div>;

  return (
    <CapsuleWindowFrame windowId={windowId} onClose={onClose} showControls={true} showTitle={true}>
      <style>{CHROME_CSS}</style>
      <div ref={containerRef} style={styles.container}>
        <div style={styles.chrome}>
          <A2UISurface schema={chromeSchema} dataModel={browserDataRef.current as any} onAction={handleA2UIAction} onModelChange={handleModelChange} className="browser-chrome-surface" />
        </div>
        <div style={styles.contentLayout}>
          <div style={styles.browserSurface}>
            <div ref={stageSurfaceRef} id="stage-surface" data-testid="browser-stage-surface" />
          </div>
          {dockedPanel === 'inspector' && <div style={styles.rightRail}><InspectorCapsule capsuleId={capsuleId} spaceId={spaceId} connectedBrowserId={browserState.tabId || undefined} windowId="docked-inspector" onClose={() => setDockedPanel(null)} /></div>}
          {dockedPanel === 'agent_steps' && <div style={styles.rightRail}><AgentStepsCapsule capsuleId={capsuleId} spaceId={spaceId} connectedBrowserId={browserState.tabId || undefined} windowId="docked-agent-steps" onClose={() => setDockedPanel(null)} /></div>}
        </div>
      </div>
      {showInspector && ReactDOM.createPortal(<InspectorCapsule capsuleId={capsuleId} spaceId={spaceId} connectedBrowserId={browserState.tabId || undefined} onClose={() => setShowInspector(false)} />, document.body)}
      {showAgentSteps && ReactDOM.createPortal(<AgentStepsCapsule capsuleId={capsuleId} spaceId={spaceId} connectedBrowserId={browserState.tabId || undefined} onClose={() => setShowAgentSteps(false)} />, document.body)}
    </CapsuleWindowFrame>
  );
};

export default WindowedBrowserView;