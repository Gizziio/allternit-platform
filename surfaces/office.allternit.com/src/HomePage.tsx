import type { ReactNode } from 'react'
import {
  FileText,
  Table,
  PresentationChart,
  FilePdf,
  Signature,
  CloudArrowUp,
  ArrowRight,
} from '@phosphor-icons/react'

export interface HomePageProps {
  onLaunch: () => void
  disclosure?: ReactNode
}

const FEATURES = [
  {
    title: 'Docs',
    desc: 'AI-assisted word processing with smart editing, summarization, and rewriting.',
    icon: FileText,
  },
  {
    title: 'Sheets',
    desc: 'Spreadsheets that understand formulas, data, and natural-language queries.',
    icon: Table,
  },
  {
    title: 'Slides',
    desc: 'Create and refine presentations with an AI design partner at your side.',
    icon: PresentationChart,
  },
  {
    title: 'PDF',
    desc: 'Chat with your PDFs, extract answers, and annotate with ease.',
    icon: FilePdf,
  },
  {
    title: 'Sign',
    desc: 'Request signatures, track progress, and finalize documents securely.',
    icon: Signature,
  },
]

export function HomePage({ onLaunch, disclosure }: HomePageProps) {
  return (
    <div
      style={{
        width: '100%',
        minHeight: '100%',
        overflow: 'auto',
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)',
      }}
    >
      {/* Top navigation */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-4)',
          padding: 'var(--space-4) var(--space-6)',
          borderBottom: '1px solid var(--border-default)',
          background: 'color-mix(in srgb, var(--bg-primary) 88%, transparent)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <span
          style={{
            fontWeight: 'var(--font-weight-bold)',
            fontSize: 'var(--text-xl)',
            color: 'var(--accent-primary)',
            letterSpacing: '-0.01em',
          }}
        >
          Allternit Office
        </span>

        <nav
          style={{
            display: 'none',
            gap: 'var(--space-6)',
            fontSize: 'var(--text-sm)',
            color: 'var(--text-secondary)',
            alignItems: 'center',
          }}
        >
          {FEATURES.map((f) => (
            <span key={f.title}>{f.title}</span>
          ))}
        </nav>

        <button
          type="button"
          onClick={onLaunch}
          style={{
            padding: 'var(--space-2) var(--space-4)',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            background: 'var(--accent-primary)',
            color: 'var(--text-inverse)',
            fontWeight: 'var(--font-weight-semibold)',
            fontSize: 'var(--text-sm)',
            cursor: 'pointer',
            transition: 'filter var(--transition-fast), transform var(--transition-fast)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.filter = 'brightness(1.08)'
            e.currentTarget.style.transform = 'translateY(-1px)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.filter = 'none'
            e.currentTarget.style.transform = 'none'
          }}
        >
          Open Office
        </button>
      </header>

      {/* Hero */}
      <section
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          padding: 'var(--space-24) var(--space-6) var(--space-16)',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background:
              'radial-gradient(circle at 50% 0%, color-mix(in srgb, var(--accent-primary) 12%, transparent) 0%, transparent 55%)',
          }}
        />

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-1) var(--space-3)',
            borderRadius: 'var(--radius-full)',
            background: 'color-mix(in srgb, var(--accent-primary) 10%, transparent)',
            border: '1px solid var(--border-default)',
            color: 'var(--accent-primary)',
            fontSize: 'var(--text-xs)',
            fontWeight: 'var(--font-weight-semibold)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            marginBottom: 'var(--space-6)',
            position: 'relative',
          }}
        >
          <CloudArrowUp size={14} weight="bold" />
          Local-first, Cloud-powered
        </div>

        <h1
          style={{
            margin: 0,
            fontSize: 'clamp(2.75rem, 6vw, 4.5rem)',
            fontWeight: 'var(--font-weight-bold)',
            lineHeight: 'var(--line-height-tight)',
            letterSpacing: '-0.03em',
            maxWidth: 900,
            position: 'relative',
          }}
        >
          Your documents, powered by{' '}
          <span style={{ color: 'var(--accent-primary)' }}>Allternit AI</span>.
        </h1>

        <p
          style={{
            margin: 'var(--space-6) 0 0',
            maxWidth: 640,
            fontSize: 'var(--text-xl)',
            lineHeight: 'var(--line-height-relaxed)',
            color: 'var(--text-secondary)',
            position: 'relative',
          }}
        >
          Allternit Office brings Docs, Sheets, Slides, PDF, and Sign into one intelligent workspace —
          with an AI assistant that can read, edit, and reason across your files.
        </p>

        <div
          style={{
            marginTop: 'var(--space-8)',
            display: 'flex',
            gap: 'var(--space-4)',
            flexWrap: 'wrap',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          <button
            type="button"
            onClick={onLaunch}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-3) var(--space-6)',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: 'var(--accent-primary)',
              color: 'var(--text-inverse)',
              fontSize: 'var(--text-lg)',
              fontWeight: 'var(--font-weight-semibold)',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-md)',
              transition:
                'filter var(--transition-fast), transform var(--transition-fast), box-shadow var(--transition-fast)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.filter = 'brightness(1.08)'
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = 'var(--shadow-lg), var(--shadow-glow)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.filter = 'none'
              e.currentTarget.style.transform = 'none'
              e.currentTarget.style.boxShadow = 'var(--shadow-md)'
            }}
          >
            Launch Allternit Office
            <ArrowRight size={20} weight="bold" />
          </button>
        </div>
      </section>

      {/* Feature cards */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 'var(--space-5)',
          maxWidth: 1140,
          margin: '0 auto',
          padding: '0 var(--space-6) var(--space-20)',
        }}
      >
        {FEATURES.map((f, index) => {
          const Icon = f.icon
          return (
            <div
              key={f.title}
              style={{
                padding: 'var(--space-6)',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-default)',
                boxShadow: 'var(--shadow-sm)',
                transition:
                  'transform var(--transition-base), box-shadow var(--transition-base), border-color var(--transition-base)',
                animationDelay: `${index * 60}ms`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)'
                e.currentTarget.style.boxShadow = 'var(--shadow-md)'
                e.currentTarget.style.borderColor = 'var(--border-hover)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none'
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
                e.currentTarget.style.borderColor = 'var(--border-default)'
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background:
                    'color-mix(in srgb, var(--accent-primary) 10%, transparent)',
                  color: 'var(--accent-primary)',
                  marginBottom: 'var(--space-4)',
                }}
              >
                <Icon size={24} weight="duotone" />
              </div>
              <h3
                style={{
                  margin: '0 0 var(--space-2)',
                  fontSize: 'var(--text-lg)',
                  color: 'var(--text-primary)',
                  fontWeight: 'var(--font-weight-semibold)',
                }}
              >
                {f.title}
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: 'var(--text-base)',
                  lineHeight: 'var(--line-height-relaxed)',
                  color: 'var(--text-secondary)',
                }}
              >
                {f.desc}
              </p>
            </div>
          )
        })}
      </section>

      {/* Local / cloud disclosure */}
      {disclosure && (
        <section
          style={{
            maxWidth: 720,
            margin: '0 auto',
            padding: '0 var(--space-6) var(--space-24)',
          }}
        >
          <div
            style={{
              padding: 'var(--space-5) var(--space-6)',
              borderRadius: 'var(--radius-lg)',
              background: 'color-mix(in srgb, var(--accent-primary) 6%, transparent)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-secondary)',
              fontSize: 'var(--text-sm)',
              lineHeight: 'var(--line-height-relaxed)',
              textAlign: 'center',
            }}
          >
            {disclosure}
          </div>
        </section>
      )}
    </div>
  )
}
