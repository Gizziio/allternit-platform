import { useCallback, useEffect, useRef, useState } from 'react';
import { PdfApp } from '@allternit/office-pdf-app';
import { takeFile } from '@/views/office/file-handoff';
import {
  createArtifactSection,
  fetchArtifactById,
  updateArtifact,
  updateArtifactSection,
  type ArtifactDto,
} from '@/services/artifacts-api';

export interface PdfViewProps {
  artifactId?: string;
  handoffId?: string;
}

// Artifact mapping (mirrors the other office views): the real PDF bytes are
// the source of truth, stored base64 in a `pdf-viewer/binary` section; a
// `pdf-viewer/plaintext` section carries extracted text for iOS/search.
const BINARY_KIND = 'pdf-viewer/binary';
const PLAINTEXT_KIND = 'pdf-viewer/plaintext';

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

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

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistBytes = useCallback(
    async (bytes: Uint8Array, name: string) => {
      if (!artifact) return;
      const title = name.replace(/\.pdf$/i, '').replace(/_/g, ' ').trim();
      if (title && title !== artifact.title) {
        await updateArtifact(artifact.id, { title });
      }
      const encoded = toBase64(bytes);
      const sections = [...artifact.sections].sort((a, b) => a.position - b.position);
      const binary = sections.find((s) => s.kind === BINARY_KIND);
      if (binary) {
        if (binary.body !== encoded) {
          await updateArtifactSection(artifact.id, binary.id, { body: encoded });
        }
      } else {
        await createArtifactSection(artifact.id, {
          heading: 'Document (pdf)',
          kind: BINARY_KIND,
          body: encoded,
          position: 0,
        });
      }
      const plain = sections.find((s) => s.kind === PLAINTEXT_KIND);
      if (!plain) {
        await createArtifactSection(artifact.id, {
          heading: 'Text',
          kind: PLAINTEXT_KIND,
          body: '',
          position: 1,
        });
      }
      const refreshed = await fetchArtifactById(artifact.id);
      setArtifact(refreshed);
    },
    [artifact],
  );

  // Saves arrive on every successful save; debounce persistence.
  const handleSave = useCallback(
    (bytes: Uint8Array, name: string) => {
      if (!artifact) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        persistBytes(bytes, name).catch((err) => {
          console.error('[PdfView] artifact save failed', err);
        });
      }, 1500);
    },
    [artifact, persistBytes],
  );

  if (!loaded) {
    return <div style={{ width: '100%', height: '100%', background: 'var(--shell-view-bg, #141110)' }} />;
  }

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <PdfApp
        key={artifact?.id ?? (handoffFileRef.current ? 'handoff' : 'standalone')}
        document={initialBytes ? { bytes: initialBytes, name: initialName ?? 'document.pdf' } : undefined}
        onSave={artifact ? handleSave : undefined}
      />
    </div>
  );
}

export default PdfView;
