/**
 * Package Manager Component
 * 
 * Handles exporting and importing agent workspaces as .a2r packages (ZIP format).
 * 
 * Features:
 * - Export agent workspace to .a2r file
 * - Import .a2r file to create/update agent
 * - View package manifest
 * - Validate package integrity
 */

import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import JSZip from 'jszip';
import {
  Package,
  DownloadSimple,
  UploadSimple,
  FileArchive,
  CheckCircle,
  Warning,
  X,
  FolderOpen,
  FileText,
  Code,
  Clock,
  User,
  Tag,
  CaretRight,
  ArrowsClockwise,
  FloppyDisk,
} from '@phosphor-icons/react';
import { agentWorkspaceService } from '@/lib/agents/agent-workspace.service';
import type { AgentWorkspace } from '@/lib/agents/agent.types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface PackageManagerProps {
  agentId: string;
  onClose: () => void;
  onImport?: () => void;
  theme?: {
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    accent: string;
    bgCard: string;
    bg: string;
    borderSubtle: string;
  };
}

const STUDIO_THEME = {
  textPrimary: '#ECECEC',
  textSecondary: '#A0A0A0',
  textMuted: '#6B6B6B',
  accent: '#D4956A',
  bgCard: 'rgba(42, 33, 26, 0.6)',
  bg: '#0E0D0C',
  borderSubtle: 'rgba(255,255,255,0.08)',
};

interface PackageManifest {
  id: string;
  agentId: string;
  agentName: string;
  template: string;
  version: string;
  createdAt: number;
  lastModified: number;
  layers: {
    cognitive: boolean;
    identity: boolean;
    governance: boolean;
    skills: boolean;
    business: boolean;
  };
  files: string[];
}

interface PackageFile {
  path: string;
  content: string;
  size: number;
}

export function PackageManager({ agentId, onClose, onImport, theme = STUDIO_THEME }: PackageManagerProps) {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [workspace, setWorkspace] = useState<AgentWorkspace | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Export state
  const [exportOptions, setExportOptions] = useState({
    includeMemory: false,
    includeHistory: false,
    compress: true,
  });
  const [isExporting, setIsExporting] = useState(false);
  
  // Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<{
    manifest: PackageManifest | null;
    files: PackageFile[];
  } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load workspace
  const loadWorkspace = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const ws = await agentWorkspaceService.load(agentId);
      setWorkspace(ws);
    } catch (e) {
      setError('Failed to load workspace');
    } finally {
      setIsLoading(false);
    }
  }, [agentId]);

  // Export workspace to .a2r
  const handleExport = async () => {
    setIsExporting(true);
    setError(null);
    try {
      const blob = await agentWorkspaceService.export(agentId, exportOptions);
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${workspace?.agentName || 'agent'}.a2r`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setSuccess('Package exported successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      setError('Failed to export package');
      console.error(e);
    } finally {
      setIsExporting(false);
    }
  };

  // Preview import file
  const previewImport = async (file: File) => {
    setIsLoading(true);
    setError(null);
    try {
      const zip = await JSZip.loadAsync(file);
      
      // Read manifest
      const manifestFile = zip.file('manifest.json');
      if (!manifestFile) {
        setError('Invalid .a2r package: manifest.json not found');
        setIsLoading(false);
        return;
      }
      
      const manifest: PackageManifest = JSON.parse(await manifestFile.async('text'));
      
      // List all files
      const files: PackageFile[] = [];
      for (const [path, zipEntry] of Object.entries(zip.files)) {
        if (zipEntry.dir || path === 'manifest.json') continue;
        const content = await zipEntry.async('text');
        files.push({
          path,
          content: content.slice(0, 200) + (content.length > 200 ? '...' : ''),
          size: content.length,
        });
      }
      
      setImportPreview({ manifest, files });
      setImportFile(file);
    } catch (e) {
      setError('Failed to read package file');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  // Import workspace from .a2r
  const handleImport = async () => {
    if (!importFile) return;
    setIsImporting(true);
    setError(null);
    try {
      await agentWorkspaceService.import(importFile);
      setSuccess('Package imported successfully');
      onImport?.();
      setTimeout(() => {
        setSuccess(null);
        onClose();
      }, 2000);
    } catch (e) {
      setError('Failed to import package');
      console.error(e);
    } finally {
      setIsImporting(false);
    }
  };

  // Handle file drop
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      previewImport(file);
    }
  };

  // Format date
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div style={{ 
      position: 'fixed', 
      inset: 0, 
      background: 'rgba(0,0,0,0.7)', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      zIndex: 100,
    }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        style={{
          width: '90%',
          maxWidth: '700px',
          maxHeight: '85vh',
          background: theme.bgCard,
          borderRadius: '12px',
          border: `1px solid ${theme.borderSubtle}`,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px',
          borderBottom: `1px solid ${theme.borderSubtle}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: '8px',
              background: `${theme.accent}20`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Package style={{ width: 20, height: 20, color: theme.accent }} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: theme.textPrimary }}>
                Package Manager
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: theme.textSecondary }}>
                Export or import .a2r packages
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.textMuted }}>
            <X style={{ width: 20, height: 20 }} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: `1px solid ${theme.borderSubtle}`,
        }}>
          {(['export', 'import'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                padding: '14px',
                background: activeTab === tab ? `${theme.accent}15` : 'transparent',
                border: 'none',
                borderBottom: `2px solid ${activeTab === tab ? theme.accent : 'transparent'}`,
                color: activeTab === tab ? theme.accent : theme.textSecondary,
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                textTransform: 'capitalize',
              }}
            >
              {tab === 'export' ? <DownloadSimple style={{ width: 16, height: 16 }} /> : <UploadSimple style={{ width: 16, height: 16 }} />}
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
          {/* Messages */}
          {error && (
            <div style={{
              padding: '12px 16px',
              background: 'rgba(239, 68, 68, 0.1)',
              borderRadius: '8px',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <Warning style={{ width: 16, height: 16, color: '#ef4444' }} />
              <span style={{ fontSize: '13px', color: '#ef4444' }}>{error}</span>
            </div>
          )}

          {success && (
            <div style={{
              padding: '12px 16px',
              background: 'rgba(34, 197, 94, 0.1)',
              borderRadius: '8px',
              border: '1px solid rgba(34, 197, 94, 0.2)',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <CheckCircle style={{ width: 16, height: 16, color: '#22c55e' }} />
              <span style={{ fontSize: '13px', color: '#22c55e' }}>{success}</span>
            </div>
          )}

          <AnimatePresence mode="wait">
            {activeTab === 'export' ? (
              <motion.div
                key="export"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
              >
                {/* Workspace Info */}
                <div style={{
                  padding: '16px',
                  background: theme.bg,
                  borderRadius: '8px',
                  border: `1px solid ${theme.borderSubtle}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <FolderOpen style={{ width: 20, height: 20, color: theme.accent }} />
                    <span style={{ fontSize: '15px', fontWeight: 500, color: theme.textPrimary }}>
                      {workspace?.agentName || 'Agent Workspace'}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px' }}>
                    <div style={{ color: theme.textSecondary }}>
                      <span style={{ color: theme.textMuted }}>Version: </span>
                      {workspace?.version || '1.0.0'}
                    </div>
                    <div style={{ color: theme.textSecondary }}>
                      <span style={{ color: theme.textMuted }}>Files: </span>
                      {workspace?.fileTree.length || 0}
                    </div>
                    <div style={{ color: theme.textSecondary }}>
                      <span style={{ color: theme.textMuted }}>Template: </span>
                      {workspace?.manifest?.template || 'custom'}
                    </div>
                    <div style={{ color: theme.textSecondary }}>
                      <span style={{ color: theme.textMuted }}>Last Modified: </span>
                      {workspace?.lastModified ? formatDate(workspace.lastModified) : 'N/A'}
                    </div>
                  </div>
                </div>

                {/* Layer Preview */}
                <div>
                  <label style={{ fontSize: '13px', color: theme.textSecondary, marginBottom: '12px', display: 'block' }}>
                    Included Layers
                  </label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {workspace?.layers && Object.entries(workspace.layers).map(([layer, enabled]) => (
                      enabled && (
                        <Badge
                          key={layer}
                          variant="secondary"
                          style={{
                            background: `${theme.accent}20`,
                            color: theme.accent,
                            textTransform: 'capitalize',
                          }}
                        >
                          {layer}
                        </Badge>
                      )
                    ))}
                  </div>
                </div>

                {/* Export Options */}
                <div>
                  <label style={{ fontSize: '13px', color: theme.textSecondary, marginBottom: '12px', display: 'block' }}>
                    Export Options
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={exportOptions.includeMemory}
                        onChange={(e) => setExportOptions({ ...exportOptions, includeMemory: e.target.checked })}
                        style={{ width: 18, height: 18 }}
                      />
                      <span style={{ fontSize: '13px', color: theme.textPrimary }}>Include memory files</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={exportOptions.includeHistory}
                        onChange={(e) => setExportOptions({ ...exportOptions, includeHistory: e.target.checked })}
                        style={{ width: 18, height: 18 }}
                      />
                      <span style={{ fontSize: '13px', color: theme.textPrimary }}>Include execution history</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={exportOptions.compress}
                        onChange={(e) => setExportOptions({ ...exportOptions, compress: e.target.checked })}
                        style={{ width: 18, height: 18 }}
                      />
                      <span style={{ fontSize: '13px', color: theme.textPrimary }}>Compress package (recommended)</span>
                    </label>
                  </div>
                </div>

                {/* Export Button */}
                <Button
                  onClick={handleExport}
                  disabled={isExporting}
                  style={{
                    background: theme.accent,
                    width: '100%',
                    padding: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  {isExporting ? (
                    <>
                      <ArrowsClockwise style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <DownloadSimple style={{ width: 18, height: 18 }} />
                      Export .a2r Package
                    </>
                  )}
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="import"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
              >
                {!importPreview ? (
                  /* File Upload Area */
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      padding: '48px',
                      border: `2px dashed ${theme.borderSubtle}`,
                      borderRadius: '12px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      background: theme.bg,
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.currentTarget.style.borderColor = theme.accent;
                      e.currentTarget.style.background = `${theme.accent}10`;
                    }}
                    onDragLeave={(e) => {
                      e.currentTarget.style.borderColor = theme.borderSubtle;
                      e.currentTarget.style.background = theme.bg;
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files[0];
                      if (file?.name.endsWith('.a2r')) {
                        previewImport(file);
                      } else {
                        setError('Please drop a valid .a2r file');
                      }
                    }}
                  >
                    <FileArchive style={{ width: 48, height: 48, color: theme.accent, margin: '0 auto 16px' }} />
                    <p style={{ fontSize: '15px', color: theme.textPrimary, margin: '0 0 8px 0' }}>
                      Drop your .a2r package here
                    </p>
                    <p style={{ fontSize: '13px', color: theme.textMuted, margin: 0 }}>
                      or click to browse
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".a2r"
                      onChange={handleFileSelect}
                      style={{ display: 'none' }}
                    />
                  </div>
                ) : (
                  /* Import Preview */
                  <>
                    {/* Manifest Preview */}
                    <div style={{
                      padding: '16px',
                      background: theme.bg,
                      borderRadius: '8px',
                      border: `1px solid ${theme.borderSubtle}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <Package style={{ width: 20, height: 20, color: theme.accent }} />
                        <span style={{ fontSize: '15px', fontWeight: 500, color: theme.textPrimary }}>
                          {importPreview.manifest?.agentName || 'Unknown Agent'}
                        </span>
                      </div>
                      
                      {importPreview.manifest && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px' }}>
                          <div style={{ color: theme.textSecondary }}>
                            <span style={{ color: theme.textMuted }}>Version: </span>
                            {importPreview.manifest.version}
                          </div>
                          <div style={{ color: theme.textSecondary }}>
                            <span style={{ color: theme.textMuted }}>Template: </span>
                            {importPreview.manifest.template}
                          </div>
                          <div style={{ color: theme.textSecondary }}>
                            <span style={{ color: theme.textMuted }}>Created: </span>
                            {formatDate(importPreview.manifest.createdAt)}
                          </div>
                          <div style={{ color: theme.textSecondary }}>
                            <span style={{ color: theme.textMuted }}>Files: </span>
                            {importPreview.manifest.files.length}
                          </div>
                        </div>
                      )}

                      {/* Layer Preview */}
                      <div style={{ marginTop: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {importPreview.manifest?.layers && Object.entries(importPreview.manifest.layers).map(([layer, enabled]) => (
                          enabled && (
                            <Badge
                              key={layer}
                              variant="secondary"
                              style={{
                                background: `${theme.accent}20`,
                                color: theme.accent,
                                textTransform: 'capitalize',
                              }}
                            >
                              {layer}
                            </Badge>
                          )
                        ))}
                      </div>
                    </div>

                    {/* File List */}
                    <div>
                      <label style={{ fontSize: '13px', color: theme.textSecondary, marginBottom: '12px', display: 'block' }}>
                        Package Contents ({importPreview.files.length} files)
                      </label>
                      <div style={{
                        maxHeight: '200px',
                        overflow: 'auto',
                        background: theme.bg,
                        borderRadius: '8px',
                        border: `1px solid ${theme.borderSubtle}`,
                      }}>
                        {importPreview.files.map((file) => (
                          <div
                            key={file.path}
                            style={{
                              padding: '10px 12px',
                              borderBottom: `1px solid ${theme.borderSubtle}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {file.path.endsWith('.json') ? (
                                <Code style={{ width: 14, height: 14, color: theme.textMuted }} />
                              ) : (
                                <FileText style={{ width: 14, height: 14, color: theme.textMuted }} />
                              )}
                              <span style={{ fontSize: '13px', color: theme.textPrimary, fontFamily: 'monospace' }}>
                                {file.path}
                              </span>
                            </div>
                            <span style={{ fontSize: '11px', color: theme.textMuted }}>
                              {formatSize(file.size)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Import Actions */}
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setImportPreview(null);
                          setImportFile(null);
                        }}
                        style={{ flex: 1 }}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleImport}
                        disabled={isImporting}
                        style={{ background: theme.accent, flex: 1 }}
                      >
                        {isImporting ? (
                          <>
                            <ArrowsClockwise style={{ width: 18, height: 18, animation: 'spin 1s linear infinite', marginRight: '8px' }} />
                            Importing...
                          </>
                        ) : (
                          <>
                            <UploadSimple style={{ width: 18, height: 18, marginRight: '8px' }} />
                            Import Package
                          </>
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

export default PackageManager;
