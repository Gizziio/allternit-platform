"use client";

import React, { useState, useEffect, useMemo } from 'react';
import {
  FolderOpen,
  FileText,
  FileCode,
  RefreshCw,
  Save,
  Wrench,
  Clock,
  Package,
  Loader2,
  Check,
  X,
  Eye,
  EyeOff,
} from 'lucide-react';
import { agentWorkspaceService } from '@/lib/agents/agent-workspace.service';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { SkillBuilderWizard, HeartbeatScheduler, PackageManager } from '@/components/agent-workspace';
import type { Agent, AgentWorkspaceLayers } from '@/lib/agents/agent.types';

const STUDIO_THEME = {
  textPrimary: '#ECECEC',
  textSecondary: '#A0A0A0',
  textMuted: '#6B6B6B',
  accent: '#D4956A',
  bgCard: '#352F29',
  bg: '#2B2520',
  borderSubtle: 'rgba(255,255,255,0.06)',
};

interface WorkspaceTabProps {
  agent: Agent;
}

const DEFAULT_LAYERS: AgentWorkspaceLayers = {
  cognitive: true,
  identity: true,
  governance: true,
  skills: true,
  business: true,
};

// Map file paths to their layers
const getFileLayer = (path: string): keyof AgentWorkspaceLayers => {
  const normalized = path.toLowerCase();
  if (normalized.includes('cognitive') || normalized.includes('reasoning') || normalized.includes('memory')) return 'cognitive';
  if (normalized.includes('identity') || normalized.includes('character') || normalized.includes('persona')) return 'identity';
  if (normalized.includes('governance') || normalized.includes('heartbeat') || normalized.includes('constitution')) return 'governance';
  if (normalized.includes('skill') || normalized.includes('tool') || normalized.includes('capability')) return 'skills';
  if (normalized.includes('business') || normalized.includes('api') || normalized.includes('integration')) return 'business';
  return 'skills'; // default
};

export function WorkspaceTab({ agent }: WorkspaceTabProps) {
  const [files, setFiles] = useState<Array<{ name: string; path: string; type: 'file' | 'directory' }>>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSkillBuilder, setShowSkillBuilder] = useState(false);
  const [showHeartbeatScheduler, setShowHeartbeatScheduler] = useState(false);
  const [showPackageManager, setShowPackageManager] = useState(false);
  const [layers, setLayers] = useState<AgentWorkspaceLayers>(DEFAULT_LAYERS);
  const [isLoadingLayers, setIsLoadingLayers] = useState(false);

  useEffect(() => {
    loadWorkspaceFiles();
    loadLayerConfig();
  }, [agent.id]);

  const loadWorkspaceFiles = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const workspace = await agentWorkspaceService.load(agent.id);
      setFiles(workspace.fileTree);
    } catch (e) {
      setError('Failed to load workspace files');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const loadFile = async (path: string) => {
    setIsLoading(true);
    try {
      const content = await agentWorkspaceService.readFile(agent.id, path);
      setFileContent(content);
      setSelectedFile(path);
    } catch (e) {
      setError('Failed to load file');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const saveFile = async () => {
    if (!selectedFile) return;
    setIsSaving(true);
    try {
      await agentWorkspaceService.writeFile(agent.id, selectedFile, fileContent);
    } catch (e) {
      setError('Failed to save file');
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const loadLayerConfig = async () => {
    try {
      const manifest = await agentWorkspaceService.getManifest(agent.id);
      if (manifest?.layers) {
        setLayers(manifest.layers);
      }
    } catch (e) {
      // Use defaults if manifest doesn't exist
      console.log('Using default layer config');
    }
  };

  const toggleLayer = async (layer: keyof AgentWorkspaceLayers) => {
    const newLayers = { ...layers, [layer]: !layers[layer] };
    setLayers(newLayers);
    
    // Save to workspace manifest
    try {
      await agentWorkspaceService.updateManifest(agent.id, { layers: newLayers });
    } catch (e) {
      console.error('Failed to save layer config:', e);
    }
  };

  // Filter files based on enabled layers
  const filteredFiles = useMemo(() => {
    return files.filter(file => {
      if (file.type === 'directory') return true;
      const layer = getFileLayer(file.path);
      return layers[layer];
    });
  }, [files, layers]);

  const groupedFiles = useMemo(() => {
    const groups: Record<string, typeof filteredFiles> = {};
    filteredFiles.forEach(file => {
      const dir = file.path.split('/').slice(0, -1).join('/') || 'Root';
      if (!groups[dir]) groups[dir] = [];
      groups[dir].push(file);
    });
    return groups;
  }, [filteredFiles]);

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left Sidebar - File Tree */}
      <div style={{
        width: '320px',
        minWidth: '320px',
        borderRight: `1px solid ${STUDIO_THEME.borderSubtle}`,
        background: STUDIO_THEME.bgCard,
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px',
          borderBottom: `1px solid ${STUDIO_THEME.borderSubtle}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '15px', fontWeight: 600, color: STUDIO_THEME.textPrimary }}>
              Files
            </span>
            <button
              onClick={loadWorkspaceFiles}
              disabled={isLoading}
              style={{
                padding: '6px',
                borderRadius: '6px',
                background: 'transparent',
                border: 'none',
                color: STUDIO_THEME.textSecondary,
                cursor: 'pointer',
              }}
            >
              <RefreshCw style={{ width: 16, height: 16, animation: isLoading ? 'spin 1s linear infinite' : undefined }} />
            </button>
          </div>
          
          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowSkillBuilder(true)}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                background: `${STUDIO_THEME.accent}20`,
                border: `1px solid ${STUDIO_THEME.accent}40`,
                color: STUDIO_THEME.accent,
                cursor: 'pointer',
                fontSize: '11px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontWeight: 500,
              }}
            >
              <Wrench style={{ width: 12, height: 12 }} />
              New Skill
            </button>
            <button
              onClick={() => setShowHeartbeatScheduler(true)}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                background: STUDIO_THEME.bg,
                border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                color: STUDIO_THEME.textSecondary,
                cursor: 'pointer',
                fontSize: '11px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Clock style={{ width: 12, height: 12 }} />
              Heartbeat
            </button>
            <button
              onClick={() => setShowPackageManager(true)}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                background: STUDIO_THEME.bg,
                border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                color: STUDIO_THEME.textSecondary,
                cursor: 'pointer',
                fontSize: '11px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Package style={{ width: 12, height: 12 }} />
              Package
            </button>
          </div>
        </div>

        {/* File List */}
        <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
          {error && (
            <div style={{
              padding: '12px',
              background: 'rgba(239, 68, 68, 0.1)',
              borderRadius: '8px',
              marginBottom: '12px',
            }}>
              <span style={{ fontSize: '12px', color: '#ef4444' }}>{error}</span>
            </div>
          )}

          {filteredFiles.length > 0 ? (
            Object.entries(groupedFiles).map(([dir, dirFiles]) => (
              <div key={dir} style={{ marginBottom: '16px' }}>
                <div style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: STUDIO_THEME.textMuted,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '8px',
                  paddingLeft: '8px',
                }}>
                  {dir.replace(/^agents\/[^/]+/, '').replace(/^\//, '') || 'Root'}
                </div>
                {dirFiles.map(file => (
                  <button
                    key={file.path}
                    onClick={() => file.type === 'file' && loadFile(file.path)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      width: '100%',
                      padding: '6px 12px',
                      borderRadius: '4px',
                      border: 'none',
                      background: selectedFile === file.path ? `${STUDIO_THEME.accent}20` : 'transparent',
                      color: selectedFile === file.path ? STUDIO_THEME.accent : STUDIO_THEME.textSecondary,
                      cursor: file.type === 'file' ? 'pointer' : 'default',
                      fontSize: '12px',
                      textAlign: 'left',
                    }}
                  >
                    {file.type === 'directory' ? (
                      <FolderOpen style={{ width: 14, height: 14, flexShrink: 0 }} />
                    ) : (
                      <FileText style={{ width: 14, height: 14, flexShrink: 0 }} />
                    )}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {file.path.replace(/^agents\/[^/]+\//, '')}
                    </span>
                  </button>
                ))}
              </div>
            ))
          ) : (
            <div style={{
              padding: '32px',
              textAlign: 'center',
              color: STUDIO_THEME.textMuted,
            }}>
              <FolderOpen style={{ width: 40, height: 40, margin: '0 auto 12px', opacity: 0.4 }} />
              <p style={{ fontSize: '13px', margin: '0 0 4px 0' }}>No files in workspace</p>
              <p style={{ fontSize: '11px', margin: 0, opacity: 0.7 }}>
                Create skills or use the Package Manager to import
              </p>
            </div>
          )}
        </div>

        {/* Layer indicators footer - checkable */}
        <div style={{
          padding: '12px 16px',
          borderTop: `1px solid ${STUDIO_THEME.borderSubtle}`,
          background: STUDIO_THEME.bg,
        }}>
          <div style={{
            fontSize: '10px',
            color: STUDIO_THEME.textMuted,
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            Workspace Layers
          </div>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
          }}>
            {(Object.keys(layers) as Array<keyof AgentWorkspaceLayers>).map(layer => {
              const isEnabled = layers[layer];
              return (
                <button
                  key={layer}
                  onClick={() => toggleLayer(layer)}
                  disabled={isLoadingLayers}
                  style={{
                    fontSize: '10px',
                    padding: '4px 8px',
                    background: isEnabled ? `${STUDIO_THEME.accent}25` : 'rgba(255,255,255,0.05)',
                    color: isEnabled ? STUDIO_THEME.accent : STUDIO_THEME.textMuted,
                    borderRadius: '4px',
                    border: `1px solid ${isEnabled ? `${STUDIO_THEME.accent}40` : STUDIO_THEME.borderSubtle}`,
                    textTransform: 'capitalize',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (isEnabled) {
                      e.currentTarget.style.background = `${STUDIO_THEME.accent}35`;
                    } else {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = isEnabled ? `${STUDIO_THEME.accent}25` : 'rgba(255,255,255,0.05)';
                  }}
                  title={`${isEnabled ? 'Hide' : 'Show'} ${layer} layer files`}
                >
                  {isEnabled ? (
                    <Check style={{ width: 10, height: 10 }} />
                  ) : (
                    <X style={{ width: 10, height: 10 }} />
                  )}
                  {layer}
                </button>
              );
            })}
          </div>
          <div style={{
            fontSize: '9px',
            color: STUDIO_THEME.textMuted,
            marginTop: '8px',
            opacity: 0.7,
          }}>
            Click to show/hide layer files
          </div>
        </div>
      </div>

      {/* Right Side - File Editor */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {selectedFile ? (
          <>
            {/* Editor Header */}
            <div style={{
              padding: '12px 16px',
              borderBottom: `1px solid ${STUDIO_THEME.borderSubtle}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: STUDIO_THEME.bgCard,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                <FileText style={{ width: 16, height: 16, color: STUDIO_THEME.accent, flexShrink: 0 }} />
                <span style={{
                  fontSize: '13px',
                  fontFamily: 'monospace',
                  color: STUDIO_THEME.textPrimary,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {selectedFile.replace(/^agents\/[^/]+\//, '')}
                </span>
              </div>
              <Button
                size="sm"
                onClick={saveFile}
                disabled={isSaving}
                style={{ background: STUDIO_THEME.accent, flexShrink: 0 }}
              >
                {isSaving ? (
                  <RefreshCw style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} />
                ) : (
                  <>
                    <Save style={{ width: 14, height: 14, marginRight: '6px' }} />
                    Save
                  </>
                )}
              </Button>
            </div>
            
            {/* Editor Content */}
            <Textarea
              value={fileContent}
              onChange={(e) => setFileContent(e.target.value)}
              style={{
                flex: 1,
                border: 'none',
                borderRadius: 0,
                background: STUDIO_THEME.bg,
                color: STUDIO_THEME.textPrimary,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                fontSize: '13px',
                lineHeight: 1.6,
                resize: 'none',
                padding: '16px',
              }}
              spellCheck={false}
            />
          </>
        ) : (
          /* Empty State */
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: STUDIO_THEME.textMuted,
            padding: '32px',
          }}>
            <FileCode style={{ width: 64, height: 64, marginBottom: '20px', opacity: 0.2 }} />
            <p style={{ fontSize: '16px', margin: '0 0 8px 0', color: STUDIO_THEME.textSecondary }}>
              Select a file to edit
            </p>
            <p style={{ fontSize: '13px', margin: 0, textAlign: 'center', maxWidth: '300px' }}>
              Browse the workspace files in the sidebar to view and edit your agent&apos;s configuration
            </p>
          </div>
        )}
      </div>

      {/* Modals */}
      {showSkillBuilder && (
        <SkillBuilderWizard
          agentId={agent.id}
          onClose={() => setShowSkillBuilder(false)}
          onSkillCreated={() => {
            setShowSkillBuilder(false);
            loadWorkspaceFiles();
          }}
        />
      )}
      {showHeartbeatScheduler && (
        <HeartbeatScheduler agentId={agent.id} onClose={() => setShowHeartbeatScheduler(false)} />
      )}
      {showPackageManager && (
        <PackageManager
          agentId={agent.id}
          onClose={() => setShowPackageManager(false)}
          onImport={() => loadWorkspaceFiles()}
        />
      )}
    </div>
  );
}
