import { useCallback, useEffect, useState, useRef } from 'react'

import { useOfficeAgent } from '@/agent/useOfficeAgent'
import { getBridge } from '@/lib/bridge-factory'
import { getOfficeHostDisplayName, getOfficeHostPlaceholder, getOfficeHost } from '@/lib/host-detector'

import type {
  ExtensionSidepanelActivity,
  ExtensionSidepanelAdapter,
  ExtensionSidepanelHistoricalEvent,
} from '../../../../shared/extension-sidepanel/ExtensionSidepanelShell.types'

const BROADCAST_CHANNEL_NAME = 'allternit-office-addin';

function broadcastState(state: {
  status: string;
  host: string;
  pageLabel: string;
  currentTask: string | null;
  historyCount: number;
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
  // Also try postMessage for iframe parents
  try {
    window.parent.postMessage(
      {
        source: 'allternit-office-addin',
        payload: state,
      },
      '*'
    );
  } catch {
    // ignore
  }
}

export function useOfficeSidepanelAdapter() {
  const agent = useOfficeAgent()
  const [pageLabel, setPageLabel] = useState('Allternit Office Add-in')
  const [hostLabel, setHostLabel] = useState('Office Document')
  const lastBroadcastRef = useRef<number>(0)

  useEffect(() => {
    setHostLabel(getOfficeHostDisplayName())
    setPageLabel(`${getOfficeHostDisplayName()} · ${getOfficeHostPlaceholder().slice(0, 40)}…`)
  }, [])

  // Broadcast state to platform bridge
  useEffect(() => {
    const now = Date.now();
    // Throttle broadcasts to ~1/sec
    if (now - lastBroadcastRef.current < 900) return;
    lastBroadcastRef.current = now;

    broadcastState({
      status: agent.status,
      host: getOfficeHost(),
      pageLabel: `${getOfficeHostDisplayName()} · ${getOfficeHostPlaceholder().slice(0, 40)}…`,
      currentTask: agent.currentTask ?? null,
      historyCount: agent.history?.length ?? 0,
    });
  }, [agent.status, agent.currentTask, agent.history.length])

  const adapter: ExtensionSidepanelAdapter = {
    status: agent.status,
    history: agent.history as ExtensionSidepanelHistoricalEvent[],
    activity: agent.activity as ExtensionSidepanelActivity | null,
    currentTask: agent.currentTask,
    sessions: [],
    pageLabel,
    hostLabel,
    config: {
      permissionMode: 'act',
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
      async (nextConfig) => {
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
  }

  return { adapter, agent }
}
