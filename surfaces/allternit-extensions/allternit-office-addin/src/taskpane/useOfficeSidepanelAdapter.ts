import { useCallback, useEffect, useRef, useState } from 'react'

import { useOfficeAgent } from '@/agent/useOfficeAgent'
import { getBridge } from '@/lib/bridge-factory'
import { getOfficeHostDisplayName, getOfficeHostPlaceholder, getOfficeHost, getOfficeManifestUrl } from '@/lib/host-detector'
import { useConnectivity } from './hooks/useConnectivity'
import {
  bootstrapOfficeRuntime,
  getOfficeBootstrapState,
  getPlatformOrigin,
  resolveOfficeDocumentSnapshot,
  syncOfficeRuntimeState,
  type OfficeBindingSnapshot,
} from '@/lib/platform-gateway'

import type {
  ExtensionSidepanelActivity,
  ExtensionSidepanelAdapter,
  ExtensionSidepanelConfig,
  ExtensionSidepanelHistoricalEvent,
} from '../../../extension-shared/extension-sidepanel/ExtensionSidepanelShell.types'

const BROADCAST_CHANNEL_NAME = 'allternit-office-addin';

function broadcastState(state: {
  status: string;
  host: string;
  hostConnected: boolean;
  runtimeMode: 'office-host' | 'companion-only';
  pageLabel: string;
  currentTask: string | null;
  historyCount: number;
  gatewayStatus?: 'connected' | 'error' | 'pending' | 'companion-only';
  bindingId?: string | null;
  documentTitle?: string | null;
  workspaceId?: string | null;
  projectId?: string | null;
}) {
  try {
    const bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    bc.postMessage({
      source: 'allternit-office-addin',
      payload: state,
    });
    bc.close();
  } catch {
    // BroadcastChannel not supported — ignore
  }
  // Only message a real parent iframe host, never the standalone taskpane window.
  if (window.parent !== window) {
    try {
      window.parent.postMessage(
        {
          source: 'allternit-office-addin',
          payload: state,
        },
        getPlatformOrigin()
      );
    } catch {
      // ignore
    }
  }
}

export function useOfficeSidepanelAdapter() {
  const agent = useOfficeAgent()
  const connectivity = useConnectivity()
  const officeHost = getOfficeHost()
  const hasRealOfficeHost = officeHost !== 'unknown'
  const [pageLabel, setPageLabel] = useState('Allternit Office Add-in')
  const [hostLabel, setHostLabel] = useState('Office Document')
  const [binding, setBinding] = useState<OfficeBindingSnapshot | null>(null)
  const [gatewayStatus, setGatewayStatus] = useState<'pending' | 'connected' | 'error' | 'companion-only'>(
    hasRealOfficeHost ? 'pending' : 'companion-only',
  )
  const lastBroadcastRef = useRef<number>(0)
  const lastContextFingerprintRef = useRef<string>('')
  const documentChangeIntervalRef = useRef<number | null>(null)

  // ── Refs for values that effects need but should NOT trigger re-runs ──
  const pageLabelRef = useRef(pageLabel)
  const bindingRef = useRef(binding)
  const agentStatusRef = useRef(agent.status)
  const agentCurrentTaskRef = useRef(agent.currentTask)
  const agentHistoryLengthRef = useRef(agent.history.length)

  useEffect(() => { pageLabelRef.current = pageLabel }, [pageLabel])
  useEffect(() => { bindingRef.current = binding }, [binding])
  useEffect(() => { agentStatusRef.current = agent.status }, [agent.status])
  useEffect(() => { agentCurrentTaskRef.current = agent.currentTask }, [agent.currentTask])
  useEffect(() => { agentHistoryLengthRef.current = agent.history.length }, [agent.history.length])

  // ── One-time setup: host label, page label, initial binding ──
  useEffect(() => {
    setHostLabel(getOfficeHostDisplayName())
    const baseLabel = `${getOfficeHostDisplayName()} · ${getOfficeHostPlaceholder().slice(0, 40)}…`
    const state = getOfficeBootstrapState()
    if (state.context.workspaceId || state.context.projectId) {
      const parts = [baseLabel]
      if (state.context.workspaceId) parts.push(`Workspace: ${state.context.workspaceId.slice(0, 8)}`)
      if (state.context.projectId) parts.push(`Project: ${state.context.projectId.slice(0, 8)}`)
      setPageLabel(parts.join(' · '))
    } else {
      setPageLabel(baseLabel)
    }
  }, [])

  // ── Bootstrap: run once on mount to create the backend binding ──
  useEffect(() => {
    let cancelled = false

    async function bootstrapBinding() {
      if (!hasRealOfficeHost) {
        setBinding(null)
        setGatewayStatus('companion-only')
        return
      }
      try {
        const context = await getBridge().getContext()
        const document = await resolveOfficeDocumentSnapshot(context)
        const bootstrapState = getOfficeBootstrapState()
        const result = await bootstrapOfficeRuntime({
          document,
          platform: {
            taskpane_origin: window.location.origin,
            taskpane_url: window.location.href,
            manifest_url: getOfficeManifestUrl(),
            platform_origin: getPlatformOrigin(),
          },
          runtimeState: {
            status: agentStatusRef.current,
            page_label: pageLabelRef.current,
            current_task: agentCurrentTaskRef.current ?? null,
            history_count: agentHistoryLengthRef.current ?? 0,
            connected: true,
          },
          projectId: bootstrapState.context.projectId,
          workspaceId: bootstrapState.context.workspaceId,
        })
        if (cancelled) return
        setBinding(result.binding)
        setGatewayStatus('connected')
        // Update pageLabel to reflect context from binding
        const state = getOfficeBootstrapState()
        const baseLabel = `${getOfficeHostDisplayName()} · ${getOfficeHostPlaceholder().slice(0, 40)}…`
        if (result.binding.workspace_id || result.binding.project_id || state.context.workspaceId || state.context.projectId) {
          const parts = [baseLabel]
          const wsId = result.binding.workspace_id ?? state.context.workspaceId
          const prId = result.binding.project_id ?? state.context.projectId
          if (wsId) parts.push(`Workspace: ${wsId.slice(0, 8)}`)
          if (prId) parts.push(`Project: ${prId.slice(0, 8)}`)
          setPageLabel(parts.join(' · '))
        }
      } catch (error) {
        if (cancelled) return
        setGatewayStatus('error')
        console.error('[OfficeSidepanel] gateway bootstrap failed', error)
      }
    }

    void bootstrapBinding()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasRealOfficeHost])

  // ── Heartbeat: sync runtime state when agent state changes ──
  // Debounced 400ms to batch rapid state changes during streaming.
  useEffect(() => {
    if (!binding?.id || !hasRealOfficeHost) return

    const timeout = window.setTimeout(() => {
      void (async () => {
        try {
          const bootstrapState = getOfficeBootstrapState()
          const currentBinding = bindingRef.current
          if (!currentBinding?.id) return
          const result = await syncOfficeRuntimeState({
            bindingId: currentBinding.id,
            platform: {
              taskpane_origin: window.location.origin,
              taskpane_url: window.location.href,
              manifest_url: getOfficeManifestUrl(),
              platform_origin: getPlatformOrigin(),
            },
            runtimeState: {
              status: agentStatusRef.current,
              page_label: pageLabelRef.current,
              current_task: agentCurrentTaskRef.current ?? null,
              history_count: agentHistoryLengthRef.current ?? 0,
              connected: true,
            },
            projectId: currentBinding.project_id ?? bootstrapState.context.projectId,
            workspaceId: currentBinding.workspace_id ?? bootstrapState.context.workspaceId,
          })
          setBinding(result.binding)
          setGatewayStatus('connected')
        } catch (error) {
          setGatewayStatus('error')
          console.error('[OfficeSidepanel] gateway sync failed', error)
        }
      })()
    }, 400)

    return () => window.clearTimeout(timeout)
  }, [agent.status, agent.currentTask, agent.history.length, binding?.id, hasRealOfficeHost])

  // ── Broadcast state to platform bridge ──
  // Throttled to ~1/sec.
  useEffect(() => {
    const now = Date.now();
    if (now - lastBroadcastRef.current < 900) return;
    lastBroadcastRef.current = now;

    broadcastState({
      status: agent.status,
      host: officeHost,
      hostConnected: hasRealOfficeHost,
      runtimeMode: hasRealOfficeHost ? 'office-host' : 'companion-only',
      pageLabel: `${getOfficeHostDisplayName()} · ${getOfficeHostPlaceholder().slice(0, 40)}…`,
      currentTask: agent.currentTask ?? null,
      historyCount: agent.history?.length ?? 0,
      gatewayStatus,
      bindingId: binding?.id ?? null,
      documentTitle: binding?.title ?? null,
      workspaceId: binding?.workspace_id ?? null,
      projectId: binding?.project_id ?? null,
    });
  }, [agent.status, agent.currentTask, agent.history.length, binding?.id, binding?.title, binding?.workspace_id, binding?.project_id, gatewayStatus, hasRealOfficeHost, officeHost])

  // ── Document change detection ──
  // Poll document context every 8 seconds. Only depends on binding.id and gatewayStatus
  // so the interval is NOT recreated on every agent state change.
  useEffect(() => {
    if (!binding?.id || gatewayStatus !== 'connected' || !hasRealOfficeHost) return

    const currentBinding = binding
    let interval: number | null = null

    function tick() {
      void (async () => {
        try {
          const ctx = await getBridge().getContext()
          const fingerprint = `${ctx.host}:${ctx.label}:${ctx.summary.slice(0, 200)}`
          if (fingerprint === lastContextFingerprintRef.current) return
          lastContextFingerprintRef.current = fingerprint

          const document = await resolveOfficeDocumentSnapshot(ctx)
          const bootstrapState = getOfficeBootstrapState()
          const result = await syncOfficeRuntimeState({
            bindingId: currentBinding.id,
            document,
            platform: {
              taskpane_origin: window.location.origin,
              taskpane_url: window.location.href,
              manifest_url: getOfficeManifestUrl(),
              platform_origin: getPlatformOrigin(),
            },
            runtimeState: {
              status: agentStatusRef.current,
              page_label: pageLabelRef.current,
              current_task: agentCurrentTaskRef.current ?? null,
              history_count: agentHistoryLengthRef.current ?? 0,
              connected: true,
            },
            projectId: currentBinding.project_id ?? bootstrapState.context.projectId,
            workspaceId: currentBinding.workspace_id ?? bootstrapState.context.workspaceId,
          })
          setBinding(result.binding)
        } catch (error) {
          console.error('[OfficeSidepanel] document change sync failed', error)
        }
      })()
    }

    function start() {
      if (interval) return
      tick()
      interval = window.setInterval(tick, 8000)
      documentChangeIntervalRef.current = interval
    }

    function stop() {
      if (interval) {
        window.clearInterval(interval)
        interval = null
        documentChangeIntervalRef.current = null
      }
    }

    function onVisibilityChange() {
      if (document.hidden) {
        stop()
      } else {
        start()
      }
    }

    start()
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [binding?.id, gatewayStatus, hasRealOfficeHost])

  const adapter: ExtensionSidepanelAdapter = {
    status: agent.status,
    history: agent.history as ExtensionSidepanelHistoricalEvent[],
    activity: agent.activity as ExtensionSidepanelActivity | null,
    currentTask: agent.currentTask,
    sessions: [],
    pageLabel,
    hostLabel,
    config: {
      permissionMode: 'ask',
      language: agent.config?.language === 'zh' ? 'zh-CN' : 'en-US',
      runtimeLabel: `${getOfficeHostDisplayName()} add-in runtime`,
      apiKey: agent.config?.apiKey,
      baseURL: agent.config?.baseURL,
      model: agent.config?.model,
      maxSteps: agent.config?.maxSteps ?? null,
      systemInstruction: agent.config?.systemInstruction ?? null,
    },

    execute: useCallback(
      (task: string) => {
        const bridge = getBridge()
        bridge
          .getContext()
          .then((ctx) => agent.execute(task, ctx.summary))
          .catch((err: unknown) => {
            // context read failed — fall back to executing without context
            void agent.execute(task, 'Document context unavailable.')
            console.error('[OfficeSidepanel] context read failed', err)
          })
      },
      [agent],
    ),

    stop: agent.stop,

    configure: useCallback(
      async (nextConfig: Partial<ExtensionSidepanelConfig>) => {
        if (!agent.config) return
        await agent.configure({
          ...agent.config,
          apiKey: nextConfig.apiKey ?? agent.config.apiKey,
          baseURL: nextConfig.baseURL ?? agent.config.baseURL,
          model: nextConfig.model ?? agent.config.model,
          maxSteps: nextConfig.maxSteps ?? undefined,
          systemInstruction: nextConfig.systemInstruction ?? undefined,
          language: nextConfig.language === 'zh-CN' ? 'zh' : 'en',
        })
      },
      [agent],
    ),
    connectivity,
  }

  return { adapter, agent }
}
