import { useLocation, useParams } from 'react-router-dom';
import SlidesView from '@/views/slides/SlidesView';

export default function SlidesPage() {
  const { artifactId } = useParams<{ artifactId?: string }>();
  const { state } = useLocation();

  return (
    <main style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <SlidesView
        artifactId={artifactId}
        handoffId={(state as { handoffId?: string } | null)?.handoffId}
      />
    </main>
  );
}
