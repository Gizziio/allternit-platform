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
} from '@allternit/office-suite'

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
          {activeTab === 'docs' && <DocsApp key="docs" language="en" />}
          {activeTab === 'sheets' && <SheetsApp key="sheets" language="en" />}
          {activeTab === 'slides' && <SlidesApp key="slides" language="en" />}
          {activeTab === 'pdf' && <PdfApp key="pdf" language="en" />}
          {activeTab === 'sign' && <SignApp key="sign" />}
        </main>
      </div>
    </OfficeHostProvider>
  )
}
