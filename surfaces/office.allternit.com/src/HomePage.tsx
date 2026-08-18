import type { ReactNode } from 'react'

export interface HomePageProps {
  onLaunch: () => void
  disclosure?: ReactNode
}

export function HomePage({ onLaunch, disclosure }: HomePageProps) {
  return (
    <div
      style={{
        width: '100%',
        minHeight: '100%',
        overflow: 'auto',
        background: 'var(--bg)',
        color: 'var(--text)',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 32px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 20, color: 'var(--accent)' }}>Allternit Office</span>
        <nav style={{ display: 'flex', gap: 24, fontSize: 14, color: 'var(--muted)' }}>
          <span>Docs</span>
          <span>Sheets</span>
          <span>Slides</span>
          <span>PDF</span>
          <span>Sign</span>
        </nav>
        <button
          type="button"
          onClick={onLaunch}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            border: 'none',
            background: 'var(--accent)',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Open Office
        </button>
      </header>

      <section
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          padding: '96px 24px 64px',
        }}
      >
        <h1 style={{ margin: 0, fontSize: 'clamp(40px, 6vw, 72px)', fontWeight: 800, lineHeight: 1.05 }}>
          Your documents, powered by AI.
        </h1>
        <p
          style={{
            margin: '24px 0 0',
            maxWidth: 640,
            fontSize: 18,
            lineHeight: 1.6,
            color: 'var(--muted)',
          }}
        >
          Allternit Office brings Docs, Sheets, Slides, PDF, and Sign into one intelligent workspace —
          with an AI assistant that can read, edit, and reason across your files.
        </p>
        <div style={{ marginTop: 40, display: 'flex', gap: 16 }}>
          <button
            type="button"
            onClick={onLaunch}
            style={{
              padding: '14px 28px',
              borderRadius: 10,
              border: 'none',
              background: 'var(--accent)',
              color: '#fff',
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Launch Allternit Office
          </button>
        </div>
      </section>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 20,
          maxWidth: 1100,
          margin: '0 auto',
          padding: '32px 24px 96px',
        }}
      >
        {[
          { title: 'Docs', desc: 'AI-assisted word processing with smart editing and summarization.' },
          { title: 'Sheets', desc: 'Spreadsheets that understand formulas, data, and natural-language queries.' },
          { title: 'Slides', desc: 'Create and refine presentations with an AI design partner.' },
          { title: 'PDF', desc: 'Chat with your PDFs, extract answers, and annotate with ease.' },
          { title: 'Sign', desc: 'Request signatures, track progress, and finalize documents securely.' },
        ].map((f) => (
          <div
            key={f.title}
            style={{
              padding: 24,
              borderRadius: 12,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
            }}
          >
            <h3 style={{ margin: '0 0 8px', fontSize: 16, color: 'var(--accent)' }}>{f.title}</h3>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: 'var(--muted)' }}>{f.desc}</p>
          </div>
        ))}
      </section>
    </div>
  )
}
