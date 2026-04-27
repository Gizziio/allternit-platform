import { CoworkWorkspaceDetailView } from '@/views/cowork-team/CoworkWorkspaceDetailView';

// Static export: workspaces are loaded client-side via API, no build-time params needed.
export function generateStaticParams() {
  return [];
}

export const dynamicParams = true;

export const metadata = { title: 'Workspace - Allternit' };

export default async function CoworkWorkspaceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CoworkWorkspaceDetailView workspaceId={id} />;
}
