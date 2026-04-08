import SessionPageClient from './SessionPageClient'

// Server component for static export
export function generateStaticParams() {
  // Return empty array - this page is client-side rendered
  // Session IDs are dynamic and handled at runtime
  return []
}

export default function SessionPage() {
  return <SessionPageClient />
}
