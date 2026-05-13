import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'

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
const SessionsPage = lazy(() => import('./pages/SessionsPage'))
const SignInPage = lazy(() => import('./pages/SignInPage'))
const SignUpPage = lazy(() => import('./pages/SignUpPage'))
const AuthorizePage = lazy(() => import('./pages/OAuthAuthorizePage'))
const SelectAccountPage = lazy(() => import('./pages/OAuthSelectAccountPage'))
const SuccessPage = lazy(() => import('./pages/OAuthSuccessPage'))
const CoworkTeamPage = lazy(() => import('./pages/CoworkTeamPage'))
const CoworkTeamAgentsPage = lazy(() => import('./pages/CoworkTeamAgentsPage'))
const CoworkTeamBoardPage = lazy(() => import('./pages/CoworkTeamBoardPage'))
const CoworkTeamWorkspacesPage = lazy(() => import('./pages/CoworkTeamWorkspacesPage'))
const CoworkTeamWorkspaceDetailPage = lazy(() => import('./pages/CoworkTeamWorkspaceDetailPage'))
const MarketplacePage = lazy(() => import('./pages/MarketplacePage'))
const WorkflowsPage = lazy(() => import('./pages/WorkflowsPage'))
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'))
const TermsPage = lazy(() => import('./pages/TermsPage'))
const StatusPage = lazy(() => import('./pages/StatusPage'))
const ConnectPage = lazy(() => import('./pages/ConnectPage'))
const DebugModePage = lazy(() => import('./pages/DebugModePage'))
const GalleryTestPage = lazy(() => import('./pages/GalleryTestPage'))
const SwarmPreviewPage = lazy(() => import('./pages/SwarmPreviewPage'))
const TerminalTestPage = lazy(() => import('./pages/TerminalTestPage'))
const TerminalClerkPage = lazy(() => import('./pages/TerminalClerkPage'))

export default function AppRoutes() {
  return (
    <Suspense fallback={<AppLoader />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/shell" element={<ShellPage />} />
        <Route path="/shell/sessions" element={<SessionsPage />} />
        <Route path="/shell/new" element={<Navigate to="/shell" replace />} />
        <Route path="/sign-in" element={<SignInPage />} />
        <Route path="/sign-up" element={<SignUpPage />} />
        <Route path="/oauth/authorize" element={<AuthorizePage />} />
        <Route path="/oauth/select-account" element={<SelectAccountPage />} />
        <Route path="/oauth/success" element={<SuccessPage />} />
        <Route path="/cowork-team" element={<CoworkTeamPage />} />
        <Route path="/cowork-team/agents" element={<CoworkTeamAgentsPage />} />
        <Route path="/cowork-team/board" element={<CoworkTeamBoardPage />} />
        <Route path="/cowork-team/workspaces" element={<CoworkTeamWorkspacesPage />} />
        <Route path="/cowork-team/workspaces/:id" element={<CoworkTeamWorkspaceDetailPage />} />
        <Route path="/marketplace" element={<MarketplacePage />} />
        <Route path="/workflows" element={<WorkflowsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/status" element={<StatusPage />} />
        <Route path="/connect" element={<ConnectPage />} />
        <Route path="/debug-mode" element={<DebugModePage />} />
        <Route path="/gallery-test" element={<GalleryTestPage />} />
        <Route path="/swarm-preview" element={<SwarmPreviewPage />} />
        <Route path="/terminal-test" element={<TerminalTestPage />} />
        <Route path="/terminal/clerk" element={<TerminalClerkPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
