import { PlatformSignUp } from "@/lib/platform-auth-client"

const features = [
  'Gizzi-powered agentic workspace',
  'Multi-surface: Desktop, Web, CLI',
  'Git-auditable agent lineage',
  'Full @allternit/sdk access',
  'Constitutional AI guarantees',
]

const BrandPanel = () => (
  <div
    className="hidden lg:flex flex-col justify-between w-[420px] shrink-0 p-12"
    style={{ background: '#1A1612' }}
  >
    <div>
      <a href="https://allternit.com" className="flex items-center gap-2 mb-16 no-underline">
        <span className="text-xl font-mono tracking-tight" style={{ color: '#D97757' }}>A://</span>
        <span className="text-xl tracking-tight" style={{ color: '#ECECEC', fontFamily: 'Georgia, serif' }}>
          LLTERNIT
        </span>
      </a>
      <div>
        <p
          className="text-xs font-medium mb-4"
          style={{ color: '#D97757', letterSpacing: '0.1em', textTransform: 'uppercase' }}
        >
          What you get
        </p>
        <ul className="space-y-3 text-sm" style={{ color: '#C4A78A' }}>
          {features.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span style={{ color: '#D97757', flexShrink: 0 }}>→</span>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
    <div style={{ fontSize: 12 }}>
      <p className="mb-3" style={{ color: '#664E3A' }}>Allternit PBC — Public Benefit Corporation</p>
      <div className="flex gap-4">
        {([['Constitution', 'https://allternit.com/constitution'], ['Research', 'https://allternit.com/research'], ['Docs', 'https://docs.allternit.com']] as const).map(([label, href]) => (
          <a key={label} href={href} className="no-underline" style={{ color: '#664E3A' }}>
            {label}
          </a>
        ))}
      </div>
    </div>
  </div>
)

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex" style={{ background: '#FDF8F3' }}>
      <BrandPanel />
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        {/* Mobile logo */}
        <a href="https://allternit.com" className="flex items-center gap-2 mb-10 lg:hidden no-underline">
          <span className="text-xl font-mono" style={{ color: '#D97757' }}>A://</span>
          <span className="text-xl" style={{ color: '#1A1612', fontFamily: 'Georgia, serif' }}>LLTERNIT</span>
        </a>
        <div className="w-full max-w-sm">
          <PlatformSignUp />
        </div>
        <p className="mt-8 text-xs text-center" style={{ color: '#9B9B9B' }}>
          By continuing you agree to the{' '}
          <a href="https://allternit.com/terms" style={{ color: '#9B9B9B' }} className="underline">Terms</a>
          {' '}and{' '}
          <a href="https://allternit.com/privacy" style={{ color: '#9B9B9B' }} className="underline">Privacy Policy</a>.
        </p>
      </div>
    </div>
  )
}
