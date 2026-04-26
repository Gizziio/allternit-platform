import { CoworkWorkspaceDetailView } from '@/views/cowork-team/CoworkWorkspaceDetailView';

export const metadata = { title: 'Workspace - Allternit' };

export default async function CoworkWorkspaceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CoworkWorkspaceDetailView workspaceId={id} />;
}
