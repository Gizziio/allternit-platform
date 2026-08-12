import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LinkSimple, UploadSimple } from '@phosphor-icons/react';
import { stashFile } from './file-handoff';
import { OfficeAppLogo } from './OfficeAppLogo';

export interface OfficeSuiteSectionProps {
  /**
   * Shell context: open editors as ACI shell views instead of navigating to
   * the full-page routes. Provided by the ViewRegistry; absent on standalone
   * routes (falls back to router navigation).
   */
  openView?: (viewType: string, context?: unknown) => void;
}

interface EditorCard {
  id: 'docs' | 'sheets' | 'slides' | 'pdf'
  name: string
  description: string
  formats: string[]
}

/** Open-a-file targets: the four editors plus the anydoc markdown preview. */
type RouteTarget = EditorCard['id'] | 'markdown-preview'

const EDITORS: EditorCard[] = [
  {
    id: 'docs',
    name: 'Allternit Docs',
    description: 'Word-compatible documents with byte-preserving save, powered by the GenOffice docx engine.',
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
    description: 'PDF viewing with pdf.js rendering, page navigation, zoom, and text extraction.',
    formats: ['.pdf'],
  },
]

const ROUTE_BY_EXT: Record<string, RouteTarget> = {
  docx: 'docs',
  xlsx: 'sheets',
  pptx: 'slides',
  pdf: 'pdf',
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

/**
 * The Allternit Office suite section: the four editor cards plus open-a-file.
 * Shared by the standalone /office launcher and the shell's
 * "Office & Extensions" view so there is one source of truth for the suite.
 * Layout follows the platform's standard shell-view card recipe (same as
 * Artifacts Library / Automation Tasks) so it matches light and dark themes.
 */
export function OfficeSuiteSection({ openView }: OfficeSuiteSectionProps) {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

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
            <button
              type="button"
              onClick={() =>
                editor.id === 'pdf'
                  ? fileInputRef.current?.click()
                  : openEditor(editor.id)
              }
              className="mt-auto inline-flex h-9 items-center justify-center rounded-lg bg-[var(--text-primary)] px-4 text-sm font-medium text-[var(--bg-elevated)] transition-opacity hover:opacity-90"
            >
              {editor.id === 'pdf' ? 'Open a PDF' : 'Create new'}
            </button>
          </article>
        ))}
      </div>
    </div>
  )
}

export default OfficeSuiteSection
