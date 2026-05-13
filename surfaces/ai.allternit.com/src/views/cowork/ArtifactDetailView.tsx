import React, { useEffect, useState } from 'react';
import { ArrowLeft, Eye, FileText, PencilSimple, Plus } from '@phosphor-icons/react';
import GlassSurface from '@/design/GlassSurface';
import ArtifactRenderer from '@/components/artifact/ArtifactRenderer';
import BlockSuiteEditor from '@/components/artifact/BlockSuiteEditor';
import type { AllternitSectionKind, AllternitArtifact } from '@/lib/artifacts/schema';
import {
  createArtifactSection,
  fetchArtifactById,
  fetchArtifactRevisions,
  updateArtifact,
  updateArtifactSection,
  type ArtifactDto,
  type ArtifactRevisionDto,
} from '@/services/artifacts-api';
import { DocmostAdapter } from '@/services/docmost/DocmostAdapter';
import { WikiSectionViewer } from './WikiSectionViewer';

const DOCmost_URL = process.env.NEXT_PUBLIC_DOCMOST_URL || 'http://localhost:3000';
const wikiAdapter = new DocmostAdapter({ baseUrl: `${DOCmost_URL}/api` });

// Safe base64 helpers for Yjs Uint8Array round-tripping (avoids stack overflow & btoa latin1 limits)
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array | undefined {
  try {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return undefined;
  }
}

interface ArtifactDetailViewProps {
  artifactId: string;
  onBack?: () => void;
  onArtifactChanged?: (artifact: ArtifactDto) => void;
  onStatusMessage?: (message: string) => void;
}

export function ArtifactDetailView({
  artifactId,
  onBack,
  onArtifactChanged,
  onStatusMessage,
}: ArtifactDetailViewProps) {
  const [artifact, setArtifact] = useState<ArtifactDto | null>(null);
  const [revisions, setRevisions] = useState<ArtifactRevisionDto[]>([]);
  const [detailTitle, setDetailTitle] = useState('');
  const [detailSummary, setDetailSummary] = useState('');
  const [detailStatus, setDetailStatus] = useState<'draft' | 'active' | 'final' | 'archived'>('draft');
  const [loading, setLoading] = useState(false);
  const [isAddingSection, setIsAddingSection] = useState(false);
  const [newSectionHeading, setNewSectionHeading] = useState('');
  const [newSectionKind, setNewSectionKind] = useState<AllternitSectionKind>('document/markdown');

  const loadArtifact = async () => {
    setLoading(true);
    try {
      const [nextArtifact, nextRevisions] = await Promise.all([
        fetchArtifactById(artifactId),
        fetchArtifactRevisions(artifactId),
      ]);
      setArtifact(nextArtifact);
      setRevisions(nextRevisions);
      setDetailTitle(nextArtifact.title);
      setDetailSummary(nextArtifact.summary || '');
      setDetailStatus(nextArtifact.status);
      onArtifactChanged?.(nextArtifact);
    } catch (error) {
      onStatusMessage?.(error instanceof Error ? error.message : 'Failed to load artifact detail.');
      setArtifact(null);
      setRevisions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadArtifact();
  }, [artifactId]);

  const handleSaveArtifactMeta = () => {
    const run = async () => {
      if (!artifact) return;
      try {
        const updated = await updateArtifact(artifact.id, {
          title: detailTitle,
          summary: detailSummary,
          status: detailStatus,
        });
        setArtifact(updated);
        setRevisions(await fetchArtifactRevisions(updated.id));
        onArtifactChanged?.(updated);
        onStatusMessage?.(`Saved "${updated.title}".`);
      } catch (error) {
        onStatusMessage?.(error instanceof Error ? error.message : 'Failed to save artifact.');
      }
    };

    void run();
  };

  const handleSaveSection = (sectionId: string, body: string, heading: string) => {
    const run = async () => {
      if (!artifact) return;
      try {
        await updateArtifactSection(artifact.id, sectionId, { body, heading });
        await loadArtifact();
        onStatusMessage?.(`Saved section "${heading}".`);
      } catch (error) {
        onStatusMessage?.(error instanceof Error ? error.message : 'Failed to save section.');
      }
    };

    void run();
  };

  const handleAddSection = () => {
    setIsAddingSection(true);
    setNewSectionHeading(`Section ${(artifact?.sections.length ?? 0) + 1}`);
    setNewSectionKind('document/markdown');
  };

  const handleConfirmAddSection = () => {
    const run = async () => {
      if (!artifact || !newSectionHeading.trim()) return;
      try {
        await createArtifactSection(artifact.id, {
          heading: newSectionHeading.trim(),
          kind: newSectionKind,
          body: '',
          position: artifact.sections.length,
        });
        setIsAddingSection(false);
        setNewSectionHeading('');
        await loadArtifact();
        onStatusMessage?.(`Added section "${newSectionHeading.trim()}".`);
      } catch (error) {
        onStatusMessage?.(error instanceof Error ? error.message : 'Failed to add section.');
      }
    };

    void run();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--spacing-md)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
          {onBack ? (
            <button
              onClick={onBack}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid var(--border-subtle)',
                background: 'transparent',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <ArrowLeft size={14} />
              Back to Documents
            </button>
          ) : null}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
              <FileText size={22} color="#af52de" />
              <h1 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '24px', fontWeight: 600 }}>
                Artifact Detail
              </h1>
            </div>
            <p style={{ margin: '8px 0 0', color: 'var(--text-secondary)', fontSize: '14px' }}>
              Edit sections, track revisions, and manage the owned artifact record
            </p>
          </div>
        </div>
      </div>

      <GlassSurface style={{ padding: 'var(--spacing-lg)' }}>
        {loading || !artifact ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Loading artifact…</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(320px, 0.8fr)', gap: 'var(--spacing-lg)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
              <div style={{ paddingBottom: 'var(--spacing-md)', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ color: 'var(--text-primary)', fontSize: '18px', fontWeight: 700 }}>{artifact.title}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: 4 }}>{artifact.id}</div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: 600 }}>Sections</div>
                {!isAddingSection && (
                  <button
                    onClick={handleAddSection}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: '1px solid var(--border-subtle)',
                      background: 'transparent',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    <Plus size={12} />
                    Add Section
                  </button>
                )}
              </div>

              {isAddingSection && (
                <GlassSurface style={{ padding: 'var(--spacing-md)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                  <div style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 600 }}>New Section</div>
                  <input
                    value={newSectionHeading}
                    onChange={(e) => setNewSectionHeading(e.target.value)}
                    placeholder="Section heading"
                    style={{
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontSize: 13,
                    }}
                  />
                  <select
                    value={newSectionKind}
                    onChange={(e) => setNewSectionKind(e.target.value as AllternitSectionKind)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontSize: 13,
                    }}
                  >
                    <option value="document/markdown">Document / Markdown</option>
                    <option value="document/html">Document / HTML</option>
                    <option value="document/wiki">Document / Wiki</option>
                    <option value="code/generic">Code / Generic</option>
                    <option value="code/react">Code / React</option>
                    <option value="media/svg">Media / SVG</option>
                    <option value="media/mermaid">Media / Mermaid</option>
                    <option value="design/board">Design / Board</option>
                    <option value="data/table">Data / Table</option>
                  </select>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => setIsAddingSection(false)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 6,
                        border: '1px solid var(--border-subtle)',
                        background: 'transparent',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmAddSection}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 6,
                        border: 'none',
                        background: 'var(--accent-cowork)',
                        color: '#fff',
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      Create Section
                    </button>
                  </div>
                </GlassSurface>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {artifact.sections.map((section) => (
                  <ArtifactSectionEditor
                    key={section.id}
                    sectionId={section.id}
                    heading={section.heading}
                    kind={section.kind}
                    body={section.body}
                    onSave={handleSaveSection}
                  />
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Title</span>
                <input
                  value={detailTitle}
                  onChange={(e) => setDetailTitle(e.target.value)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                  }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Summary</span>
                <textarea
                  value={detailSummary}
                  onChange={(e) => setDetailSummary(e.target.value)}
                  rows={4}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    resize: 'vertical',
                  }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Status</span>
                <select
                  value={detailStatus}
                  onChange={(e) => setDetailStatus(e.target.value as typeof detailStatus)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <option value="draft">draft</option>
                  <option value="active">active</option>
                  <option value="final">final</option>
                  <option value="archived">archived</option>
                </select>
              </label>

              <button
                onClick={handleSaveArtifactMeta}
                style={{
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'var(--accent-cowork)',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Save Artifact
              </button>

              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--spacing-md)' }}>
                <div style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 600, marginBottom: 10 }}>
                  Revision History
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 380, overflow: 'auto' }}>
                  {revisions.map((revision) => (
                    <div key={revision.id} style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bg-secondary)' }}>
                      <div style={{ color: 'var(--text-primary)', fontSize: '12px', fontWeight: 600 }}>{revision.reason}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: 4 }}>
                        {new Date(revision.createdAt).toLocaleString()}
                      </div>
                      <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginTop: 6 }}>
                        {revision.snapshot.title} · {revision.snapshot.status} · {revision.snapshot.sections.length} sections
                      </div>
                    </div>
                  ))}
                  {revisions.length === 0 ? (
                    <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>No revisions yet.</div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        )}
      </GlassSurface>
    </div>
  );
}

function ArtifactSectionEditor({
  sectionId,
  heading,
  kind,
  body,
  onSave,
}: {
  sectionId: string;
  heading: string;
  kind: string;
  body: string;
  onSave: (sectionId: string, body: string, heading: string) => void;
}) {
  const [draftHeading, setDraftHeading] = useState(heading);
  const [draftBody, setDraftBody] = useState(body);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setDraftHeading(heading);
    setDraftBody(body);
  }, [heading, body]);

  // BlockSuite-powered board sections render the forked editor natively
  if (kind === 'design/board') {
    return (
      <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--bg-secondary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{kind}</div>
          <button
            onClick={() => onSave(sectionId, draftBody, draftHeading)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 8px',
              borderRadius: 6,
              border: 'none',
              background: 'var(--accent-cowork)',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Save Board
          </button>
        </div>
        <input
          value={draftHeading}
          onChange={(e) => setDraftHeading(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 10px',
            borderRadius: 6,
            border: '1px solid var(--border-subtle)',
            background: 'var(--surface-panel)',
            color: 'var(--text-primary)',
            marginBottom: 8,
          }}
        />
        <BlockSuiteEditor
          docId={sectionId}
          initialYjsState={base64ToUint8Array(body)}
          onChange={(yjsUpdate) => {
            // Store Yjs update as base64 in the section body for now
            setDraftBody(uint8ArrayToBase64(yjsUpdate));
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--bg-secondary)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{kind}</div>
        <button
          onClick={() => {
            if (isEditing) {
              onSave(sectionId, draftBody, draftHeading);
            }
            setIsEditing((v) => !v);
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 8px',
            borderRadius: 6,
            border: '1px solid var(--border-subtle)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {isEditing ? <Eye size={12} /> : <PencilSimple size={12} />}
          {isEditing ? 'View' : 'Edit'}
        </button>
      </div>

      {isEditing ? (
        <>
          <input
            value={draftHeading}
            onChange={(e) => setDraftHeading(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: 6,
              border: '1px solid var(--border-subtle)',
              background: 'var(--surface-panel)',
              color: 'var(--text-primary)',
              marginBottom: 8,
            }}
          />
          <textarea
            value={draftBody}
            onChange={(e) => setDraftBody(e.target.value)}
            rows={8}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid var(--border-subtle)',
              background: 'var(--surface-panel)',
              color: 'var(--text-primary)',
              resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button
              onClick={() => {
                onSave(sectionId, draftBody, draftHeading);
                setIsEditing(false);
              }}
              style={{
                padding: '6px 10px',
                borderRadius: 6,
                border: 'none',
                background: 'var(--accent-cowork)',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              Save Section
            </button>
          </div>
        </>
      ) : (
        <>
          <div style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: 600, marginBottom: 8 }}>
            {heading}
          </div>
          {kind === 'document/wiki' ? (
            <WikiSectionViewer pageId={body} />
          ) : (
            <ArtifactRenderer content={body} type={kind} />
          )}
        </>
      )}
    </div>
  );
}

export default ArtifactDetailView;
