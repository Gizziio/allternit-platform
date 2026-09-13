import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FilePdf, LinkSimple, UploadSimple } from '@phosphor-icons/react';
import { stashFile } from './file-handoff';
import { OfficeAppLogo } from './OfficeAppLogo';
import { fetchArtifacts, type ArtifactDto } from '@/services/artifacts-api';

export interface OfficeSuiteSectionProps {
  /**
   * Shell context: open editors as ACI shell views instead of navigating to
   * the full-page routes. Provided by the ViewRegistry; absent on standalone
   * routes (falls back to router navigation).
   */
  openView?: (viewType: string, context?: unknown) => void;
}

interface EditorCard {
  id: 'docs' | 'sheets' | 'slides' | 'pdf' | 'sign'
  name: string
  description: string
  formats: string[]
}

/** Open-a-file targets: the editors, Allternit Sign, plus the anydoc markdown preview. */
type RouteTarget = EditorCard['id'] | 'markdown-preview'

const EDITORS: EditorCard[] = [
  {
    id: 'docs',
    name: 'Allternit Docs',
    description: 'Word-compatible documents with byte-preserving save, powered by the Allternit docx engine.',
    formats: ['.docx'],
  },
  {
    id: 'sheets',
    name: 'Allternit Sheets',
    description: 'Excel-compatible workbooks with server-side IronCalc recalculation through the office engine.',
    formats: ['.xlsx'],
  },
  {
    id: 'slides',
    name: 'Allternit Slides',
    description: 'PowerPoint-compatible decks with engine patch-save and a web-worker round-trip pipeline.',
    formats: ['.pptx'],
  },
  {
    id: 'pdf',
    name: 'Allternit PDF',
    description:
      'Full PDF viewer with AI Q&A over the open file — text search, outlines, annotations, form filling, stamps, and signatures, all locally in the browser.',
    formats: ['.pdf'],
  },
  {
    id: 'sign',
    name: 'Allternit Sign',
    description: 'Native PDF signing — add signers, place signature fields on the page, and download the signed document. No cloud service or API key required.',
    formats: ['.pdf'],
  },
]

const ROUTE_BY_EXT: Record<string, RouteTarget> = {
  docx: 'docs',
  xlsx: 'sheets',
  pptx: 'slides',
  pdf: 'pdf',
  md: 'markdown-preview',
  // Formats with no native editor open in the anydoc markdown preview.
  doc: 'markdown-preview',
  docm: 'markdown-preview',
  ppt: 'markdown-preview',
  pps: 'markdown-preview',
  pot: 'markdown-preview',
  pptm: 'markdown-preview',
  ppsx: 'markdown-preview',
  ppsm: 'markdown-preview',
  xls: 'markdown-preview',
  xlsm: 'markdown-preview',
  xlsb: 'markdown-preview',
  odt: 'markdown-preview',
  ods: 'markdown-preview',
  odp: 'markdown-preview',
  rtf: 'markdown-preview',
  epub: 'markdown-preview',
  csv: 'markdown-preview',
}

const ACCEPT = Object.keys(ROUTE_BY_EXT)
  .map((ext) => `.${ext}`)
  .join(',')

const RECENT_PDFS_MAX = 4

/** An artifact counts as a PDF when it carries pdf bytes in any known section shape. */
function isPdfArtifact(artifact: ArtifactDto): boolean {
  return artifact.sections.some(
    (s) =>
      s.kind === 'pdf-viewer/binary' ||
      (s.kind === 'pdf' && s.body?.startsWith('data:application/pdf')),
  )
}

/**
 * The Allternit Office suite section: the four editor cards plus open-a-file.
 * Shared by the popped-out /office desktop window and any other office
 * surface so there is one source of truth for the suite.
 * Layout follows the platform's standard shell-view card recipe (same as
 * Artifacts Library / Automation Tasks) so it matches light and dark themes.
 */
export function OfficeSuiteSection({ openView }: OfficeSuiteSectionProps) {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [recentPdfs, setRecentPdfs] = useState<ArtifactDto[]>([])

  // PDFs opened through the launcher are transient, but PDFs saved as
  // artifacts (e.g. signed via Allternit Sign) persist — surface them so the
  // card is a library, not just a file picker. Failure just means no strip.
  useEffect(() => {
    let cancelled = false
    fetchArtifacts()
      .then((artifacts) => {
        if (cancelled) return
        setRecentPdfs(
          artifacts
            .filter(isPdfArtifact)
            .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
            .slice(0, RECENT_PDFS_MAX),
        )
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const openPdfArtifact = (artifactId: string) => {
    if (openView) {
      openView('pdf', { artifactId })
    } else {
      navigate(`/pdf/${encodeURIComponent(artifactId)}`)
    }
  }

  const openEditor = (editor: RouteTarget, handoffId?: string) => {
    if (openView) {
      openView(editor, handoffId ? { handoffId } : undefined)
    } else {
      navigate(`/${editor}`, handoffId ? { state: { handoffId } } : undefined)
    }
  }

  const openFile = async (file: File | undefined) => {
    if (!file) return
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    const target = ROUTE_BY_EXT[ext]
    if (!target) return
    const bytes = new Uint8Array(await file.arrayBuffer())
    const handoffId = stashFile({ name: file.name, bytes })
    openEditor(target, handoffId)
  }

  return (
    <div data-testid="office-suite-section">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept={ACCEPT}
        data-testid="office-launcher-file-input"
        onChange={(event) => {
          void openFile(event.target.files?.[0])
          event.target.value = ''
        }}
      />
      <div className="mb-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => openEditor('markdown-preview')}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3.5 text-sm text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)]"
          data-testid="office-launcher-open-url"
        >
          <LinkSimple size={16} />Open URL as Markdown
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3.5 text-sm text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)]"
        >
          <UploadSimple size={16} />Open a file
        </button>
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {EDITORS.map((editor) => (
          <article
            key={editor.id}
            className="flex min-h-56 flex-col rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5 transition-all duration-200 hover:border-[var(--border-hover)] hover:shadow-md"
            data-testid={`office-card-${editor.id}`}
          >
            <OfficeAppLogo product={editor.id} size={48} />
            <h3 className="mt-4 text-[15px] font-semibold text-[var(--text-primary)]">{editor.name}</h3>
            <p className="mt-1.5 line-clamp-3 text-[13px] leading-relaxed text-[var(--text-secondary)]">
              {editor.description}
            </p>
            <p className="mt-2 text-[11px] font-medium text-[var(--text-tertiary)]">{editor.formats.join(' · ')}</p>
            {editor.id === 'pdf' && recentPdfs.length > 0 && (
              <div className="mt-3 border-t border-[var(--border-subtle)] pt-2" data-testid="office-pdf-recents">
                <div className="text-[11px] font-medium text-[var(--text-tertiary)]">Recent PDFs</div>
                <ul className="mt-1 space-y-0.5">
                  {recentPdfs.map((artifact) => (
                    <li key={artifact.id}>
                      <button
                        type="button"
                        title={artifact.title}
                        data-testid={`office-pdf-recent-${artifact.id}`}
                        onClick={() => openPdfArtifact(artifact.id)}
                        className="inline-flex h-7 w-full items-center gap-1.5 rounded-md px-1.5 text-left text-[12px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
                      >
                        <FilePdf size={13} className="shrink-0" />
                        <span className="min-w-0 truncate">{artifact.title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                if (editor.id === 'pdf') {
                  fileInputRef.current?.click();
                } else if (editor.id === 'sign') {
                  if (openView) {
                    openView('sign');
                  } else {
                    navigate('/sign');
                  }
                } else {
                  openEditor(editor.id);
                }
              }}
              className="mt-auto inline-flex h-9 items-center justify-center rounded-lg bg-[var(--text-primary)] px-4 text-sm font-medium text-[var(--bg-elevated)] transition-opacity hover:opacity-90"
            >
              {editor.id === 'pdf' ? 'Open a PDF' : editor.id === 'sign' ? 'Open Sign' : 'Create new'}
            </button>
          </article>
        ))}
      </div>
    </div>
  )
}

export default OfficeSuiteSection
