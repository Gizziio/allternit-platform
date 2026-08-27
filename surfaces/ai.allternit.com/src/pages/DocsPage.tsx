import { useLocation, useParams } from 'react-router-dom';
import DocsView from '@/views/docs/DocsView';

export default function DocsPage() {
  const { artifactId } = useParams<{ artifactId?: string }>();
  const { state } = useLocation();

  return (
    <main style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <DocsView
        artifactId={artifactId}
        handoffId={(state as { handoffId?: string } | null)?.handoffId}
      />
    </main>
  );
}
