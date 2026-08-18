import { useEffect, useMemo, useState } from 'react'
import {
  OfficeHostProvider,
  createBrowserHost,
  DocsApp,
  SheetsApp,
  SlidesApp,
  PdfApp,
  SignApp,
  type OfficeHost,
} from '@allternit/allternit-office-suite'
import { createStandaloneAiClient } from './ai/createStandaloneAiClient'
import { loadNeedle, type NeedleProgress } from './ai/needleLoader'
import { HomePage } from './HomePage'
import { ModelDownloadWizard } from './ModelDownloadWizard'

type AppTab = 'docs' | 'sheets' | 'slides' | 'pdf' | 'sign'

const TABS: { id: AppTab; label: string }[] = [
  { id: 'docs', label: 'Docs' },
  { id: 'sheets', label: 'Sheets' },
  { id: 'slides', label: 'Slides' },
  { id: 'pdf', label: 'PDF' },
  { id: 'sign', label: 'Sign' },
]

function CloudPromptBanner() {
  return (
    <div
      style={{
        flexShrink: 0,
        padding: '8px 12px',
        background: 'rgba(217, 119, 87, 0.12)',
        borderBottom: '1px solid var(--border)',
        fontSize: 12,
        color: 'var(--text)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <span>
        Running locally with a small on-device model.{' '}
        <span style={{ color: 'var(--muted)' }}>
          For complex, multi-step reasoning, sign in to Allternit Cloud.
        </span>
      </span>
      <button
        type="button"
        onClick={() => {
          // TODO: wire to platform auth / cloud mode
          alert('Cloud sign-in integration coming next.')
        }}
        style={{
          flexShrink: 0,
          padding: '4px 10px',
          borderRadius: 6,
          border: 'none',
          background: 'var(--accent)',
          color: '#fff',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Sign in to Allternit
      </button>
    </div>
  )
}

function OfficeWorkspace({ onBack }: { onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<AppTab>('docs')

  const host = useMemo<OfficeHost>(() => {
    const ai = createStandaloneAiClient()
    return createBrowserHost({
      getLanguage: () => 'en',
      ai,
    })
  }, [])

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
            gap: 4,
            padding: '0 12px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface)',
          }}
        >
          <button
            type="button"
            onClick={onBack}
            style={{
              fontWeight: 600,
              marginRight: 12,
              color: 'var(--accent)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: 14,
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
                padding: '6px 12px',
                borderRadius: 6,
                border: 'none',
                background: activeTab === tab.id ? 'var(--accent)' : 'transparent',
                color: activeTab === tab.id ? '#fff' : 'var(--text)',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <CloudPromptBanner />

        <main style={{ flex: 1, minHeight: 0, position: 'relative' }}>
          {/* Keep every app mounted but hidden so heavy editors do not unmount/remount on tab switches. */}
          <div style={{ display: activeTab === 'docs' ? 'block' : 'none', width: '100%', height: '100%' }}>
            <DocsApp language="en" />
          </div>
          <div style={{ display: activeTab === 'sheets' ? 'block' : 'none', width: '100%', height: '100%' }}>
            <SheetsApp language="en" />
          </div>
          <div style={{ display: activeTab === 'slides' ? 'block' : 'none', width: '100%', height: '100%' }}>
            <SlidesApp language="en" />
          </div>
          <div style={{ display: activeTab === 'pdf' ? 'block' : 'none', width: '100%', height: '100%' }}>
            <PdfApp language="en" />
          </div>
          <div style={{ display: activeTab === 'sign' ? 'block' : 'none', width: '100%', height: '100%' }}>
            <SignApp />
          </div>
        </main>
      </div>
    </OfficeHostProvider>
  )
}

export function App() {
  const [view, setView] = useState<'home' | 'loading' | 'office'>('home')
  const [progress, setProgress] = useState<NeedleProgress>({
    phase: 'init',
    loaded: 0,
    total: 0,
    message: 'Preparing local model…',
  })

  useEffect(() => {
    if (view !== 'loading') return
    let active = true
    loadNeedle((p) => {
      if (active) setProgress(p)
    })
      .then(() => {
        if (active) setView('office')
      })
      .catch((err) => {
        if (active) {
          setProgress({
            phase: 'init',
            loaded: 0,
            total: 0,
            message: err instanceof Error ? err.message : String(err),
          })
        }
      })
    return () => {
      active = false
    }
  }, [view])

  if (view === 'home') {
    return (
      <HomePage
        onLaunch={() => setView('loading')}
        disclosure={
          <span>
            Local mode uses a tiny on-device model for fast, private actions.{' '}
            <strong>Complex, multi-step reasoning requires signing in to Allternit Cloud.</strong>
          </span>
        }
      />
    )
  }

  if (view === 'loading') {
    return (
      <>
        <HomePage onLaunch={() => {}} />
        <ModelDownloadWizard
          progress={progress}
          onCancel={() => setView('home')}
        />
      </>
    )
  }

  return <OfficeWorkspace onBack={() => setView('home')} />
}
