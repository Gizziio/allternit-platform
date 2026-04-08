// Server component for static export
export function generateStaticParams() {
  // Return empty array - this page is client-side rendered
  // The actual pairing codes are dynamic and handled at runtime
  return []
}

import PairPageClient from './PairPageClient'

export default function PairPage() {
  return <PairPageClient />
}
