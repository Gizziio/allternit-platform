import { useMemo, useState, useCallback } from 'react'
import { ClerkProvider, SignInButton, useAuth } from '@clerk/clerk-react'
import {
  OfficeHostProvider,
  createBrowserHost,
  DocsApp,
  SheetsApp,
  SlidesApp,
  PdfApp,
  SignApp,
  type OfficeHost,
  type OpenOptions,
} from '@allternit/allternit-office-suite'
import { createStandaloneAiClient } from './ai/createStandaloneAiClient'
import { CLERK_PUBLISHABLE_KEY } from './clerkConfig'
import { HomePage } from './HomePage'

type AppTab = 'docs' | 'sheets' | 'slides' | 'pdf' | 'sign'

interface OpenedDoc {
  name: string
  bytes: Uint8Array
}

const TABS: { id: AppTab; label: string }[] = [
  { id: 'docs', label: 'Docs' },
  { id: 'sheets', label: 'Sheets' },
  { id: 'slides', label: 'Slides' },
  { id: 'pdf', label: 'PDF' },
  { id: 'sign', label: 'Sign' },
]

const ACCEPT_MAP: Record<AppTab, OpenOptions['accept']> = {
  docs: {
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  },
  sheets: {
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  },
  slides: {
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  },
  pdf: { 'application/pdf': ['.pdf'] },
  sign: { 'application/pdf': ['.pdf'] },
}

function CloudPromptBanner() {
  return (
    <div
      style={{
        flexShrink: 0,
        padding: 'var(--space-2) var(--space-3)',
        background: 'color-mix(in srgb, var(--accent-primary) 12%, transparent)',
        borderBottom: '1px solid var(--border-default)',
        fontSize: 'var(--text-sm)',
        color: 'var(--text-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--space-3)',
      }}
    >
      <span>
        Running locally without sign-in.{' '}
        <span style={{ color: 'var(--text-secondary)' }}>
          Sign in to Allternit to use the AI assistant and cloud features.
        </span>
      </span>
      <SignInButton mode="modal">
        <button
          type="button"
          style={{
            flexShrink: 0,
            padding: 'var(--space-1) var(--space-3)',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            background: 'var(--accent-primary)',
            color: 'var(--text-inverse)',
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--font-weight-semibold)',
            cursor: 'pointer',
            transition: 'filter var(--transition-fast)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.filter = 'brightness(1.08)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.filter = 'none'
          }}
        >
          Sign in to Allternit
        </button>
      </SignInButton>
    </div>
  )
}

function OfficeWorkspace({ onBack }: { onBack: () => void }) {
  const { isSignedIn } = useAuth()
  const [activeTab, setActiveTab] = useState<AppTab>('docs')
  const [documents, setDocuments] = useState<Partial<Record<AppTab, OpenedDoc>>>({})
  const [mountKey, setMountKey] = useState(0)

  const host = useMemo<OfficeHost>(() => {
    const ai = createStandaloneAiClient({ getIsSignedIn: () => isSignedIn ?? false })
    return createBrowserHost({
      getLanguage: () => 'en',
      ai,
    })
  }, [isSignedIn])

  const handleOpenFile = useCallback(async () => {
    const result = await host.openFile({ accept: ACCEPT_MAP[activeTab], multiple: false })
    if (!result) return
    const opened = Array.isArray(result) ? result[0] : result
    if (!opened) return
    setDocuments((prev) => ({ ...prev, [activeTab]: { name: opened.name, bytes: opened.bytes } }))
    setMountKey((k) => k + 1)
  }, [host, activeTab])

  const documentForTab = documents[activeTab]

  return (
    <OfficeHostProvider host={host}>
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <nav
          style={{
            flexShrink: 0,
            height: 48,
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-1)',
            padding: '0 var(--space-3)',
            borderBottom: '1px solid var(--border-default)',
            background: 'var(--surface-panel)',
          }}
        >
          <button
            type="button"
            onClick={onBack}
            style={{
              fontWeight: 'var(--font-weight-semibold)',
              marginRight: 'var(--space-3)',
              color: 'var(--accent-primary)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: 'var(--text-base)',
              transition: 'color var(--transition-fast)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--accent-secondary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--accent-primary)'
            }}
          >
            Allternit Office
          </button>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: 'var(--space-1) var(--space-3)',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background:
                  activeTab === tab.id ? 'var(--accent-primary)' : 'transparent',
                color:
                  activeTab === tab.id
                    ? 'var(--text-inverse)'
                    : 'var(--text-primary)',
                cursor: 'pointer',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--font-weight-medium)',
                transition:
                  'background var(--transition-fast), color var(--transition-fast)',
              }}
            >
              {tab.label}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <button
            type="button"
            onClick={handleOpenFile}
            style={{
              padding: 'var(--space-1) var(--space-3)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-default)',
              background: 'var(--surface-panel)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-weight-medium)',
              transition:
                'background var(--transition-fast), border-color var(--transition-fast)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--surface-hover)'
              e.currentTarget.style.borderColor = 'var(--border-hover)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--surface-panel)'
              e.currentTarget.style.borderColor = 'var(--border-default)'
            }}
          >
            Open file
          </button>
        </nav>

        <CloudPromptBanner />

        <main style={{ flex: 1, minHeight: 0, position: 'relative' }}>
          {/* Keep every app mounted but hidden so heavy editors do not unmount/remount on tab switches. */}
          {/* Changing key remounts the active app so the new document is loaded. */}
          <div
            style={{
              display: activeTab === 'docs' ? 'block' : 'none',
              width: '100%',
              height: '100%',
            }}
            key={activeTab === 'docs' ? `docs-${mountKey}` : 'docs'}
          >
            <DocsApp language="en" document={documentForTab ?? null} />
          </div>
          <div
            style={{
              display: activeTab === 'sheets' ? 'block' : 'none',
              width: '100%',
              height: '100%',
            }}
            key={activeTab === 'sheets' ? `sheets-${mountKey}` : 'sheets'}
          >
            <SheetsApp language="en" document={documentForTab ?? null} />
          </div>
          <div
            style={{
              display: activeTab === 'slides' ? 'block' : 'none',
              width: '100%',
              height: '100%',
            }}
            key={activeTab === 'slides' ? `slides-${mountKey}` : 'slides'}
          >
            <SlidesApp language="en" document={documentForTab ?? null} />
          </div>
          <div
            style={{
              display: activeTab === 'pdf' ? 'block' : 'none',
              width: '100%',
              height: '100%',
            }}
            key={activeTab === 'pdf' ? `pdf-${mountKey}` : 'pdf'}
          >
            <PdfApp language="en" document={documentForTab ?? null} />
          </div>
          <div
            style={{
              display: activeTab === 'sign' ? 'block' : 'none',
              width: '100%',
              height: '100%',
            }}
            key={activeTab === 'sign' ? `sign-${mountKey}` : 'sign'}
          >
            <SignApp
              file={
                documentForTab
                  ? new File([documentForTab.bytes as unknown as BlobPart], documentForTab.name, {
                      type: 'application/pdf',
                    })
                  : null
              }
            />
          </div>
        </main>
      </div>
    </OfficeHostProvider>
  )
}

function AppContent() {
  const [showOffice, setShowOffice] = useState(false)

  if (!showOffice) {
    return (
      <HomePage
        onLaunch={() => setShowOffice(true)}
        disclosure={
          <span>
            Allternit Office works locally in your browser with no account required.{' '}
            <strong>Sign in to Allternit to unlock the AI assistant and cloud sync.</strong>
          </span>
        }
      />
    )
  }

  return <OfficeWorkspace onBack={() => setShowOffice(false)} />
}

export function App() {
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
      <AppContent />
    </ClerkProvider>
  )
}
