import { useLocation, useParams } from 'react-router-dom';
import PdfView from '@/views/pdf/PdfView';

export default function PdfPage() {
  const { artifactId } = useParams<{ artifactId?: string }>();
  const { state } = useLocation();

  return (
    <main style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <PdfView
        artifactId={artifactId}
        handoffId={(state as { handoffId?: string } | null)?.handoffId}
      />
    </main>
  );
}
