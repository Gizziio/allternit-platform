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

function HeroVisual() {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: 520,
        aspectRatio: '4 / 3',
        margin: '0 auto',
      }}
    >
      {/* ambient glow */}
      <div
        style={{
          position: 'absolute',
          inset: '10%',
          borderRadius: 'var(--radius-2xl)',
          background:
            'radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--accent-primary) 28%, transparent) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />

      {/* large backdrop card — slides */}
      <div
        style={{
          position: 'absolute',
          top: '8%',
          left: '12%',
          width: '68%',
          height: '58%',
          borderRadius: 'var(--radius-xl)',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)',
          boxShadow: 'var(--shadow-lg)',
          transform: 'rotate(-6deg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--space-4)',
        }}
      >
        <OfficeAppLogo product="slides" size={56} />
        <div>
          <div
            style={{
              width: 120,
              height: 10,
              borderRadius: 'var(--radius-full)',
              background: 'var(--sand-200)',
              marginBottom: 8,
            }}
          />
          <div
            style={{
              width: 80,
              height: 8,
              borderRadius: 'var(--radius-full)',
              background: 'var(--sand-200)',
            }}
          />
        </div>
      </div>

      {/* middle card — sheets */}
      <div
        style={{
          position: 'absolute',
          top: '28%',
          right: '8%',
          width: '56%',
          height: '50%',
          borderRadius: 'var(--radius-xl)',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)',
          boxShadow: 'var(--shadow-lg)',
          transform: 'rotate(4deg)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--space-3)',
        }}
      >
        <OfficeAppLogo product="sheets" size={52} />
        <div style={{ display: 'flex', gap: 6 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 'var(--radius-sm)',
              background: 'var(--sand-200)',
            }}
          />
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 'var(--radius-sm)',
              background: 'var(--sand-200)',
            }}
          />
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 'var(--radius-sm)',
              background: 'var(--sand-200)',
            }}
          />
        </div>
      </div>

      {/* front card — docs */}
      <div
        style={{
          position: 'absolute',
          bottom: '6%',
          left: '18%',
          width: '54%',
          height: '46%',
          borderRadius: 'var(--radius-xl)',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)',
          boxShadow: 'var(--shadow-xl)',
          transform: 'rotate(-2deg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--space-4)',
        }}
      >
        <OfficeAppLogo product="docs" size={52} />
        <div>
          <div
            style={{
              width: 110,
              height: 8,
              borderRadius: 'var(--radius-full)',
              background: 'var(--sand-200)',
              marginBottom: 6,
            }}
          />
          <div
            style={{
              width: 110,
              height: 8,
              borderRadius: 'var(--radius-full)',
              background: 'var(--sand-200)',
              marginBottom: 6,
            }}
          />
          <div
            style={{
              width: 70,
              height: 8,
              borderRadius: 'var(--radius-full)',
              background: 'var(--sand-200)',
            }}
          />
        </div>
      </div>

      {/* small floating sign/pdf pills */}
      <div
        style={{
          position: 'absolute',
          bottom: '22%',
          right: '6%',
          padding: 'var(--space-2) var(--space-3)',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)',
          boxShadow: 'var(--shadow-md)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          transform: 'rotate(8deg)',
        }}
      >
        <OfficeAppLogo product="pdf" size={28} />
        <span
          style={{
            fontSize: 'var(--text-xs)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--text-secondary)',
          }}
        >
          AI chat
        </span>
      </div>

      <div
        style={{
          position: 'absolute',
          top: '10%',
          right: '14%',
          padding: 'var(--space-2) var(--space-3)',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)',
          boxShadow: 'var(--shadow-md)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          transform: 'rotate(-4deg)',
        }}
      >
        <OfficeAppLogo product="sign" size={28} />
        <span
          style={{
            fontSize: 'var(--text-xs)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--text-secondary)',
          }}
        >
          Signed
        </span>
      </div>
    </div>
  )
}

export function HomePage({ onLaunch, disclosure }: HomePageProps) {
  return (
    <div
      style={{
        width: '100%',
        minHeight: '100dvh',
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
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 0.95fr)',
          alignItems: 'center',
          gap: 'var(--space-10)',
          maxWidth: 1200,
          margin: '0 auto',
          padding: 'var(--space-20) var(--space-6) var(--space-16)',
        }}
      >
        <div style={{ position: 'relative' }}>
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
            }}
          >
            Local-first, Cloud-powered
          </div>

          <h1
            style={{
              margin: 0,
              fontFamily: 'var(--font-sans)',
              fontSize: 'clamp(2.5rem, 5vw, 4rem)',
              fontWeight: 'var(--font-weight-semibold)',
              lineHeight: 'var(--line-height-tight)',
              letterSpacing: '-0.03em',
              color: 'var(--text-primary)',
            }}
          >
            One workspace for every document.
          </h1>

          <p
            style={{
              margin: 'var(--space-5) 0 0',
              maxWidth: 520,
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--text-xl)',
              lineHeight: 'var(--line-height-relaxed)',
              color: 'var(--text-secondary)',
            }}
          >
            Allternit Office brings Docs, Sheets, Slides, PDF, and Sign together — with an AI
            assistant that reads, edits, and reasons across your files.
          </p>

          <div
            style={{
              marginTop: 'var(--space-8)',
              display: 'flex',
              gap: 'var(--space-4)',
              flexWrap: 'wrap',
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

            <button
              type="button"
              onClick={() => {
                document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: 'var(--space-3) var(--space-6)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-default)',
                background: 'transparent',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-md)',
                fontWeight: 'var(--font-weight-semibold)',
                cursor: 'pointer',
                transition:
                  'background var(--transition-fast), border-color var(--transition-fast)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-secondary)'
                e.currentTarget.style.borderColor = 'var(--border-hover)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.borderColor = 'var(--border-default)'
              }}
            >
              See what's included
            </button>
          </div>
        </div>

        <HeroVisual />
      </section>

      {/* Value props */}
      <section
        style={{
          borderTop: '1px solid var(--border-default)',
          borderBottom: '1px solid var(--border-default)',
          background: 'var(--bg-secondary)',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 'var(--space-6)',
            maxWidth: 1200,
            margin: '0 auto',
            padding: 'var(--space-10) var(--space-6)',
          }}
        >
          {[
            { label: '5 office apps', sub: 'Docs, Sheets, Slides, PDF, Sign' },
            { label: 'No install required', sub: 'Runs entirely in your browser' },
            { label: 'Privacy-first', sub: 'Your files stay on your device' },
            { label: 'AI-ready', sub: 'Sign in to unlock cloud AI tools' },
          ].map((item) => (
            <div key={item.label}>
              <div
                style={{
                  fontSize: 'var(--text-lg)',
                  fontWeight: 'var(--font-weight-semibold)',
                  color: 'var(--text-primary)',
                }}
              >
                {item.label}
              </div>
              <div
                style={{
                  marginTop: 'var(--space-1)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-secondary)',
                }}
              >
                {item.sub}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Feature cards */}
      <section
        id="features"
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: 'var(--space-20) var(--space-6)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-10)' }}>
          <h2
            style={{
              margin: 0,
              fontSize: 'clamp(1.75rem, 3vw, 2.5rem)',
              fontWeight: 'var(--font-weight-semibold)',
              letterSpacing: '-0.02em',
              color: 'var(--text-primary)',
            }}
          >
            Everything you need to work with documents
          </h2>
          <p
            style={{
              margin: 'var(--space-3) auto 0',
              maxWidth: 560,
              fontSize: 'var(--text-lg)',
              color: 'var(--text-secondary)',
              lineHeight: 'var(--line-height-relaxed)',
            }}
          >
            Open, edit, and save office files locally. Sign in to Allternit to add cloud AI and
            sync.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 'var(--space-5)',
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
        </div>
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

      {/* Footer */}
      <footer
        style={{
          padding: 'var(--space-6)',
          borderTop: '1px solid var(--border-default)',
          textAlign: 'center',
          color: 'var(--text-tertiary)',
          fontSize: 'var(--text-sm)',
        }}
      >
        © {new Date().getFullYear()} Allternit Office
      </footer>
    </div>
  )
}
