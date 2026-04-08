import PairPageClient from './PairPageClient'

// Generate static params for Cloudflare Pages static export
// This is required for dynamic routes when using output: 'export'
export async function generateStaticParams(): Promise<{ code: string }[]> {
  // Return empty array - this page is client-side rendered with dynamic data
  // The actual pairing codes are determined at runtime by the client
  return []
}

export default function PairPage() {
  return <PairPageClient />
}
