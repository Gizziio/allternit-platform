import React, { useEffect, useRef, useState } from 'react';
import { editorPackStorageKey } from '../editor-packs';
import {
  documentToPlaintext,
  downloadDocumentFile,
  exportDocumentFile,
  getStoredModel,
  plaintextToDocument,
  setStoredModel,
} from '../file-io';
import { parseInlineRuns } from '../office-io/docx';
import type { AllternitDocument, DocumentBlock, InlineRun } from '../office-io/types';
import { registerNativeDocumentSurface } from '../document-surface';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function runsToHtml(runs: InlineRun[]): string {
  return runs
    .map((run) => {
      let html = escapeHtml(run.text).replace(/\n/g, '<br>');
      if (run.bold) html = `<b>${html}</b>`;
      if (run.italic) html = `<i>${html}</i>`;
      if (run.underline) html = `<u>${html}</u>`;
      if (run.strike) html = `<s>${html}</s>`;
      if (run.code) html = `<code>${html}</code>`;
      const style: string[] = [];
      if (run.color) style.push(`color:${run.color}`);
      if (run.highlight) style.push(`background-color:${run.highlight}`);
      if (style.length > 0) html = `<span style="${style.join(';')}">${html}</span>`;
      return html;
    })
    .join('');
}

function splitRuns(runs: InlineRun[], offset: number): [InlineRun[], InlineRun[]] {
  const before: InlineRun[] = [];
  const after: InlineRun[] = [];
  let pos = 0;
  for (const run of runs) {
    const text = run.text;
    const end = pos + text.length;
    if (end <= offset) {
      before.push(run);
    } else if (pos >= offset) {
      after.push(run);
    } else {
      const splitAt = offset - pos;
      const left = text.slice(0, splitAt);
      const right = text.slice(splitAt);
      if (left) before.push({ ...run, text: left });
      if (right) after.push({ ...run, text: right });
    }
    pos = end;
  }
  return [before, after];
}

function emptyParagraph(): DocumentBlock {
  return { type: 'paragraph', content: [] };
}

function paragraphBlock(content: InlineRun[]): DocumentBlock {
  return { type: 'paragraph', content };
}

function getCaretTextOffset(element: HTMLElement): number {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return 0;
  const range = selection.getRangeAt(0);
  const preCaretRange = range.cloneRange();
  preCaretRange.selectNodeContents(element);
  preCaretRange.setEnd(range.endContainer, range.endOffset);
  return preCaretRange.toString().length;
}

function setCaretAtStart(element: HTMLElement) {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.setStart(element, 0);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

export default function DocumentEditorPack({ documentId, onClose }: { documentId: string; onClose: () => void }) {
  const key = editorPackStorageKey('documents', documentId);
  const [doc, setDoc] = useState<AllternitDocument>(() => {
    const stored = getStoredModel<AllternitDocument>('documents', documentId);
    const title = localStorage.getItem(`${key}.title`) || 'Untitled document';
    const body = localStorage.getItem(key) || '';
    const initial = stored || plaintextToDocument(title, body);
    return initial.blocks.length > 0 ? initial : { ...initial, blocks: [emptyParagraph()] };
  });
  const [revision, setRevision] = useState(0);
  const activeIndexRef = useRef(0);
  const [selectedTableCell, setSelectedTableCell] = useState<{ blockIndex: number; row: number; col: number } | null>(null);
  const listItemRefs = useRef<Record<string, HTMLLIElement | null>>({});
  const tableCellRefs = useRef<Record<string, HTMLTableCellElement | null>>({});

  useEffect(() => {
    setStoredModel('documents', documentId, doc);
    localStorage.setItem(`${key}.title`, doc.title);
    localStorage.setItem(key, documentToPlaintext(doc));
  }, [doc, documentId, key]);

  useEffect(
    () =>
      registerNativeDocumentSurface({
        id: documentId,
        kind: 'documents',
        snapshot: () => ({
          surfaceId: documentId,
          kind: 'documents',
          title: doc.title,
          revision,
          content: { body: documentToPlaintext(doc) },
        }),
        apply: (mutation) => {
          if (mutation.type === 'export-office') {
            return exportDocumentFile('documents', documentId, mutation.format).then(() => ({
              revision,
              summary: `Exported as ${mutation.format}.`,
            }));
          }
          if (mutation.type === 'insert-block') {
            const block = mutation.block as DocumentBlock;
            const index = mutation.index ?? activeIndexRef.current + 1;
            setDoc((current) => ({
              ...current,
              blocks: [...current.blocks.slice(0, index), block, ...current.blocks.slice(index)],
            }));
            setRevision((value) => value + 1);
            return { revision: revision + 1, summary: 'Inserted block.' };
          }
          if (mutation.type === 'append-to-document') {
            const appended = plaintextToDocument('', mutation.body).blocks;
            setDoc((current) => ({
              ...current,
              blocks: [...current.blocks, ...appended],
            }));
            setRevision((value) => value + 1);
            return { revision: revision + 1, summary: 'Appended to document.' };
          }
          if (mutation.type !== 'replace-document') {
            throw new Error(`Unsupported document mutation: ${mutation.type}`);
          }
          const next = plaintextToDocument(mutation.title ?? doc.title, mutation.body);
          setDoc(next.blocks.length > 0 ? next : { ...next, blocks: [emptyParagraph()] });
          setRevision((value) => value + 1);
          return { revision: revision + 1, summary: 'Replaced document content.' };
        },
      }),
    [doc.title, documentId, revision]
  );

  const updateDoc = (updater: (draft: AllternitDocument) => AllternitDocument) => {
    setDoc((current) => updater(current));
    setRevision((value) => value + 1);
  };

  const updateBlock = (index: number, block: DocumentBlock) => {
    updateDoc((current) => ({
      ...current,
      blocks: current.blocks.map((b, i) => (i === index ? block : b)),
    }));
  };

  const insertBlock = (block: DocumentBlock) => {
    const index = activeIndexRef.current;
    updateDoc((current) => ({
      ...current,
      blocks: [...current.blocks.slice(0, index + 1), block, ...current.blocks.slice(index + 1)],
    }));
  };

  const execFormat = (command: string, value?: string) => {
    document.execCommand(command, false, value);
  };

  const toggleCode = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    let node: Node | null = selection.anchorNode;
    while (node && node.nodeType === Node.TEXT_NODE) node = node.parentNode;
    const codeEl = node instanceof Element ? node.closest('code') : null;
    if (codeEl) {
      const parent = codeEl.parentNode;
      if (!parent) return;
      while (codeEl.firstChild) parent.insertBefore(codeEl.firstChild, codeEl);
      parent.removeChild(codeEl);
    } else {
      const range = selection.getRangeAt(0);
      const wrapper = document.createElement('code');
      try {
        range.surroundContents(wrapper);
      } catch {
        const contents = range.extractContents();
        wrapper.appendChild(contents);
        range.insertNode(wrapper);
      }
    }
  };

  const insertHeading = (level: 1 | 2 | 3) => insertBlock({ type: 'heading', level, content: [] });
  const insertList = (style: 'bulleted' | 'numbered') => insertBlock({ type: 'list', style, items: [emptyParagraph()] });
  const insertDivider = () => insertBlock({ type: 'divider' });
  const insertImage = () => {
    const src = window.prompt('Image URL');
    if (!src) return;
    insertBlock({ type: 'image', src });
  };
  const insertTable = () => {
    const rows = 2;
    const cols = 2;
    const table: DocumentBlock = {
      type: 'table',
      rows: Array.from({ length: rows }, () => ({
        cells: Array.from({ length: cols }, () => ({ blocks: [emptyParagraph()] })),
      })),
    };
    insertBlock(table);
  };

  const toolbarButton = (label: string, onClick: () => void, disabled = false) => (
    <button
      key={label}
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      className="rounded border border-[var(--border-subtle)] px-2 py-1 text-[10px] font-semibold disabled:opacity-40"
    >
      {label}
    </button>
  );

  const handleListKeyDown = (
    e: React.KeyboardEvent<HTMLLIElement>,
    block: Extract<DocumentBlock, { type: 'list' }>,
    blockIndex: number,
    itemIndex: number
  ) => {
    const element = e.currentTarget;
    if (e.key === 'Enter') {
      e.preventDefault();
      const offset = getCaretTextOffset(element);
      const runs = parseInlineRuns(element);
      const [beforeRuns, afterRuns] = splitRuns(runs, offset);
      const items = [...block.items];
      items[itemIndex] = paragraphBlock(beforeRuns);
      items.splice(itemIndex + 1, 0, paragraphBlock(afterRuns));
      updateBlock(blockIndex, { ...block, items });
      const nextItemKey = `${blockIndex}-${itemIndex + 1}`;
      requestAnimationFrame(() => {
        const next = listItemRefs.current[nextItemKey];
        if (next) {
          next.focus();
          setCaretAtStart(next);
        }
      });
      return;
    }

    if (e.key === 'Backspace') {
      const text = element.innerText || '';
      if (text === '') {
        e.preventDefault();
        if (block.items.length <= 1) {
          updateDoc((current) => ({
            ...current,
            blocks: current.blocks.filter((_, i) => i !== blockIndex),
          }));
          return;
        }
        const items = block.items.filter((_, i) => i !== itemIndex);
        updateBlock(blockIndex, { ...block, items });
        const prevItemKey = `${blockIndex}-${Math.max(0, itemIndex - 1)}`;
        requestAnimationFrame(() => {
          const prev = listItemRefs.current[prevItemKey];
          if (prev) prev.focus();
        });
      }
    }
  };

  const addTableRow = (blockIndex: number, rowIndex: number, before: boolean) => {
    const block = doc.blocks[blockIndex];
    if (block.type !== 'table') return;
    const insertAt = before ? rowIndex : rowIndex + 1;
    const colCount = block.rows[0]?.cells.length ?? 1;
    const newRow = { cells: Array.from({ length: colCount }, () => ({ blocks: [emptyParagraph()] })) };
    const rows = [...block.rows.slice(0, insertAt), newRow, ...block.rows.slice(insertAt)];
    updateBlock(blockIndex, { ...block, rows });
  };

  const addTableColumn = (blockIndex: number, colIndex: number, before: boolean) => {
    const block = doc.blocks[blockIndex];
    if (block.type !== 'table') return;
    const insertAt = before ? colIndex : colIndex + 1;
    const rows = block.rows.map((row) => ({
      ...row,
      cells: [...row.cells.slice(0, insertAt), { blocks: [emptyParagraph()] }, ...row.cells.slice(insertAt)],
    }));
    updateBlock(blockIndex, { ...block, rows });
  };

  const deleteTableRow = (blockIndex: number, rowIndex: number) => {
    const block = doc.blocks[blockIndex];
    if (block.type !== 'table' || block.rows.length <= 1) return;
    const rows = block.rows.filter((_, i) => i !== rowIndex);
    updateBlock(blockIndex, { ...block, rows });
    setSelectedTableCell((current) => (current?.blockIndex === blockIndex && current.row === rowIndex ? null : current));
  };

  const deleteTableColumn = (blockIndex: number, colIndex: number) => {
    const block = doc.blocks[blockIndex];
    if (block.type !== 'table') return;
    const row = block.rows[0];
    if (!row || row.cells.length <= 1) return;
    const rows = block.rows.map((r) => ({
      ...r,
      cells: r.cells.filter((_, i) => i !== colIndex),
    }));
    updateBlock(blockIndex, { ...block, rows });
    setSelectedTableCell((current) => (current?.blockIndex === blockIndex && current.col === colIndex ? null : current));
  };

  const renderBlock = (block: DocumentBlock, index: number) => {
    const commonProps = {
      'data-index': index,
      onFocus: () => {
        activeIndexRef.current = index;
        setSelectedTableCell(null);
      },
      suppressContentEditableWarning: true,
      className: 'outline-none',
    };

    switch (block.type) {
      case 'paragraph':
        return (
          <div
            key={index}
            {...commonProps}
            contentEditable
            dangerouslySetInnerHTML={{ __html: runsToHtml(block.content) || '<br>' }}
            onBlur={(e) => updateBlock(index, { ...block, content: parseInlineRuns(e.currentTarget) })}
            className={`min-h-[1.5em] outline-none ${block.align === 'center' ? 'text-center' : block.align === 'right' ? 'text-right' : block.align === 'justify' ? 'text-justify' : ''}`}
          />
        );
      case 'heading': {
        const Tag = `h${block.level}` as 'h1' | 'h2' | 'h3';
        return (
          <Tag
            key={index}
            {...commonProps}
            contentEditable
            dangerouslySetInnerHTML={{ __html: runsToHtml(block.content) || '<br>' }}
            onBlur={(e) => updateBlock(index, { ...block, content: parseInlineRuns(e.currentTarget) })}
            className="my-2 font-bold outline-none"
          />
        );
      }
      case 'list': {
        const ListTag = block.style === 'bulleted' ? 'ul' : 'ol';
        return (
          <ListTag
            key={index}
            data-index={index}
            onFocus={() => {
              activeIndexRef.current = index;
              setSelectedTableCell(null);
            }}
            className={`${block.style === 'bulleted' ? 'list-disc' : 'list-decimal'} ml-6 outline-none`}
          >
            {block.items.map((item, itemIndex) => (
              <li
                key={itemIndex}
                ref={(el) => {
                  listItemRefs.current[`${index}-${itemIndex}`] = el;
                }}
                contentEditable
                suppressContentEditableWarning
                dangerouslySetInnerHTML={{ __html: item.type === 'paragraph' ? runsToHtml(item.content) || '<br>' : '<br>' }}
                onBlur={(e) => {
                  const items = [...block.items];
                  items[itemIndex] = paragraphBlock(parseInlineRuns(e.currentTarget));
                  updateBlock(index, { ...block, items });
                }}
                onKeyDown={(e) => handleListKeyDown(e, block, index, itemIndex)}
                className="outline-none"
              />
            ))}
          </ListTag>
        );
      }
      case 'table': {
        const selected = selectedTableCell?.blockIndex === index ? selectedTableCell : null;
        return (
          <div key={index} className="my-2">
            {selected && (
              <div className="mb-1 flex flex-wrap gap-1">
                {toolbarButton('Row ↑', () => addTableRow(index, selected.row, true))}
                {toolbarButton('Row ↓', () => addTableRow(index, selected.row, false))}
                {toolbarButton('Col ←', () => addTableColumn(index, selected.col, true))}
                {toolbarButton('Col →', () => addTableColumn(index, selected.col, false))}
                {toolbarButton('Delete row', () => deleteTableRow(index, selected.row), block.rows.length <= 1)}
                {toolbarButton('Delete col', () => deleteTableColumn(index, selected.col), (block.rows[0]?.cells.length ?? 1) <= 1)}
              </div>
            )}
            <table className="w-full border-collapse border border-[var(--border-subtle)]">
              <tbody>
                {block.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.cells.map((cell, cellIndex) => {
                      const cellKey = `${index}-${rowIndex}-${cellIndex}`;
                      const isSelected = selected?.row === rowIndex && selected?.col === cellIndex;
                      return (
                        <td
                          key={cellIndex}
                          ref={(el) => {
                            tableCellRefs.current[cellKey] = el;
                          }}
                          contentEditable
                          suppressContentEditableWarning
                          dangerouslySetInnerHTML={{
                            __html:
                              cell.blocks[0]?.type === 'paragraph'
                                ? runsToHtml(cell.blocks[0].content) || '<br>'
                                : '<br>',
                          }}
                          onFocus={() => {
                            activeIndexRef.current = index;
                            setSelectedTableCell({ blockIndex: index, row: rowIndex, col: cellIndex });
                          }}
                          onBlur={(e) => {
                            const rows = block.rows.map((r, ri) =>
                              ri === rowIndex
                                ? {
                                    ...r,
                                    cells: r.cells.map((c, ci) =>
                                      ci === cellIndex
                                        ? { blocks: [paragraphBlock(parseInlineRuns(e.currentTarget))] }
                                        : c
                                    ),
                                  }
                                : r
                            );
                            updateBlock(index, { ...block, rows });
                          }}
                          className={`min-w-20 border border-[var(--border-subtle)] p-2 align-top outline-none ${isSelected ? 'bg-[var(--bg-secondary)]' : ''}`}
                        />
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      case 'image':
        return (
          <div key={index} className="group relative my-2 inline-block">
            <img
              src={block.src}
              alt={block.alt}
              className="max-h-64 max-w-full rounded border border-[var(--border-subtle)]"
            />
            <button
              type="button"
              onClick={() => {
                const src = window.prompt('Image URL', block.src);
                if (src === null) return;
                updateBlock(index, { ...block, src: src || block.src });
              }}
              className="absolute right-1 top-1 rounded border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 py-1 text-[10px] font-semibold opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
            >
              Edit URL
            </button>
          </div>
        );
      case 'divider':
        return <hr key={index} className="my-4 border-[var(--border-subtle)]" />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-full flex-col bg-[var(--bg-primary)]">
      <header className="flex items-center gap-3 border-b border-[var(--border-subtle)] px-5 py-3">
        <button type="button" onClick={onClose} className="text-xs text-[var(--text-secondary)]">
          ← Documents
        </button>
        <input
          value={doc.title}
          onChange={(e) => updateDoc((current) => ({ ...current, title: e.target.value }))}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
        />
        <button
          type="button"
          onClick={() => void exportDocumentFile('documents', documentId, 'docx')}
          className="rounded border border-[var(--border-subtle)] px-2 py-1 text-[10px] font-semibold"
        >
          Save as .docx
        </button>
        <button
          type="button"
          onClick={() => downloadDocumentFile(`${doc.title || 'document'}.md`, documentToPlaintext(doc), 'text/markdown')}
          className="rounded border border-[var(--border-subtle)] px-2 py-1 text-[10px] font-semibold"
        >
          Export Markdown
        </button>
        <span className="text-[10px] text-[var(--text-tertiary)]">Saved locally</span>
      </header>

      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border-subtle)] px-5 py-2">
        {toolbarButton('B', () => execFormat('bold'))}
        {toolbarButton('I', () => execFormat('italic'))}
        {toolbarButton('U', () => execFormat('underline'))}
        {toolbarButton('S', () => execFormat('strikeThrough'))}
        {toolbarButton('</>', toggleCode)}
        {toolbarButton('Red', () => execFormat('foreColor', '#ef4444'))}
        {toolbarButton('Yellow', () => execFormat('hiliteColor', '#fef08a'))}
        {toolbarButton('H1', () => insertHeading(1))}
        {toolbarButton('H2', () => insertHeading(2))}
        {toolbarButton('H3', () => insertHeading(3))}
        {toolbarButton('• List', () => insertList('bulleted'))}
        {toolbarButton('1. List', () => insertList('numbered'))}
        {toolbarButton('Table', insertTable)}
        {toolbarButton('Divider', insertDivider)}
        {toolbarButton('Image', insertImage)}
      </div>

      <div className="flex-1 overflow-auto bg-[var(--bg-secondary)] p-8">
        <div className="mx-auto min-h-[80vh] w-full max-w-3xl rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-12 text-[15px] leading-7 text-[var(--text-primary)] shadow-lg">
          {doc.blocks.length === 0 ? (
            <div className="text-[var(--text-tertiary)]">Start writing, or ask Computer Agent to draft here…</div>
          ) : (
            doc.blocks.map((block, index) => renderBlock(block, index))
          )}
        </div>
      </div>
    </div>
  );
}
