import { useLocation } from 'react-router-dom';
import MarkdownPreviewView from '@/views/office/MarkdownPreviewView';

export default function MarkdownPreviewPage() {
  const { state } = useLocation();

  return (
    <main style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <MarkdownPreviewView
        handoffId={(state as { handoffId?: string } | null)?.handoffId}
        sourceUrl={(state as { sourceUrl?: string } | null)?.sourceUrl}
      />
    </main>
  );
}
