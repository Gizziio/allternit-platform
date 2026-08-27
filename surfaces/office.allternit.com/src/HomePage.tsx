import type { ReactNode } from 'react'
import { OfficeAppLogo, type OfficeProduct } from './components/OfficeAppLogo'
import { AProtocolWordmark, useScrollCollapse } from './components/AProtocolWordmark'
import { ALLTERNIT_PLATFORM_URL } from './platformUrl'
import type { AppTab } from './types'
import { Footer } from './Footer'
import './HomePage.css'

export interface HomePageProps {
  onLaunch: (tab?: AppTab) => void
  disclosure?: ReactNode
}

interface FeatureCard {
  id: OfficeProduct
  tab: AppTab
  name: string
  description: string
  formats: string[]
}

const FEATURES: FeatureCard[] = [
  {
    id: 'docs',
    tab: 'docs',
    name: 'Allternit Docs',
    description:
      'Word-compatible documents with byte-preserving save, powered by the GenOffice docx engine.',
    formats: ['.docx'],
  },
  {
    id: 'sheets',
    tab: 'sheets',
    name: 'Allternit Sheets',
    description:
      'Excel-compatible workbooks with server-side recalculation through the office engine.',
    formats: ['.xlsx'],
  },
  {
    id: 'slides',
    tab: 'slides',
    name: 'Allternit Slides',
    description:
      'PowerPoint-compatible decks with engine patch-save and a web-worker round-trip pipeline.',
    formats: ['.pptx'],
  },
  {
    id: 'pdf',
    tab: 'pdf',
    name: 'Allternit PDF',
    description:
      'PDF viewing with pdf.js rendering, page navigation, zoom, text extraction, and AI chat.',
    formats: ['.pdf'],
  },
  {
    id: 'sign',
    tab: 'sign',
    name: 'Allternit Sign',
    description:
      'Native PDF signing — add signers, place signature fields on the page, and download the signed document.',
    formats: ['.pdf'],
  },
]

function HeroVisual() {
  return (
    <div className="hero-visual">
      <video
        className="hero-visual__media"
        autoPlay
        muted
        loop
        playsInline
        poster="/hero-documents.png"
        preload="metadata"
      >
        <source src="/hero-cards.mp4" type="video/mp4" />
      </video>
      <img
        className="hero-visual__fallback"
        src="/hero-documents.png"
        alt="Allternit Office document apps"
      />
    </div>
  )
}

export function HomePage({ onLaunch, disclosure }: HomePageProps) {
  const brandCollapsed = useScrollCollapse()
  return (
    <div className="office-home">
      <header className="office-home__header">
        <div className="office-home__header-left">
          <a href={ALLTERNIT_PLATFORM_URL} className="office-home__brand">
            <AProtocolWordmark collapsed={brandCollapsed} height={18} theme="adaptive" suffix="OFFICE" />
          </a>
        </div>
        <button type="button" onClick={() => onLaunch()} className="btn btn-primary">
          Open Office
        </button>
      </header>

      <section className="office-home__hero">
        <video
          className="office-home__hero-video"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
        >
          <source src="/hero-glow.mp4" type="video/mp4" />
        </video>
        <div>
          <div className="office-home__hero-pill">Local-first, Cloud-powered</div>

          <h1 className="office-home__hero-title">One workspace for every document.</h1>

          <p className="office-home__hero-subtitle">
            Allternit Office brings Docs, Sheets, Slides, PDF, and Sign together — with an AI
            assistant that reads, edits, and reasons across your files.
          </p>

          <div className="office-home__hero-actions">
            <button type="button" onClick={() => onLaunch()} className="btn btn-primary">
              Launch Allternit Office
            </button>
            <button
              type="button"
              onClick={() => {
                document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })
              }}
              className="btn btn-secondary"
            >
              See what's included
            </button>
          </div>
        </div>

        <HeroVisual />
      </section>

      <section className="office-home__value-props">
        <video
          className="office-home__value-video"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
        >
          <source src="/grid-beam.mp4" type="video/mp4" />
        </video>
        <div className="office-home__value-grid">
          {[
            { label: '5 office apps', sub: 'Docs, Sheets, Slides, PDF, Sign' },
            { label: 'No install required', sub: 'Runs entirely in your browser' },
            { label: 'Privacy-first', sub: 'Your files stay on your device' },
            { label: 'AI-ready', sub: 'Sign in to unlock cloud AI tools' },
          ].map((item) => (
            <div key={item.label}>
              <div className="office-home__value-label">{item.label}</div>
              <div className="office-home__value-sub">{item.sub}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="office-home__features">
        <div className="office-home__features-header">
          <h2 className="office-home__features-title">Everything you need to work with documents</h2>
          <p className="office-home__features-lead">
            Open, edit, and save office files locally. Sign in to Allternit to add cloud AI and
            sync.
          </p>
        </div>

        <div className="office-home__feature-grid">
          {FEATURES.map((feature) => (
            <article
              key={feature.id}
              className="office-home__feature-card"
              onClick={() => onLaunch(feature.tab)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onLaunch(feature.tab)
                }
              }}
            >
              <OfficeAppLogo product={feature.id} size={48} />
              <h3 className="office-home__feature-title">{feature.name}</h3>
              <p className="office-home__feature-desc">{feature.description}</p>
              <p className="office-home__feature-formats">{feature.formats.join(' · ')}</p>
            </article>
          ))}
        </div>
      </section>

      {disclosure && (
        <section className="office-home__disclosure">
          <div className="office-home__disclosure-box">{disclosure}</div>
        </section>
      )}

      <Footer />
    </div>
  )
}
