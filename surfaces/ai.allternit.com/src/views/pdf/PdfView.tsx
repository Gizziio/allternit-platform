import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PdfApp,
  OfficeHostProvider,
  createBrowserHost,
  type OfficeHost,
} from '@allternit/allternit-office-suite';
import { takeFile } from '@/views/office/file-handoff';
import { fetchArtifactById, type ArtifactDto } from '@/services/artifacts-api';

export interface PdfViewProps {
  artifactId?: string;
  handoffId?: string;
}

// Artifact mapping: the real PDF bytes are the source of truth, stored base64
// in a `pdf-viewer/binary` section. The Allternit PDF surface is a viewer,
// so edits are not persisted back to the artifact.
const BINARY_KIND = 'pdf-viewer/binary';

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function PdfView({ artifactId, handoffId }: PdfViewProps) {
  const [artifact, setArtifact] = useState<ArtifactDto | null>(null);
  const [initialBytes, setInitialBytes] = useState<Uint8Array | undefined>(undefined);
  const [initialName, setInitialName] = useState<string | undefined>(undefined);
  const [loaded, setLoaded] = useState(!artifactId && !handoffId);

  // One-shot file handoff from the office launcher (consumed on first render).
  const handoffConsumedRef = useRef(false);
  const handoffFileRef = useRef<{ name: string; bytes: Uint8Array } | null>(null);
  if (handoffId && !handoffConsumedRef.current) {
    handoffConsumedRef.current = true;
    handoffFileRef.current = takeFile(handoffId) ?? null;
  }

  useEffect(() => {
    if (handoffFileRef.current) {
      setInitialBytes(handoffFileRef.current.bytes);
      setInitialName(handoffFileRef.current.name);
      setLoaded(true);
      return;
    }
    if (!artifactId) {
      setArtifact(null);
      setInitialBytes(undefined);
      setLoaded(true);
      return;
    }
    let cancelled = false;
    setLoaded(false);
    fetchArtifactById(artifactId)
      .then((next) => {
        if (cancelled) return;
        setArtifact(next);
        const binary = next.sections.find((s) => s.kind === BINARY_KIND);
        if (binary?.body) {
          setInitialBytes(fromBase64(binary.body));
        }
        setInitialName(`${next.title.replace(/\s+/g, '_')}.pdf`);
        setLoaded(true);
      })
      .catch(() => {
        // The viewer works standalone; ignore fetch failures.
        if (cancelled) return;
        setArtifact(null);
        setInitialBytes(undefined);
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [artifactId]);

  // Host contract passed to the suite adapter. PDF is read-only in the platform
  // surface, so saves are no-ops.
  const host = useMemo<OfficeHost>(
    () =>
      createBrowserHost({
        saveFile: async () => {
          /* read-only viewer: edits are not persisted back to the artifact */
        },
      }),
    [],
  );

  if (!loaded) {
    return <div style={{ width: '100%', height: '100%', background: 'var(--shell-view-bg, #141110)' }} />;
  }

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <OfficeHostProvider host={host}>
        <PdfApp
          key={artifact?.id ?? (handoffFileRef.current ? 'handoff' : 'standalone')}
          document={initialBytes ? { bytes: initialBytes, name: initialName ?? 'document.pdf' } : undefined}
          readOnly
        />
      </OfficeHostProvider>
    </div>
  );
}

export default PdfView;
