import type { ReactNode } from 'react'
import { OfficeAppLogo, type OfficeProduct } from './components/OfficeAppLogo'

export interface HomePageProps {
  onLaunch: () => void
  disclosure?: ReactNode
}

interface FeatureCard {
  id: OfficeProduct
  name: string
  description: string
  formats: string[]
}

const FEATURES: FeatureCard[] = [
  {
    id: 'docs',
    name: 'Allternit Docs',
    description:
      'Word-compatible documents with byte-preserving save, powered by the GenOffice docx engine.',
    formats: ['.docx'],
  },
  {
    id: 'sheets',
    name: 'Allternit Sheets',
    description:
      'Excel-compatible workbooks with server-side recalculation through the office engine.',
    formats: ['.xlsx'],
  },
  {
    id: 'slides',
    name: 'Allternit Slides',
    description:
      'PowerPoint-compatible decks with engine patch-save and a web-worker round-trip pipeline.',
    formats: ['.pptx'],
  },
  {
    id: 'pdf',
    name: 'Allternit PDF',
    description:
      'PDF viewing with pdf.js rendering, page navigation, zoom, text extraction, and AI chat.',
    formats: ['.pdf'],
  },
  {
    id: 'sign',
    name: 'Allternit Sign',
    description:
      'Native PDF signing — add signers, place signature fields on the page, and download the signed document.',
    formats: ['.pdf'],
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
        fontFamily: 'var(--font-sans)',
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
          background: 'var(--glass-bg-thick)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <span
          style={{
            fontWeight: 'var(--font-weight-semibold)',
            fontSize: 'var(--text-lg)',
            color: 'var(--text-primary)',
            letterSpacing: '-0.01em',
          }}
        >
          Allternit Office
        </span>

        <button
          type="button"
          onClick={onLaunch}
          style={{
            padding: 'var(--space-2) var(--space-4)',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            background: 'var(--text-primary)',
            color: 'var(--bg-primary)',
            fontWeight: 'var(--font-weight-medium)',
            fontSize: 'var(--text-sm)',
            cursor: 'pointer',
            transition: 'opacity var(--transition-fast)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '0.9'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1'
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
          padding: 'var(--space-20) var(--space-6) var(--space-12)',
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
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-default)',
            color: 'var(--text-secondary)',
            fontSize: 'var(--text-xs)',
            fontWeight: 'var(--font-weight-semibold)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            marginBottom: 'var(--space-6)',
            position: 'relative',
          }}
        >
          Local-first, Cloud-powered
        </div>

        <h1
          style={{
            margin: 0,
            fontFamily: 'var(--font-sans)',
            fontSize: 'clamp(2.5rem, 6vw, 4rem)',
            fontWeight: 'var(--font-weight-semibold)',
            lineHeight: 'var(--line-height-tight)',
            letterSpacing: '-0.03em',
            maxWidth: 820,
            position: 'relative',
          }}
        >
          Your documents, powered by{' '}
          <span style={{ color: 'var(--accent-primary)' }}>Allternit AI</span>.
        </h1>

        <p
          style={{
            margin: 'var(--space-5) 0 0',
            maxWidth: 600,
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-xl)',
            lineHeight: 'var(--line-height-relaxed)',
            color: 'var(--text-secondary)',
            position: 'relative',
          }}
        >
          Docs, Sheets, Slides, PDF, and Sign in one intelligent workspace — with an AI assistant
          that can read, edit, and reason across your files.
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
              background: 'var(--text-primary)',
              color: 'var(--bg-primary)',
              fontSize: 'var(--text-md)',
              fontWeight: 'var(--font-weight-semibold)',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-md)',
              transition: 'opacity var(--transition-fast), transform var(--transition-fast)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.9'
              e.currentTarget.style.transform = 'translateY(-1px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1'
              e.currentTarget.style.transform = 'none'
            }}
          >
            Launch Allternit Office
          </button>
        </div>
      </section>

      {/* Feature cards */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 'var(--space-5)',
          maxWidth: 1140,
          margin: '0 auto',
          padding: '0 var(--space-6) var(--space-16)',
        }}
      >
        {FEATURES.map((feature) => (
          <article
            key={feature.id}
            style={{
              display: 'flex',
              minHeight: 224,
              flexDirection: 'column',
              padding: 'var(--space-5)',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              boxShadow: 'var(--shadow-sm)',
              transition:
                'transform var(--transition-base), box-shadow var(--transition-base), border-color var(--transition-base)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-3px)'
              e.currentTarget.style.boxShadow = 'var(--shadow-md)'
              e.currentTarget.style.borderColor = 'var(--border-hover)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'none'
              e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
              e.currentTarget.style.borderColor = 'var(--border-default)'
            }}
          >
            <OfficeAppLogo product={feature.id} size={48} />
            <h3
              style={{
                margin: 'var(--space-4) 0 var(--space-2)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-md)',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--text-primary)',
              }}
            >
              {feature.name}
            </h3>
            <p
              style={{
                margin: 0,
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-sm)',
                lineHeight: 'var(--line-height-relaxed)',
                color: 'var(--text-secondary)',
              }}
            >
              {feature.description}
            </p>
            <p
              style={{
                marginTop: 'auto',
                paddingTop: 'var(--space-3)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--text-tertiary)',
                letterSpacing: '0.02em',
              }}
            >
              {feature.formats.join(' · ')}
            </p>
          </article>
        ))}
      </section>

      {/* Local / cloud disclosure */}
      {disclosure && (
        <section
          style={{
            maxWidth: 720,
            margin: '0 auto',
            padding: '0 var(--space-6) var(--space-20)',
          }}
        >
          <div
            style={{
              padding: 'var(--space-5) var(--space-6)',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--bg-secondary)',
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
