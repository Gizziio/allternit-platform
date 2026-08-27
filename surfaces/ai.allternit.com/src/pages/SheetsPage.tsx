import { useLocation, useParams } from 'react-router-dom';
import SheetsView from '@/views/sheets/SheetsView';

export default function SheetsPage() {
  const { artifactId } = useParams<{ artifactId?: string }>();
  const { state } = useLocation();

  return (
    <main style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <SheetsView
        artifactId={artifactId}
        handoffId={(state as { handoffId?: string } | null)?.handoffId}
      />
    </main>
  );
}
