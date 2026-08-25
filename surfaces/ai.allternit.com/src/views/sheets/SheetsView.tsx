import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  SheetsApp,
  OfficeHostProvider,
  createBrowserHost,
  type OfficeHost,
} from '@allternit/office-suite';
import { xlsxToText } from '@allternit/office-file-parse/xlsx';
import { takeFile } from '@/views/office/file-handoff';
import {
  createArtifactSection,
  fetchArtifactById,
  updateArtifact,
  updateArtifactSection,
  type ArtifactDto,
} from '@/services/artifacts-api';

export interface SheetsViewProps {
  artifactId?: string;
  handoffId?: string;
}

// Artifact mapping (mirrors DocsView): the real workbook bytes are the
// source of truth, stored base64 in a `sheets-editor/binary` section; a
// `sheets-editor/plaintext` section carries extracted text for iOS/search.
// Legacy `sheets-editor/sheet` TSV sections are no longer written.
const BINARY_KIND = 'sheets-editor/binary';
const PLAINTEXT_KIND = 'sheets-editor/plaintext';

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

export function SheetsView({ artifactId, handoffId }: SheetsViewProps) {
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
        setInitialName(`${next.title.replace(/\s+/g, '_')}.xlsx`);
        setLoaded(true);
      })
      .catch(() => {
        // The editor works standalone with a blank workbook; ignore fetch failures.
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
      const title = name.replace(/\.xlsx$/i, '').replace(/_/g, ' ').trim();
      if (title && title !== artifact.title) {
        await updateArtifact(artifact.id, { title });
      }
      const encoded = toBase64(bytes);
      const text = await xlsxToText(bytes).catch(() => '');
      const sections = [...artifact.sections].sort((a, b) => a.position - b.position);
      const binary = sections.find((s) => s.kind === BINARY_KIND);
      if (binary) {
        if (binary.body !== encoded) {
          await updateArtifactSection(artifact.id, binary.id, { body: encoded });
        }
      } else {
        await createArtifactSection(artifact.id, {
          heading: 'Workbook (xlsx)',
          kind: BINARY_KIND,
          body: encoded,
          position: 0,
        });
      }
      const plain = sections.find((s) => s.kind === PLAINTEXT_KIND);
      if (plain) {
        if (plain.body !== text) {
          await updateArtifactSection(artifact.id, plain.id, { body: text });
        }
      } else {
        await createArtifactSection(artifact.id, {
          heading: 'Text',
          kind: PLAINTEXT_KIND,
          body: text,
          position: 1,
        });
      }
      const refreshed = await fetchArtifactById(artifact.id);
      setArtifact(refreshed);
    },
    [artifact],
  );

  // Saves arrive on every successful engine save; debounce persistence.
  const handleSave = useCallback(
    (bytes: Uint8Array, name: string) => {
      if (!artifact) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        persistBytes(bytes, name).catch((err) => {
          console.error('[SheetsView] artifact save failed', err);
        });
      }, 1500);
    },
    [artifact, persistBytes],
  );

  // Host contract passed to the suite adapter.
  const saveFileRef = useRef(handleSave);
  saveFileRef.current = handleSave;
  const host = useMemo<OfficeHost>(
    () =>
      createBrowserHost({
        saveFile: async (bytes: Uint8Array, name: string) => {
          saveFileRef.current(bytes, name);
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
        <SheetsApp
          key={artifact?.id ?? (handoffFileRef.current ? 'handoff' : 'standalone')}
          document={initialBytes ? { bytes: initialBytes, name: initialName ?? 'workbook.xlsx' } : undefined}
        />
      </OfficeHostProvider>
    </div>
  );
}

export default SheetsView;
