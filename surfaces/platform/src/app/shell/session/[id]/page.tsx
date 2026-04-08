import SessionPageClient from './SessionPageClient'

// Generate static params for Cloudflare Pages static export
// This is required for dynamic routes when using output: 'export'
export async function generateStaticParams(): Promise<{ id: string }[]> {
  // Return empty array - this page is client-side rendered with dynamic data
  // Session IDs are determined at runtime by the client
  return []
}

export default function SessionPage() {
  return <SessionPageClient />
}
