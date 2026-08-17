import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DocsApp,
  OfficeHostProvider,
  createBrowserHost,
  type OfficeHost,
} from '@allternit/allternit-office-suite';
import { buildBlankDocx, parseDocx, saveDocx } from '@allternit/office-docx-engine';
import { takeFile } from '@/views/office/file-handoff';
import {
  createArtifactSection,
  fetchArtifactById,
  updateArtifact,
  updateArtifactSection,
  type ArtifactDto,
} from '@/services/artifacts-api';

export interface DocsViewProps {
  artifactId?: string;
  handoffId?: string;
}

// Artifact mapping: the real docx bytes are the source of truth, stored
// base64 in a `docs-editor/binary` section. A `docs-editor/plaintext` section
// carries extracted text for iOS/search/cowork. Legacy `docs-editor/<block>`
// text sections (thin-editor era) are upgraded on load by generating a docx
// from their blocks.
const BINARY_KIND = 'docs-editor/binary';
const PLAINTEXT_KIND = 'docs-editor/plaintext';

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

/** Upgrade legacy text-block sections into a real .docx. */
async function bytesFromTextSections(sections: { kind: string; body: string }[]): Promise<Uint8Array | null> {
  const textSections = sections.filter((s) => s.kind.startsWith('docs-editor/') && s.kind !== BINARY_KIND && s.kind !== PLAINTEXT_KIND);
  if (textSections.length === 0) return null;
  const blank = await buildBlankDocx();
  const doc = await parseDocx(blank);
  const out = await saveDocx(doc, textSections.map((s) => ({
    kind: 'generated' as const,
    block: { type: 'paragraph', runs: [{ text: s.body }] },
  })));
  return out;
}

async function extractText(bytes: Uint8Array): Promise<string> {
  try {
    const doc = await parseDocx(bytes);
    return doc.blocks
      .filter((b) => !b.hidden)
      .map((b) => b.runs?.map((r) => r.text).join('') ?? '')
      .filter((t) => t.trim())
      .join('\n\n');
  } catch {
    return '';
  }
}

export function DocsView({ artifactId, handoffId }: DocsViewProps) {
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
      .then(async (next) => {
        if (cancelled) return;
        setArtifact(next);
        const binary = next.sections.find((s) => s.kind === BINARY_KIND);
        if (binary?.body) {
          setInitialBytes(fromBase64(binary.body));
        } else {
          const generated = await bytesFromTextSections(next.sections);
          if (!cancelled && generated) setInitialBytes(generated);
        }
        setInitialName(`${next.title.replace(/\s+/g, '_')}.docx`);
        if (!cancelled) setLoaded(true);
      })
      .catch(() => {
        // The editor works standalone with a blank docx; ignore fetch failures.
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
  const saveErrorRef = useRef<string | null>(null);

  const persistBytes = useCallback(
    async (bytes: Uint8Array, name: string) => {
      if (!artifact) return;
      const title = name.replace(/\.docx$/i, '').replace(/_/g, ' ').trim();
      if (title && title !== artifact.title) {
        await updateArtifact(artifact.id, { title });
      }
      const encoded = toBase64(bytes);
      const text = await extractText(bytes);
      const sections = [...artifact.sections].sort((a, b) => a.position - b.position);
      const binary = sections.find((s) => s.kind === BINARY_KIND);
      if (binary) {
        if (binary.body !== encoded) {
          await updateArtifactSection(artifact.id, binary.id, { body: encoded });
        }
      } else {
        await createArtifactSection(artifact.id, {
          heading: 'Document (docx)',
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

  // The app autosaves; debounce persistence to the artifact service.
  const handleSave = useCallback(
    (bytes: Uint8Array, name: string) => {
      if (!artifact) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        persistBytes(bytes, name).catch((err) => {
          saveErrorRef.current = (err as Error).message;
          // The bridge has no error channel; surface via console for now.
          console.error('[DocsView] artifact save failed', err);
        });
      }, 1500);
    },
    [artifact, persistBytes],
  );

  // Host contract passed to the suite adapter. The browser host provides file
  // picking and download fallbacks; we override saveFile with artifact persistence.
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
        <DocsApp
          key={artifact?.id ?? (handoffFileRef.current ? 'handoff' : 'standalone')}
          document={initialBytes ? { bytes: initialBytes, name: initialName ?? 'document.docx' } : undefined}
        />
      </OfficeHostProvider>
    </div>
  );
}

export default DocsView;
