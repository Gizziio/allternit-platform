"use client";
import React, { useEffect, useState } from 'react';
import { Plus, Trash, FileCode, FileText, DownloadSimple } from '@phosphor-icons/react';
import {
  loadProjectFiles,
  writeProjectFile,
  deleteProjectFile,
  type ProjectFile,
  type ProjectFileTree,
} from '../../lib/design/project-file-store';
import { lintGeneratedHtml, isBrandP0Violation } from '../../lib/design/html-linter';

interface ProjectFileWorkspaceProps {
  projectId: string;
  onOpenFile?: (path: string, content: string) => void;
}

export function ProjectFileWorkspace({ projectId, onOpenFile }: ProjectFileWorkspaceProps) {
  const [tree, setTree] = useState<ProjectFileTree>({ projectId, files: {} });
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const [showNewInput, setShowNewInput] = useState(false);
  // Gate: HTML with unresolved P0 brand violations (legacy coral / purple) is
  // blocked from being saved as a project file until fixed.
  const [brandGateError, setBrandGateError] = useState<string | null>(null);

  useEffect(() => {
    loadProjectFiles(projectId).then(setTree);
  }, [projectId]);

  async function createFile() {
    const name = newFileName.trim();
    if (!name) return;
    const path = name.startsWith('/') ? name : `/${name}`;
    const updated = await writeProjectFile(projectId, path, defaultContentFor(path));
    setTree(updated);
    setNewFileName('');
    setShowNewInput(false);
    setSelectedPath(path);
    setBrandGateError(null);
  }

  async function updateSelected(content: string) {
    if (!selectedPath) return;
    if (selectedPath.endsWith('.html')) {
      const brandP0 = lintGeneratedHtml(content).violations.filter(isBrandP0Violation);
      if (brandP0.length > 0) {
        setBrandGateError(
          `Not saved — ${brandP0.length} P0 brand violation(s): ${brandP0.map((v) => v.message).join(' ')}`,
        );
        return;
      }
    }
    setBrandGateError(null);
    const updated = await writeProjectFile(projectId, selectedPath, content);
    setTree(updated);
  }

  async function removeFile(path: string) {
    const updated = await deleteProjectFile(projectId, path);
    setTree(updated);
    if (selectedPath === path) setSelectedPath(null);
  }

  function downloadFile(file: ProjectFile) {
    const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.path.split('/').pop() ?? 'file';
    a.click();
    URL.revokeObjectURL(url);
  }

  const files = Object.values(tree.files).sort((a, b) => a.path.localeCompare(b.path));
  const selectedFile = selectedPath ? tree.files[selectedPath] : null;

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--shell-view-bg)' }}>
      {/* Sidebar */}
      <div style={{ width: 260, borderRight: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)' }}>Files</span>
          <button type="button" onClick={() => setShowNewInput(true)} style={{ width: 22, height: 22, borderRadius: 5, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Plus size={14} weight="bold" />
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
          {showNewInput && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <input
                autoFocus
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') createFile(); if (e.key === 'Escape') { setShowNewInput(false); setNewFileName(''); } }}
                placeholder="filename.html"
                style={{ flex: 1, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 12 }}
              />
            </div>
          )}

          {files.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '8px 4px' }}>
              No files yet. Add one or import a directory.
            </div>
          )}

          {files.map((file) => (
            <div
              key={file.path}
              onClick={() => { setSelectedPath(file.path); onOpenFile?.(file.path, file.content); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 6,
                cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)',
                background: selectedPath === file.path ? 'var(--surface-hover)' : 'transparent',
              }}
            >
              {file.path.endsWith('.html') ? <FileCode size={14} /> : <FileText size={14} />}
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.path}</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); downloadFile(file); }}
                style={{ opacity: 0.6, background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 2 }}
              ><DownloadSimple size={12} /></button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeFile(file.path); }}
                style={{ opacity: 0.6, background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 2 }}
              ><Trash size={12} /></button>
            </div>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {selectedFile ? (
          <>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
              {selectedFile.path}
            </div>
            {brandGateError && (
              <div role="alert" style={{ padding: '8px 14px', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', background: 'color-mix(in srgb, #B08D6E 12%, transparent)', borderBottom: '1px solid var(--border-subtle)' }}>
                {brandGateError}
              </div>
            )}
            <textarea
              value={selectedFile.content}
              onChange={(e) => updateSelected(e.target.value)}
              style={{
                flex: 1, width: '100%', boxSizing: 'border-box', padding: 14,
                border: 'none', outline: 'none', resize: 'none',
                background: 'var(--bg-primary)', color: 'var(--text-primary)',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13, lineHeight: 1.5,
              }}
            />
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
            Select a file to edit
          </div>
        )}
      </div>
    </div>
  );
}

function defaultContentFor(path: string): string {
  if (path.endsWith('.html')) {
    return '<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1" />\n  <title>Artifact</title>\n</head>\n<body>\n</body>\n</html>';
  }
  if (path.endsWith('.json')) return '{}\n';
  if (path.endsWith('.md')) return '# Notes\n\n';
  return '';
}
