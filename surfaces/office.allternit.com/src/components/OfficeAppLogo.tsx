import type { ReactNode } from 'react'

export type OfficeProduct =
  | 'docs'
  | 'sheets'
  | 'slides'
  | 'pdf'
  | 'sign'
  | 'word'
  | 'excel'
  | 'powerpoint'

interface ProductSpec {
  /** Gradient stops, light → dark (top-left → bottom-right). */
  from: string
  to: string
  /** Darker shade for the monogram tab. */
  tab: string
  letter: string
  glyph: 'lines' | 'grid' | 'frame' | 'pdf' | 'signature'
}

const PRODUCTS: Record<OfficeProduct, ProductSpec> = {
  docs: { from: '#3B8AE0', to: '#185ABD', tab: '#12459A', letter: 'D', glyph: 'lines' },
  sheets: { from: '#2BB673', to: '#107C41', tab: '#0B5C30', letter: 'S', glyph: 'grid' },
  slides: { from: '#E06543', to: '#C43E1C', tab: '#9C2F12', letter: 'P', glyph: 'frame' },
  pdf: { from: '#E5564A', to: '#B91C1C', tab: '#8F1313', letter: 'F', glyph: 'pdf' },
  sign: { from: '#D97757', to: '#A65D44', tab: '#7A432F', letter: 'S', glyph: 'signature' },
  word: { from: '#3B8AE0', to: '#185ABD', tab: '#12459A', letter: 'W', glyph: 'lines' },
  excel: { from: '#2BB673', to: '#107C41', tab: '#0B5C30', letter: 'X', glyph: 'grid' },
  powerpoint: { from: '#E06543', to: '#C43E1C', tab: '#9C2F12', letter: 'P', glyph: 'frame' },
}

/** Four-point Allternit sparkle, centered at (cx, cy) with radius r. */
function sparklePath(cx: number, cy: number, r: number): string {
  const k = r * 0.18
  return [
    `M ${cx} ${cy - r}`,
    `Q ${cx + k} ${cy - k} ${cx + r} ${cy}`,
    `Q ${cx + k} ${cy + k} ${cx} ${cy + r}`,
    `Q ${cx - k} ${cy + k} ${cx - r} ${cy}`,
    `Q ${cx - k} ${cy - k} ${cx} ${cy - r}`,
    'Z',
  ].join(' ')
}

function Glyph({ kind, color }: { kind: ProductSpec['glyph']; color: string }): ReactNode {
  switch (kind) {
    case 'lines':
      return (
        <g stroke={color} strokeWidth="1.6" strokeLinecap="round">
          <line x1="23.5" y1="17" x2="33.5" y2="17" />
          <line x1="23.5" y1="22" x2="33.5" y2="22" />
          <line x1="23.5" y1="27" x2="30.5" y2="27" />
        </g>
      )
    case 'grid':
      return (
        <g stroke={color} strokeWidth="1.4">
          <rect x="23" y="15" width="12" height="14" fill="none" />
          <line x1="27" y1="15" x2="27" y2="29" />
          <line x1="31" y1="15" x2="31" y2="29" />
          <line x1="23" y1="19.7" x2="35" y2="19.7" />
          <line x1="23" y1="24.3" x2="35" y2="24.3" />
        </g>
      )
    case 'frame':
      return (
        <g>
          <rect
            x="23"
            y="15"
            width="12"
            height="10"
            rx="1.5"
            fill="none"
            stroke={color}
            strokeWidth="1.5"
          />
          <rect x="24.8" y="17" width="8.4" height="4" rx="1" fill={color} opacity="0.45" />
          <line x1="26" y1="29" x2="32" y2="29" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
        </g>
      )
    case 'pdf':
      return (
        <g>
          <path
            d="M23 14 h7 l5 5 v11 h-12 Z"
            fill="none"
            stroke={color}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M30 14 v5 h5" fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
          <text
            x="29"
            y="27.5"
            textAnchor="middle"
            fontSize="5"
            fontWeight="800"
            fill={color}
            fontFamily="inherit"
          >
            PDF
          </text>
        </g>
      )
    case 'signature':
      return (
        <g>
          <path
            d="M24 25 c2 -4 5 -7 8 -6 s4 5 2 8 s-6 3 -9 1"
            fill="none"
            stroke={color}
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <line x1="34" y1="28" x2="38" y2="28" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
        </g>
      )
  }
}

/**
 * Polished Allternit Office product tile — the same icon family used inside the
 * Allternit platform for Docs, Sheets, Slides, PDF, and Sign.
 */
export function OfficeAppLogo({
  product,
  size = 48,
  className,
}: {
  product: OfficeProduct
  size?: number
  className?: string
}): ReactNode {
  const spec = PRODUCTS[product]
  const gid = `oal-${product}`
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label={`${product} logo`}
      className={className}
      style={{ display: 'block', filter: 'drop-shadow(0 1px 2px rgb(0 0 0 / 0.18))' }}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={spec.from} />
          <stop offset="1" stopColor={spec.to} />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="11" fill={`url(#${gid})`} />
      {/* top sheen */}
      <rect width="48" height="24" rx="11" fill="#ffffff" opacity="0.08" />
      {/* document panel */}
      <rect x="18.5" y="10.5" width="19" height="27" rx="2.5" fill="#000000" opacity="0.14" />
      <rect x="17" y="9" width="19" height="27" rx="2.5" fill="#ffffff" opacity="0.96" />
      <Glyph kind={spec.glyph} color={spec.to} />
      {/* monogram tab */}
      <rect x="5" y="18" width="17" height="19" rx="4" fill={spec.tab} />
      <text
        x="13.5"
        y="32"
        textAnchor="middle"
        fontSize="12.5"
        fontWeight="800"
        fill="#ffffff"
        fontFamily="inherit"
      >
        {spec.letter}
      </text>
      {/* Allternit sparkle */}
      <path d={sparklePath(41, 8.5, 3.4)} fill="#ffffff" opacity="0.85" />
    </svg>
  )
}

export default OfficeAppLogo
