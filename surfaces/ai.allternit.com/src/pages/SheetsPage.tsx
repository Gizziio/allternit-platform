import { useLocation, useParams } from 'react-router-dom';
import SheetsView from '@/views/sheets/SheetsView';
import { OfficePageChrome } from '@/shell/OfficePageChrome';

export default function SheetsPage() {
  const { artifactId } = useParams<{ artifactId?: string }>();
  const { state } = useLocation();

  return (
    <main className="flex h-screen w-screen flex-col overflow-hidden">
      <OfficePageChrome />
      <div className="min-h-0 flex-1">
        <SheetsView
          artifactId={artifactId}
          handoffId={(state as { handoffId?: string } | null)?.handoffId}
        />
      </div>
    </main>
  );
}
