import { useCallback, useEffect, useState } from 'react'

import { useOfficeAgent } from '@/agent/useOfficeAgent'
import { getBridge } from '@/lib/bridge-factory'
import { getOfficeHostDisplayName, getOfficeHostPlaceholder } from '@/lib/host-detector'

import type {
  ExtensionSidepanelActivity,
  ExtensionSidepanelAdapter,
  ExtensionSidepanelHistoricalEvent,
} from '../../../../shared/extension-sidepanel/ExtensionSidepanelShell.types'

export function useOfficeSidepanelAdapter() {
  const agent = useOfficeAgent()
  const [pageLabel, setPageLabel] = useState('Allternit Office Add-in')
  const [hostLabel, setHostLabel] = useState('Office Document')

  useEffect(() => {
    setHostLabel(getOfficeHostDisplayName())
    setPageLabel(`${getOfficeHostDisplayName()} · ${getOfficeHostPlaceholder().slice(0, 40)}…`)
  }, [])

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
