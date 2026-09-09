import { useLocation, useParams } from 'react-router-dom';
import DocsView from '@/views/docs/DocsView';
import { OfficePageChrome } from '@/shell/OfficePageChrome';

export default function DocsPage() {
  const { artifactId } = useParams<{ artifactId?: string }>();
  const { state } = useLocation();

  return (
    <main className="flex h-screen w-screen flex-col overflow-hidden">
      <OfficePageChrome />
      <div className="min-h-0 flex-1">
        <DocsView
          artifactId={artifactId}
          handoffId={(state as { handoffId?: string } | null)?.handoffId}
        />
      </div>
    </main>
  );
}
