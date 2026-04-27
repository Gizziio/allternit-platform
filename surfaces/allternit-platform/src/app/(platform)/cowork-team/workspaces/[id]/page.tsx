import { CoworkWorkspaceDetailView } from '@/views/cowork-team/CoworkWorkspaceDetailView';

// Static export: generate a single shell page; workspace data loads client-side.
// dynamicParams must not be set to true with output:export.
export function generateStaticParams() {
  return [{ id: '_' }];
}

export const metadata = { title: 'Workspace - Allternit' };

export default async function CoworkWorkspaceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CoworkWorkspaceDetailView workspaceId={id} />;
}
