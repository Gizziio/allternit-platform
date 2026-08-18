import { useMemo, useState } from 'react'
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

type AppTab = 'docs' | 'sheets' | 'slides' | 'pdf' | 'sign'

const TABS: { id: AppTab; label: string }[] = [
  { id: 'docs', label: 'Docs' },
  { id: 'sheets', label: 'Sheets' },
  { id: 'slides', label: 'Slides' },
  { id: 'pdf', label: 'PDF' },
  { id: 'sign', label: 'Sign' },
]

export function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('docs')

  const host = useMemo<OfficeHost>(
    () =>
      createBrowserHost({
        getLanguage: () => 'en',
      }),
    []
  )

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
          <span
            style={{
              fontWeight: 600,
              marginRight: 12,
              color: 'var(--accent)',
            }}
          >
            Allternit Office
          </span>
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

        <main style={{ flex: 1, minHeight: 0, position: 'relative' }}>
          {/* Keep every app mounted but hidden so heavy editors (Univer, Konva)
              do not unmount/remount on tab switches, which avoids React root
              teardown races in the vendored apps. */}
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
