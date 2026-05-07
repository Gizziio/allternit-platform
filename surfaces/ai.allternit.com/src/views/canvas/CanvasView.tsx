/**
 * Allternit Canvas Surface
 * A full-screen artifact workspace derived from the Lobe Chat artifact renderer.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { GlassSurface } from '@/design/GlassSurface';
import ArtifactRenderer from '@/components/artifact/ArtifactRenderer';
import { useArtifactStore } from '@/views/cowork/ArtifactStore';
import { useWorkspaceStore } from '@/stores/workspace.store';
import {
  fetchArtifacts,
  createArtifact,
  updateArtifactSection,
  type ArtifactDto,
} from '@/services/artifacts-api';
import type { AllternitSectionKind } from '@/lib/artifacts/schema';
import {
  BACKGROUND,
  TEXT,
  BORDER,
  RADIUS,
  SPACE,
  TYPOGRAPHY,
} from '@/design/allternit.tokens';
import {
  SquaresFour,
  Plus,
  PencilSimple,
  X,
} from '@phosphor-icons/react';

/* ------------------------------------------------------------------ */
//  Helpers
/* ------------------------------------------------------------------ */

function mapLocalTypeToKind(type: string): AllternitSectionKind {
  switch (type) {
    case 'code':
      return 'code/generic';
    case 'ui-block':
      return 'code/react';
    case 'board':
      return 'design/board';
    case 'table':
      return 'data/table';
    default:
      return 'document/markdown';
  }
}

function mapKindToLocalType(kind: AllternitSectionKind): 'document' | 'code' | 'ui-block' | 'board' | 'table' {
  switch (kind) {
    case 'code/generic':
      return 'code';
    case 'code/react':
      return 'ui-block';
    case 'design/board':
      return 'board';
    case 'data/table':
      return 'table';
    default:
      return 'document';
  }
}

/* ------------------------------------------------------------------ */
//  Component
/* ------------------------------------------------------------------ */

export function CanvasView(): JSX.Element {
  // -- Data sources --
  const [apiArtifacts, setApiArtifacts] = useState<ArtifactDto[]>([]);
  const localArtifacts = useArtifactStore((s) => s.artifacts);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  // -- Selection --
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<'api' | 'local' | null>(null);

  // -- Editor --
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorSectionId, setEditorSectionId] = useState<string | null>(null);
  const [editorHeading, setEditorHeading] = useState('');
  const [editorBody, setEditorBody] = useState('');

  // -- Create inline --
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newKind, setNewKind] = useState<AllternitSectionKind>('document/markdown');

  // -- Status --
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // -- Load API artifacts --
  useEffect(() => {
    let cancelled = false;
    fetchArtifacts({})
      .then((arts) => {
        if (!cancelled) setApiArtifacts(arts);
      })
      .catch(() => {
        if (!cancelled) setApiArtifacts([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // -- Derived selected objects --
  const selectedApi = useMemo(
    () => apiArtifacts.find((a) => a.id === selectedId) ?? null,
    [apiArtifacts, selectedId]
  );

  const selectedLocal = useMemo(
    () => localArtifacts.find((a) => a.id === selectedId) ?? null,
    [localArtifacts, selectedId]
  );

  // -- Editor helpers --
  const openEditor = useCallback(() => {
    if (selectedSource === 'api' && selectedApi) {
      const section = selectedApi.sections[0] ?? null;
      setEditorSectionId(section?.id ?? null);
      setEditorHeading(section?.heading ?? '');
      setEditorBody(section?.body ?? '');
    } else if (selectedSource === 'local' && selectedLocal) {
      setEditorSectionId(null);
      setEditorHeading(selectedLocal.title);
      setEditorBody(selectedLocal.content);
    }
    setEditorOpen(true);
  }, [selectedSource, selectedApi, selectedLocal]);

  const closeEditor = useCallback(() => {
    setEditorOpen(false);
    setEditorSectionId(null);
    setEditorHeading('');
    setEditorBody('');
  }, []);

  const handleSaveEditor = useCallback(() => {
    const run = async () => {
      if (selectedSource === 'api' && selectedApi && editorSectionId) {
        try {
          await updateArtifactSection(selectedApi.id, editorSectionId, {
            heading: editorHeading,
            body: editorBody,
          });
          // Refresh
          const refreshed = await fetchArtifacts({});
          setApiArtifacts(refreshed);
          setStatusMessage('Section saved.');
        } catch (err) {
          setStatusMessage(err instanceof Error ? err.message : 'Save failed.');
        }
      } else if (selectedSource === 'local' && selectedLocal) {
        useArtifactStore.getState().updateArtifact(selectedLocal.id, editorBody);
        setStatusMessage('Local artifact saved.');
      }
    };
    void run();
  }, [selectedSource, selectedApi, selectedLocal, editorSectionId, editorHeading, editorBody]);

  // -- Selection handler --
  const selectItem = useCallback((id: string, source: 'api' | 'local') => {
    setSelectedId(id);
    setSelectedSource(source);
    setEditorOpen(false);
  }, []);

  // -- Create artifact --
  const handleCreate = useCallback(() => {
    const run = async () => {
      if (!newTitle.trim()) return;
      const title = newTitle.trim();

      if (activeWorkspaceId) {
        try {
          const artifact = await createArtifact({
            workspaceId: activeWorkspaceId,
            title,
            type: 'document',
            status: 'draft',
            sections: [
              { heading: title, kind: newKind, body: '' },
            ],
          });
          setApiArtifacts((prev) => [artifact, ...prev]);
          setSelectedId(artifact.id);
          setSelectedSource('api');
          setIsCreating(false);
          setNewTitle('');
          setStatusMessage(`Created "${artifact.title}".`);
        } catch (err) {
          setStatusMessage(err instanceof Error ? err.message : 'Create failed.');
        }
      } else {
        // Fallback to local store
        const localType = mapKindToLocalType(newKind);
        useArtifactStore.getState().createArtifact(localType, title, '');
        setIsCreating(false);
        setNewTitle('');
        setStatusMessage('Created local artifact.');
      }
    };
    void run();
  }, [activeWorkspaceId, newTitle, newKind]);

  // -- UI helpers --
  const isActiveItem = (id: string, source: 'api' | 'local') =>
    selectedId === id && selectedSource === source;

  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        width: '100%',
        background: BACKGROUND.primary,
        color: TEXT.primary,
        fontFamily: TYPOGRAPHY.fontFamily.sans,
      }}
    >
      {/* ── Sidebar ── */}
      <GlassSurface
        style={{
          width: 260,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          borderRight: `1px solid ${BORDER.subtle}`,
          borderRadius: 0,
          background: BACKGROUND.secondary,
        }}
      >
        {/* Sidebar header */}
        <div
          style={{
            padding: `${SPACE[4]} ${SPACE[4]}`,
            borderBottom: `1px solid ${BORDER.subtle}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACE[2] }}>
            <SquaresFour size={18} color="var(--accent-primary)" />
            <span style={{ fontSize: TYPOGRAPHY.size.md, fontWeight: TYPOGRAPHY.weight.semibold }}>
              Canvas
            </span>
          </div>
          <button
            onClick={() => setIsCreating((v) => !v)}
            style={{
              width: 28,
              height: 28,
              borderRadius: RADIUS.md,
              border: `1px solid ${BORDER.subtle}`,
              background: 'transparent',
              color: TEXT.secondary,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="New artifact"
          >
            <Plus size={14} />
          </button>
        </div>

        {/* Create form */}
        {isCreating && (
          <div
            style={{
              padding: SPACE[4],
              borderBottom: `1px solid ${BORDER.subtle}`,
              display: 'flex',
              flexDirection: 'column',
              gap: SPACE[2],
            }}
          >
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Artifact title"
              autoFocus
              style={{
                padding: `${SPACE[2]} ${SPACE[3]}`,
                borderRadius: RADIUS.sm,
                border: `1px solid ${BORDER.subtle}`,
                background: BACKGROUND.primary,
                color: TEXT.primary,
                fontSize: TYPOGRAPHY.size.sm,
                outline: 'none',
              }}
            />
            <select
              value={newKind}
              onChange={(e) => setNewKind(e.target.value as AllternitSectionKind)}
              style={{
                padding: `${SPACE[2]} ${SPACE[3]}`,
                borderRadius: RADIUS.sm,
                border: `1px solid ${BORDER.subtle}`,
                background: BACKGROUND.primary,
                color: TEXT.primary,
                fontSize: TYPOGRAPHY.size.sm,
                outline: 'none',
              }}
            >
              <option value="document/markdown">Document / Markdown</option>
              <option value="document/html">Document / HTML</option>
              <option value="code/generic">Code / Generic</option>
              <option value="code/react">Code / React</option>
              <option value="data/table">Data / Table</option>
              <option value="design/board">Design / Board</option>
              <option value="media/svg">Media / SVG</option>
              <option value="media/mermaid">Media / Mermaid</option>
            </select>
            <div style={{ display: 'flex', gap: SPACE[2], justifyContent: 'flex-end' }}>
              <button
                onClick={() => setIsCreating(false)}
                style={{
                  padding: `${SPACE[2]} ${SPACE[3]}`,
                  borderRadius: RADIUS.sm,
                  border: `1px solid ${BORDER.subtle}`,
                  background: 'transparent',
                  color: TEXT.secondary,
                  cursor: 'pointer',
                  fontSize: TYPOGRAPHY.size.xs,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                style={{
                  padding: `${SPACE[2]} ${SPACE[3]}`,
                  borderRadius: RADIUS.sm,
                  border: 'none',
                  background: 'var(--accent-primary)',
                  color: BACKGROUND.primary,
                  cursor: 'pointer',
                  fontSize: TYPOGRAPHY.size.xs,
                  fontWeight: TYPOGRAPHY.weight.semibold,
                }}
              >
                Create
              </button>
            </div>
          </div>
        )}

        {/* Status */}
        {statusMessage && (
          <div
            style={{
              padding: `${SPACE[2]} ${SPACE[4]}`,
              fontSize: TYPOGRAPHY.size.xs,
              color: 'var(--accent-cowork)',
              borderBottom: `1px solid ${BORDER.subtle}`,
            }}
          >
            {statusMessage}
          </div>
        )}

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: `${SPACE[2]} 0` }}>
          {/* API Artifacts */}
          {apiArtifacts.length > 0 && (
            <div style={{ marginBottom: SPACE[2] }}>
              <div
                style={{
                  padding: `${SPACE[2]} ${SPACE[4]}`,
                  fontSize: TYPOGRAPHY.size.xs,
                  fontWeight: TYPOGRAPHY.weight.extrabold,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: TEXT.tertiary,
                }}
              >
                Workspace
              </div>
              {apiArtifacts.map((art) => (
                <button
                  key={art.id}
                  onClick={() => selectItem(art.id, 'api')}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: `${SPACE[2]} ${SPACE[4]}`,
                    background: isActiveItem(art.id, 'api')
                      ? 'var(--shell-item-active-bg)'
                      : 'transparent',
                    border: 'none',
                    borderLeft: isActiveItem(art.id, 'api')
                      ? '2px solid var(--accent-primary)'
                      : '2px solid transparent',
                    color: isActiveItem(art.id, 'api')
                      ? 'var(--accent-primary)'
                      : TEXT.primary,
                    cursor: 'pointer',
                    fontSize: TYPOGRAPHY.size.sm,
                    fontWeight: TYPOGRAPHY.weight.medium,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {art.title}
                  </span>
                  <span
                    style={{
                      fontSize: TYPOGRAPHY.size.xs,
                      color: TEXT.tertiary,
                      flexShrink: 0,
                      marginLeft: SPACE[2],
                    }}
                  >
                    {art.sections.length} sect
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Local Artifacts */}
          {localArtifacts.length > 0 && (
            <div>
              <div
                style={{
                  padding: `${SPACE[2]} ${SPACE[4]}`,
                  fontSize: TYPOGRAPHY.size.xs,
                  fontWeight: TYPOGRAPHY.weight.extrabold,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: TEXT.tertiary,
                }}
              >
                Session
              </div>
              {localArtifacts.map((art) => (
                <button
                  key={art.id}
                  onClick={() => selectItem(art.id, 'local')}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: `${SPACE[2]} ${SPACE[4]}`,
                    background: isActiveItem(art.id, 'local')
                      ? 'var(--shell-item-active-bg)'
                      : 'transparent',
                    border: 'none',
                    borderLeft: isActiveItem(art.id, 'local')
                      ? '2px solid var(--accent-primary)'
                      : '2px solid transparent',
                    color: isActiveItem(art.id, 'local')
                      ? 'var(--accent-primary)'
                      : TEXT.primary,
                    cursor: 'pointer',
                    fontSize: TYPOGRAPHY.size.sm,
                    fontWeight: TYPOGRAPHY.weight.medium,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {art.title}
                  </span>
                  <span
                    style={{
                      fontSize: TYPOGRAPHY.size.xs,
                      color: TEXT.tertiary,
                      flexShrink: 0,
                      marginLeft: SPACE[2],
                    }}
                  >
                    {art.type}
                  </span>
                </button>
              ))}
            </div>
          )}

          {apiArtifacts.length === 0 && localArtifacts.length === 0 && (
            <div
              style={{
                padding: SPACE[6],
                textAlign: 'center',
                color: TEXT.tertiary,
                fontSize: TYPOGRAPHY.size.sm,
              }}
            >
              No artifacts yet.
            </div>
          )}
        </div>
      </GlassSurface>

      {/* ── Main Canvas ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top bar */}
        <div
          style={{
            height: 56,
            flexShrink: 0,
            padding: `0 ${SPACE[4]}`,
            borderBottom: `1px solid ${BORDER.subtle}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: BACKGROUND.primary,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACE[2], minWidth: 0 }}>
            <SquaresFour size={18} color="var(--accent-primary)" />
            <span
              style={{
                fontSize: TYPOGRAPHY.size.md,
                fontWeight: TYPOGRAPHY.weight.semibold,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {selectedSource === 'api' && selectedApi
                ? selectedApi.title
                : selectedSource === 'local' && selectedLocal
                ? selectedLocal.title
                : 'Allternit Canvas'}
            </span>
          </div>

          {selectedSource && (
            <button
              onClick={() => (editorOpen ? closeEditor() : openEditor())}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: SPACE[2],
                padding: `${SPACE[2]} ${SPACE[3]}`,
                borderRadius: RADIUS.sm,
                border: `1px solid ${BORDER.subtle}`,
                background: 'transparent',
                color: TEXT.secondary,
                cursor: 'pointer',
                fontSize: TYPOGRAPHY.size.xs,
                fontWeight: TYPOGRAPHY.weight.semibold,
              }}
            >
              {editorOpen ? <X size={12} /> : <PencilSimple size={12} />}
              {editorOpen ? 'Close Editor' : 'Edit'}
            </button>
          )}
        </div>

        {/* Content + optional editor */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          {/* Canvas viewport */}
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              padding: SPACE[4],
              background: BACKGROUND.primary,
            }}
          >
            {!selectedSource && (
              <div
                style={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: SPACE[4],
                  color: TEXT.tertiary,
                }}
              >
                <SquaresFour size={48} opacity={0.25} />
                <div style={{ fontSize: TYPOGRAPHY.size.lg, fontWeight: TYPOGRAPHY.weight.semibold }}>
                  Select an artifact to begin
                </div>
                <div style={{ fontSize: TYPOGRAPHY.size.sm, maxWidth: 320, textAlign: 'center' }}>
                  Choose a workspace or session artifact from the sidebar to render it on the canvas.
                </div>
              </div>
            )}

            {selectedSource === 'api' && selectedApi && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE[4] }}>
                {selectedApi.sections.map((section) => (
                  <GlassSurface
                    key={section.id}
                    style={{
                      padding: SPACE[4],
                      borderRadius: RADIUS.lg,
                      minHeight: '40vh',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: SPACE[3],
                      }}
                    >
                      <span
                        style={{
                          fontSize: TYPOGRAPHY.size.sm,
                          fontWeight: TYPOGRAPHY.weight.semibold,
                          color: TEXT.primary,
                        }}
                      >
                        {section.heading}
                      </span>
                      <span
                        style={{
                          fontSize: TYPOGRAPHY.size.xs,
                          color: TEXT.tertiary,
                          fontFamily: TYPOGRAPHY.fontFamily.mono,
                        }}
                      >
                        {section.kind}
                      </span>
                    </div>
                    <ArtifactRenderer
                      content={section.body}
                      type={section.kind}
                      height="100%"
                      width="100%"
                    />
                  </GlassSurface>
                ))}
              </div>
            )}

            {selectedSource === 'local' && selectedLocal && (
              <GlassSurface
                style={{
                  padding: SPACE[4],
                  borderRadius: RADIUS.lg,
                  height: 'calc(100% - 2px)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: SPACE[3],
                  }}
                >
                  <span
                    style={{
                      fontSize: TYPOGRAPHY.size.sm,
                      fontWeight: TYPOGRAPHY.weight.semibold,
                      color: TEXT.primary,
                    }}
                  >
                    {selectedLocal.title}
                  </span>
                  <span
                    style={{
                      fontSize: TYPOGRAPHY.size.xs,
                      color: TEXT.tertiary,
                      fontFamily: TYPOGRAPHY.fontFamily.mono,
                    }}
                  >
                    {mapLocalTypeToKind(selectedLocal.type)}
                  </span>
                </div>
                <ArtifactRenderer
                  content={selectedLocal.content}
                  type={mapLocalTypeToKind(selectedLocal.type)}
                  height="100%"
                  width="100%"
                />
              </GlassSurface>
            )}
          </div>

          {/* Editor panel */}
          {editorOpen && (
            <GlassSurface
              style={{
                width: 420,
                flexShrink: 0,
                borderLeft: `1px solid ${BORDER.subtle}`,
                borderRadius: 0,
                display: 'flex',
                flexDirection: 'column',
                background: BACKGROUND.secondary,
              }}
            >
              <div
                style={{
                  padding: `${SPACE[3]} ${SPACE[4]}`,
                  borderBottom: `1px solid ${BORDER.subtle}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ fontSize: TYPOGRAPHY.size.sm, fontWeight: TYPOGRAPHY.weight.semibold }}>
                  Editor
                </span>
                <button
                  onClick={closeEditor}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: RADIUS.sm,
                    border: 'none',
                    background: 'transparent',
                    color: TEXT.secondary,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <X size={14} />
                </button>
              </div>

              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: SPACE[4],
                  display: 'flex',
                  flexDirection: 'column',
                  gap: SPACE[3],
                }}
              >
                {selectedSource === 'api' && selectedApi && (
                  <>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: SPACE[1] }}>
                      <span style={{ fontSize: TYPOGRAPHY.size.xs, color: TEXT.tertiary, fontWeight: TYPOGRAPHY.weight.semibold }}>
                        Section
                      </span>
                      <select
                        value={editorSectionId ?? ''}
                        onChange={(e) => {
                          const sid = e.target.value;
                          const sec = selectedApi.sections.find((s) => s.id === sid);
                          if (sec) {
                            setEditorSectionId(sec.id);
                            setEditorHeading(sec.heading);
                            setEditorBody(sec.body);
                          }
                        }}
                        style={{
                          padding: `${SPACE[2]} ${SPACE[3]}`,
                          borderRadius: RADIUS.sm,
                          border: `1px solid ${BORDER.subtle}`,
                          background: BACKGROUND.primary,
                          color: TEXT.primary,
                          fontSize: TYPOGRAPHY.size.sm,
                          outline: 'none',
                        }}
                      >
                        {selectedApi.sections.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.heading}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label style={{ display: 'flex', flexDirection: 'column', gap: SPACE[1] }}>
                      <span style={{ fontSize: TYPOGRAPHY.size.xs, color: TEXT.tertiary, fontWeight: TYPOGRAPHY.weight.semibold }}>
                        Heading
                      </span>
                      <input
                        value={editorHeading}
                        onChange={(e) => setEditorHeading(e.target.value)}
                        style={{
                          padding: `${SPACE[2]} ${SPACE[3]}`,
                          borderRadius: RADIUS.sm,
                          border: `1px solid ${BORDER.subtle}`,
                          background: BACKGROUND.primary,
                          color: TEXT.primary,
                          fontSize: TYPOGRAPHY.size.sm,
                          outline: 'none',
                        }}
                      />
                    </label>
                  </>
                )}

                <label style={{ display: 'flex', flexDirection: 'column', gap: SPACE[1], flex: 1 }}>
                  <span style={{ fontSize: TYPOGRAPHY.size.xs, color: TEXT.tertiary, fontWeight: TYPOGRAPHY.weight.semibold }}>
                    Content
                  </span>
                  <textarea
                    value={editorBody}
                    onChange={(e) => setEditorBody(e.target.value)}
                    style={{
                      flex: 1,
                      minHeight: 200,
                      padding: `${SPACE[2]} ${SPACE[3]}`,
                      borderRadius: RADIUS.sm,
                      border: `1px solid ${BORDER.subtle}`,
                      background: BACKGROUND.primary,
                      color: TEXT.primary,
                      fontSize: TYPOGRAPHY.size.sm,
                      outline: 'none',
                      resize: 'vertical',
                      fontFamily: TYPOGRAPHY.fontFamily.mono,
                    }}
                  />
                </label>

                <button
                  onClick={handleSaveEditor}
                  style={{
                    padding: `${SPACE[2]} ${SPACE[4]}`,
                    borderRadius: RADIUS.sm,
                    border: 'none',
                    background: 'var(--accent-primary)',
                    color: BACKGROUND.primary,
                    cursor: 'pointer',
                    fontSize: TYPOGRAPHY.size.sm,
                    fontWeight: TYPOGRAPHY.weight.semibold,
                    marginTop: 'auto',
                  }}
                >
                  Save Changes
                </button>
              </div>
            </GlassSurface>
          )}
        </div>
      </div>
    </div>
  );
}

export default CanvasView;
