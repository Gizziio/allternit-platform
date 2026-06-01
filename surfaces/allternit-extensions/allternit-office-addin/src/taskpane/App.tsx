import { useEffect, useMemo } from 'react'
import { ExtensionSidepanelShell } from '../../../extension-shared/extension-sidepanel/ExtensionSidepanelShell'
import { getOfficeHostDisplayName, getOfficeHostPlaceholder } from '@/lib/host-detector'
import { OfficeConfigPanel } from './components/OfficeConfigPanel'
import { ToolApprovalOverlay } from './components/ToolApprovalOverlay'
import { useOfficeSidepanelAdapter } from './useOfficeSidepanelAdapter'
import type { ExtensionSidepanelConfig } from '../../../extension-shared/extension-sidepanel/ExtensionSidepanelShell.types'

function useSyncDarkClass() {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return

    const html = document.documentElement
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const sync = () => {
      if (mediaQuery.matches) {
        html.classList.add('dark')
      } else {
        html.classList.remove('dark')
      }
    }

    sync()

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', sync)
      return () => mediaQuery.removeEventListener('change', sync)
    }

    mediaQuery.addListener(sync)
    return () => mediaQuery.removeListener(sync)
  }, [])
}

export default function App() {
  useSyncDarkClass()
  const { adapter, agent } = useOfficeSidepanelAdapter()

  // Computed inside the component — Office.onReady has already fired by the time
  // React renders, so getOfficeHostDisplayName() returns the correct host name.
  // useMemo with [] prevents recomputing on every re-render while still being
  // evaluated after onReady (unlike a module-level constant).
  const copy = useMemo(() => {
    const hostLabel = getOfficeHostDisplayName()
    return {
      title: 'Allternit',
      subtitle: hostLabel,
      emptyStateTitle: 'Allternit',
      emptyStateDescription: getOfficeHostPlaceholder(),
      readyLabel: 'Ready',
      contextLabel: hostLabel,
      settingsEyebrow: 'Add-in Settings',
      settingsTitle: 'Configure Allternit for this Office add-in.',
      settingsDescription: 'Set your API key, model, and preferences.',
      settingsContextLabel: hostLabel,
    }
  }, [])

  return (
    <div className="relative h-full w-full">
      <ExtensionSidepanelShell
        adapter={adapter}
        copy={copy}
        testId="office-addin-shell"
        renderConfigView={({ onBack }) => (
          <OfficeConfigPanel
            config={agent.config}
            onSave={async (next: Partial<ExtensionSidepanelConfig>) => {
              if (agent.config) {
                await agent.configure({
                  ...agent.config,
                  ...next,
                  maxSteps: next.maxSteps ?? agent.config.maxSteps,
                  systemInstruction: next.systemInstruction ?? agent.config.systemInstruction,
                  language:
                    next.language === 'zh-CN'
                      ? 'zh'
                      : next.language === 'en-US'
                        ? 'en'
                        : agent.config.language,
                })
              }
              onBack()
            }}
            onBack={onBack}
          />
        )}
      />
      <ToolApprovalOverlay
        approvals={agent.pendingApprovals}
        onApprove={agent.approveTool}
        onReject={agent.rejectTool}
      />
    </div>
  )
}
