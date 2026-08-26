import { Suspense, lazy, useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { installOfficeDesktopBridge } from './views/office/desktop-bridge'

const AppLoader = () => (
  <div
    role="status"
    aria-live="polite"
    aria-busy="true"
    aria-label="Loading Allternit Platform"
    style={{
      position: 'fixed',
      inset: 0,
      background: '#1A1612',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '28px',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', userSelect: 'none' }}>
      <span style={{ color: '#D97757', fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 400, letterSpacing: '0.04em' }}>A://</span>
      <span style={{ color: '#C8BDB4', fontFamily: 'var(--font-research)', fontSize: 22, fontWeight: 400, letterSpacing: '0.18em' }}>LLTERNIT</span>
    </div>
    <div style={{ width: '120px', height: '1px', background: 'rgba(200,168,140,0.12)', position: 'relative', overflow: 'hidden', borderRadius: '1px' }}>
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          width: '40%',
          background: 'linear-gradient(90deg, transparent 0%, #D97757 50%, transparent 100%)',
          animation: 'an-shimmer 1.6s cubic-bezier(0.4,0,0.6,1) infinite',
        }}
      />
    </div>
    <style>{`
      @keyframes an-shimmer {
        0%   { transform: translateX(-200%) }
        100% { transform: translateX(350%) }
      }
    `}</style>
  </div>
)

// ─── Lazy page imports ─────────────────────────────────────────────────────────

const HomePage = lazy(() => import('./pages/HomePage'))
const ShellPage = lazy(() => import('./pages/ShellPage'))
const SettingsPreviewPage = lazy(() =>
  import('./views/settings/SettingsView').then((mod) => ({
    default: () => <mod.SettingsView initialSection="infrastructure" />,
  }))
)
const SessionsPage = lazy(() => import('./pages/SessionsPage'))
const SignInPage = lazy(() => import('./pages/SignInPage'))
const SignUpPage = lazy(() => import('./pages/SignUpPage'))
const RuntimePairingPage = lazy(() => import('./pages/RuntimePairingPage'))
const RuntimesPage = lazy(() => import('./pages/RuntimesPage'))
const AuthorizePage = lazy(() => import('./pages/OAuthAuthorizePage'))
const SelectAccountPage = lazy(() => import('./pages/OAuthSelectAccountPage'))
const SuccessPage = lazy(() => import('./pages/OAuthSuccessPage'))
const MarketplacePage = lazy(() => import('./pages/MarketplacePage'))
const WorkflowsPage = lazy(() => import('./pages/WorkflowsPage'))
const GoalsListPage = lazy(() => import('./pages/GoalsListPage'))
const GoalDetailPage = lazy(() => import('./pages/GoalDetailPage'))
const AgentActivityListPage = lazy(() => import('./pages/AgentActivityListPage'))
const AgentActivityDetailPage = lazy(() => import('./pages/AgentActivityDetailPage'))
const RoutinesListPage = lazy(() => import('./pages/RoutinesListPage'))
const LoopsListPage = lazy(() => import('./pages/LoopsListPage'))
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'))
const TermsPage = lazy(() => import('./pages/TermsPage'))
const StatusPage = lazy(() => import('./pages/StatusPage'))
const ConnectPage = lazy(() => import('./pages/ConnectPage'))
const ExtensionInstalledPage = lazy(() => import('./pages/ExtensionInstalledPage'))
const DebugModePage = lazy(() => import('./pages/DebugModePage'))
const GalleryTestPage = lazy(() => import('./pages/GalleryTestPage'))
const SwarmPreviewPage = lazy(() => import('./pages/SwarmPreviewPage'))
const TerminalTestPage = lazy(() => import('./pages/TerminalTestPage'))
const TerminalClerkPage = lazy(() => import('./pages/TerminalClerkPage'))
const OfficeAuthBridgePage = lazy(() => import('./pages/OfficeAuthBridgePage'))
const DispatchJoinPage = lazy(() => import('./pages/DispatchJoinPage'))
const DesignPage = lazy(() => import('./pages/DesignPage'))
const DocsPage = lazy(() => import('./pages/DocsPage'))
const SlidesPage = lazy(() => import('./pages/SlidesPage'))
const SheetsPage = lazy(() => import('./pages/SheetsPage'))
const PdfPage = lazy(() => import('./pages/PdfPage'))
const MarkdownPreviewPage = lazy(() => import('./pages/MarkdownPreviewPage'))
const OfficeLauncherPage = lazy(() => import('./pages/OfficeLauncherPage'))
const SignDocumentPage = lazy(() => import('./pages/SignDocumentPage'))
const HudPage = lazy(() => import('./pages/HudPage'))

export default function AppRoutes() {
  const navigate = useNavigate();

  // Receive "Open with Allternit" file payloads when running in the desktop
  // shell; no-op in the browser.
  useEffect(() => {
    installOfficeDesktopBridge((path, options) => navigate(path, options));
  }, [navigate]);

  return (
    <Suspense fallback={<AppLoader />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/shell" element={<ShellPage />} />
        <Route path="/settings-preview" element={<SettingsPreviewPage />} />
        <Route path="/shell/sessions" element={<SessionsPage />} />
        <Route path="/shell/recents" element={<ShellPage />} />
        <Route path="/shell/new" element={<Navigate to="/shell" replace />} />
        <Route path="/sign-in/*" element={<SignInPage />} />
        <Route path="/sign-up/*" element={<SignUpPage />} />
        <Route path="/pair" element={<RuntimePairingPage />} />
        <Route path="/runtimes" element={<RuntimesPage />} />
        <Route path="/oauth/authorize" element={<AuthorizePage />} />
        <Route path="/oauth/select-account" element={<SelectAccountPage />} />
        <Route path="/oauth/success" element={<SuccessPage />} />
        <Route path="/marketplace" element={<MarketplacePage />} />
        <Route path="/workflows" element={<WorkflowsPage />} />
        <Route path="/automation/goals" element={<GoalsListPage />} />
        <Route path="/automation/goals/:id" element={<GoalDetailPage />} />
        <Route path="/agent-activity" element={<AgentActivityListPage />} />
        <Route path="/agent-activity/:threadId" element={<AgentActivityDetailPage />} />
        <Route path="/automation/routines" element={<RoutinesListPage />} />
        <Route path="/automation/loops" element={<LoopsListPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/status" element={<StatusPage />} />
        <Route path="/connect" element={<ConnectPage />} />
        <Route path="/extension/installed" element={<ExtensionInstalledPage />} />
        <Route path="/debug-mode" element={<DebugModePage />} />
        <Route path="/gallery-test" element={<GalleryTestPage />} />
        <Route path="/swarm-preview" element={<SwarmPreviewPage />} />
        <Route path="/terminal-test" element={<TerminalTestPage />} />
        <Route path="/terminal/clerk" element={<TerminalClerkPage />} />
        <Route path="/office-auth-bridge" element={<OfficeAuthBridgePage />} />
        <Route path="/dispatch/join" element={<DispatchJoinPage />} />
        <Route path="/design" element={<DesignPage />} />
        <Route path="/docs/:artifactId?" element={<DocsPage />} />
        <Route path="/slides/:artifactId?" element={<SlidesPage />} />
        <Route path="/sheets/:artifactId?" element={<SheetsPage />} />
        <Route path="/pdf/:artifactId?" element={<PdfPage />} />
        <Route path="/markdown-preview" element={<MarkdownPreviewPage />} />
        <Route path="/office" element={<OfficeLauncherPage />} />
        <Route path="/sign" element={<SignDocumentPage />} />
        <Route path="/hud" element={<HudPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
