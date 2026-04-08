// Server component for static export
export function generateStaticParams() {
  // Return empty array - this page is client-side rendered
  // Session IDs are dynamic and handled at runtime
  return []
}

import SessionPageClient from './SessionPageClient'

export default function SessionPage() {
  return <SessionPageClient />
}
