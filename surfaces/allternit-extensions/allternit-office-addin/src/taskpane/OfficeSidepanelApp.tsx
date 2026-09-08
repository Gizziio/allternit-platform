import { ExtensionSidepanelShell } from '../../../extension-shared/extension-sidepanel/ExtensionSidepanelShell'

import { AProtocolMark } from './components/AProtocolMark'
import { OfficeConfigPanel } from './components/OfficeConfigPanel'
import { ToolApprovalOverlay } from './components/ToolApprovalOverlay'
import { useOfficeSidepanelAdapter } from './useOfficeSidepanelAdapter'

const OFFICE_SIDEPANEL_COPY = {
  title: 'Allternit for Office',
  subtitle: 'Word · Excel · PowerPoint',
  emptyStateTitle: 'Allternit for Office',
  emptyStateDescription: 'Ask AI to read, analyze, and edit the open document',
  emptyStateSuggestions: [
    'Summarize the open document',
    'Rewrite the selected text',
    'Audit formulas and data',
    'Create speaker notes',
  ],
  communityLinks: false,
  readyLabel: 'Ready',
  contextLabel: 'Open Document',
  settingsEyebrow: 'Office Add-in Settings',
  settingsTitle: 'Connection and agent settings.',
  settingsDescription:
    'Sign in with Allternit to run the in-pane agent through the platform gateway. Connection and model overrides are for advanced and local-dev use.',
  settingsContextLabel: 'Runtime',
} as const

/** Brand mark for the chat header — the A:// core at task-pane scale. */
function OfficeBrandIcon() {
  return <AProtocolMark height={15} markOnly ink="#29201A" />
}

/** Hero mark for the empty state — larger, so the coral core reads clearly. */
function OfficeBrandHero() {
  return <AProtocolMark height={56} markOnly ink="#29201A" />
}

/**
 * Full in-pane AI experience. Rendered only when Office.js initialized and a
 * gateway bootstrap/auth context is available (see runtime-mode.ts). Wraps
 * the shared ExtensionSidepanelShell around the Office agent adapter, with
 * the Office settings panel as the config view and the destructive-tool
 * approval overlay mounted above the shell.
 */
export default function OfficeSidepanelApp() {
  const { adapter, agent } = useOfficeSidepanelAdapter()

  return (
    <div className="relative h-full min-h-0">
      <ExtensionSidepanelShell
        adapter={adapter}
        copy={OFFICE_SIDEPANEL_COPY}
        testId="office-sidepanel-shell"
        containerClassName="h-full min-h-0"
        appearance="light"
        brandIcon={<OfficeBrandIcon />}
        emptyStateBrandIcon={<OfficeBrandHero />}
        renderConfigView={({ onBack }) => (
          <OfficeConfigPanel
            config={agent.config}
            onBack={onBack}
            onSave={async (next) => {
              await adapter.configure({
                apiKey: next.apiKey,
                baseURL: next.baseURL,
                model: next.model,
                maxSteps: next.maxSteps ?? null,
                systemInstruction: next.systemInstruction ?? null,
                language: next.language === 'zh' ? 'zh-CN' : 'en-US',
              })
              onBack()
            }}
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
