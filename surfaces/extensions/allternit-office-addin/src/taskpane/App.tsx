import { useMemo } from 'react'
import { ExtensionSidepanelShell } from '../../../../shared/extension-sidepanel/ExtensionSidepanelShell'
import { getOfficeHostDisplayName, getOfficeHostPlaceholder } from '@/lib/host-detector'
import { OfficeConfigPanel } from './components/OfficeConfigPanel'
import { useOfficeSidepanelAdapter } from './useOfficeSidepanelAdapter'

export default function App() {
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
    <ExtensionSidepanelShell
      adapter={adapter}
      copy={copy}
      testId="office-addin-shell"
      renderConfigView={({ onBack }) => (
        <OfficeConfigPanel
          config={agent.config}
          onSave={async (next) => {
            if (agent.config) await agent.configure({ ...agent.config, ...next })
            onBack()
          }}
          onBack={onBack}
        />
      )}
    />
  )
}
