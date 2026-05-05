import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Terms of Service — Allternit",
  description: "Terms of Service for the Allternit platform.",
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mb-10">
    <h2 style={{ fontFamily: 'Georgia, serif', fontWeight: 400, fontSize: 22, color: 'var(--ui-text-inverse)', marginBottom: 12 }}>
      {title}
    </h2>
    <div style={{ color: '#5A5A5A', lineHeight: 1.75, fontSize: 15 }}>{children}</div>
  </section>
)

export default function TermsPage() {
  return (
    <div style={{ background: '#FDF8F3', minHeight: '100vh' }}>
      {/* Nav */}
      <nav style={{ borderBottom: '1px solid #E8D9C8', padding: '0 32px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, color: '#D97757' }}>A://</span>
          <span style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: 'var(--ui-text-inverse)' }}>LLTERNIT</span>
        </a>
        <a href="https://allternit.com" style={{ fontSize: 13, color: 'var(--ui-text-secondary)', textDecoration: 'none' }}>← allternit.com</a>
      </nav>

      <main style={{ maxWidth: 720, margin: '0 auto', padding: '64px 32px' }}>
        <header style={{ marginBottom: 48 }}>
          <p style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#D97757', marginBottom: 12 }}>
            Legal
          </p>
          <h1 style={{ fontFamily: 'Georgia, serif', fontWeight: 400, fontSize: 40, color: 'var(--ui-text-inverse)', lineHeight: 1.1, marginBottom: 16 }}>
            Terms of Service
          </h1>
          <p style={{ color: 'var(--ui-text-secondary)', fontSize: 14 }}>Last updated: March 2026</p>
        </header>

        <Section title="1. Acceptance of Terms">
          <p>By accessing or using the Allternit platform ("Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the Service.</p>
        </Section>

        <Section title="2. Description of Service">
          <p>Allternit provides an agentic AI operating system and developer platform, including the Gizzi runtime, SDK, and associated services. Allternit is a Public Benefit Corporation (PBC) committed to building AI infrastructure that serves the long-term well-being of humanity.</p>
        </Section>

        <Section title="3. Acceptable Use">
          <p>You agree to use the Service in accordance with our <a href="https://allternit.com/constitution" style={{ color: '#C45C26' }}>Constitutional Principles</a> — helpful, harmless, and honest. You may not use the Service for illegal activities, to cause harm to others, or in ways that violate the autonomy or privacy of other users.</p>
        </Section>

        <Section title="4. Intellectual Property">
          <p>The platform core, Gizzi runtime, and SDK are open infrastructure. Your agent data, custom skills, and workflows remain your property. Allternit retains rights to the platform architecture and branding.</p>
        </Section>

        <Section title="5. Privacy">
          <p>Your use of the Service is also governed by our <a href="/privacy" style={{ color: '#C45C26' }}>Privacy Policy</a>. We collect only the data necessary to operate the Service and do not sell user data.</p>
        </Section>

        <Section title="6. Limitation of Liability">
          <p>The Service is provided "as is." Allternit shall not be liable for indirect, incidental, or consequential damages arising from use of the Service.</p>
        </Section>

        <Section title="7. Changes to Terms">
          <p>We may update these Terms from time to time. Continued use of the Service after changes constitutes acceptance. Material changes will be announced via the platform.</p>
        </Section>

        <Section title="8. Contact">
          <p>For questions about these Terms, contact us at <a href="mailto:legal@allternit.com" style={{ color: '#C45C26' }}>legal@allternit.com</a>.</p>
        </Section>
      </main>

      <footer style={{ borderTop: '1px solid #E8D9C8', padding: '24px 32px', textAlign: 'center' }}>
        <p style={{ fontSize: 12, color: 'var(--ui-text-secondary)' }}>© 2026 Allternit PBC</p>
      </footer>
    </div>
  )
}
